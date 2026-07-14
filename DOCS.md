# OpenGeoGuessr — Tehnička dokumentacija za odbranu

---

## Sadržaj

1. [Baza podataka i ODM](#1-baza-podataka-i-odm)
2. [Real-time komunikacija](#2-real-time-komunikacija)
3. [Projektni obrasci](#3-projektni-obrasci)

---

## 1. Baza podataka i ODM

### 1.1 Zašto MongoDB?

OpenGeoGuessr je igra u realnom vremenu čiji je centralni entitet **soba** (`Room`). Soba sadrži igrače, runde, pogotke, poruke — sve duboko ugnježdene podatke koji se zajedno čitaju i zajedno menjaju. Kada igrač pošalje pogodak, backend treba da:

1. Pročita sobu (status, trenutna runda, lokacija)
2. Doda pogodak u niz `rounds[i].guesses`
3. Ažurira skor igrača u nizu `players`

U relacionoj bazi (PostgreSQL, MySQL) isti podatak bio bi razbacan po 4–5 tabela (`rooms`, `players`, `rounds`, `round_guesses`, `chat_messages`) i svako čitanje zahtevalo bi kompleksne JOIN upite. MongoDB sve te podatke drži u jednom dokumentu:

```
// MongoDB — jedan dokument, jedan upit
db.rooms.findOne({ code: "ABC123" })
// ↓ vraća sobu sa ugnježdenim igračima, rundama i pogocima
```

#### Prednosti MongoDB za ovaj projekat

| Prednost | Zašto je bitno |
|---|---|
| **Embedded dokumenti** | Soba + igrači + runde = jedan dokument. Nema JOIN-ova, nema N+1 problema. |
| **Fleksibilna šema** | Tokom razvoja lako dodajemo polja (`teamsEnabled`, `eliminatedPlayerIds`) bez migracionih skripti. |
| **Atomski array operatori** | `$push`, `$set` sa `arrayFilters` menjaju elemente ugnježdenih nizova direktno u bazi atomično. |
| **`timestamps: true`** | Mongoose automatski dodaje `createdAt` i `updatedAt` na svaki dokument. |
| **Brzina read-heavy operacija** | Soba se čita pri svakom WebSocket eventu — jedan lookup po `code` polju je dovoljno. |

#### Mane MongoDB za ovaj projekat

| Mana | Opis |
|---|---|
| **Bez referencijalnog integriteta** | Baza ne proverava da li `hostId` postoji u kolekciji `users`. To mora da radi aplikacioni sloj. |
| **Rast dokumenta** | Ako igra traje dugo i ima mnogo poruka u chatu, dokument raste. Zato implementiramo `$slice: -200` koji drži samo poslednjih 200 poruka. |
| **Transakcije su komplikovanije** | MongoDB podržava multi-document transakcije tek od verzije 4.0 i samo sa replica setom. U ovom projektu koristimo atomske operatore (`$push`, `$set`, `$addToSet`) koji su dovoljni za naše slučajeve. |
| **Duplikacija podataka** | Username igrača se čuva i u `Player` objektu unutar sobe i u `ChatMessage`. Ako se username promeni, treba ažurirati na više mesta. |

---

### 1.2 Mongoose kao ODM

**ODM (Object-Document Mapper)** je ekvivalent ORM-a za dokumentne baze. Mongoose premošćuje TypeScript tipove i MongoDB dokumente na sledeći način:

```
TypeScript interfejs (IRoom)
        ↕
Mongoose Schema (RoomSchema)  ←— validacija, enum, default vrednosti
        ↕
MongoDB kolekcija (rooms)
```

#### Veza između interfejsa i šeme

Svaki model ima **dva dela** — interfejs koji opisuje TypeScript tip, i šema koja opisuje MongoDB strukturu:

```typescript
// api/src/database/models/room.model.ts

// 1. TypeScript interfejs — opisuje oblik dokumenta u kodu
export interface IRoom extends Document {
  code: string;
  hostId: string;
  players: Player[];
  status: GameStatus;
  rounds: Round[];
  currentRoundIndex: number;
  totalRounds: number;
  roundDurationSeconds: number;
  locationMode: 'famous' | 'world';
  gameMode: GameMode;
  eliminatedPlayerIds: string[];
  messages: ChatMessage[];
  hintsEnabled: boolean;
  spectatorsAllowed: boolean;
  teamsEnabled: boolean;
  teamSize: number;
  createdAt: Date;
  updatedAt: Date;
}

// 2. Mongoose šema — opisuje pravila validacije i default vrednosti
const RoomSchema = new Schema<IRoom>(
  {
    code: { type: String, required: true, unique: true, uppercase: true },
    status: {
      type: String,
      enum: ['waiting', 'countdown', 'playing', 'round_results', 'game_over'],
      default: 'waiting',
    },
    rounds: [RoundSchema],         // ugnježdeni niz pod-šema
    players: [PlayerSchema],
    eliminatedPlayerIds: { type: [String], default: [] },
    messages: { type: [ChatMessageSchema], default: [] },
    hintsEnabled: { type: Boolean, default: false },
  },
  { timestamps: true },            // automatski createdAt + updatedAt
);

// 3. Model — TypeScript klasa koja veže interfejs i šemu
export const RoomModel = mongoose.model<IRoom>('Room', RoomSchema);
```

Generički parametar `model<IRoom>` znači da svaki dokument vraćen iz baze automatski ima tip `IRoom` — TypeScript kompajler hvata greške poput `room.nesto_nepostojece`.

---

### 1.3 Šema ugnježdenih dokumenata

Umesto normalizovanih tabela, sva duboka struktura sobe je ugnježdena kao pod-šeme:

```typescript
// Pogodak igrača unutar runde
const RoundGuessSchema = new Schema(
  {
    userId: String,
    lat: Number,
    lng: Number,
    distanceKm: Number,
    roundScore: Number,
    submittedAt: Number,
  },
  { _id: false },   // bez automatskog _id — ovo nije samostalni dokument
);

// Runda — sadrži lokaciju i niz pogodaka
const RoundSchema = new Schema(
  {
    index: Number,
    location: LocationSchema,     // ugnježdena lokacija
    guesses: [RoundGuessSchema],  // ugnježdeni niz pogodaka
    startedAt: Number,
    endedAt: Number,
  },
  { _id: false },
);
```

`{ _id: false }` na svakoj pod-šemi sprečava Mongoose da generiše `_id` za svaki ugnježdeni objekat, jer oni nisu samostalni dokumenti i ne treba da budu adresabilni po ID-ju.

---

### 1.4 Kolekcije u bazi

Projekat ima tri MongoDB kolekcije:

#### `users`
```typescript
// api/src/database/models/user.model.ts
export interface IUser extends Document {
  username: string;    // unique
  email: string;       // unique, lowercase
  password: string;    // bcrypt hash
  totalScore: number;  // akumulovani skor kroz sve igre
  gamesPlayed: number;
}
```

#### `rooms`
Centralni dokument projekta. Sadrži sve što se tiče jedne igre — igrače, runde, pogotke, chat. Detaljno prikazano u odeljku 1.2.

#### `cachedlocations`
```typescript
// api/src/database/models/cached-location.model.ts
export interface ICachedLocation extends Document {
  lat: number;
  lng: number;
  panoId: string;    // Google Street View panorama ID
  name: string;
  country: string;
  usedCount: number; // indeksiran — za pickRandom() upit
  lastUsedAt?: Date;
}
```
Ova kolekcija služi kao predmemorija validnih Street View lokacija. `WorldLocationProvider` popunjava cache u pozadini i povlači iz njega umesto da svaki put poziva Google API.

---

### 1.5 Repository Pattern i BaseRepository

Direktno korišćenje Mongoose modela rasute po servisima dovelo bi do duplikacije koda i testova koji direktno zavise od baze. Repository uzorak to rešava — svaki repository je jedino mesto koje zna za Mongoose.

#### BaseRepository — generička apstrakcija

```typescript
// api/src/database/repositories/base.repository.ts

export abstract class BaseRepository<T extends Document> {
  constructor(protected readonly model: Model<T>) {}

  async findById(id: string): Promise<T | null> {
    return this.model.findById(id).exec();
  }

  async findPaginated(filter: FilterQuery<T>, options: PaginationOptions = {}): Promise<PaginatedResult<T>> {
    const { page = 1, limit = 20, sort = '-createdAt' } = options;
    const skip = (page - 1) * limit;

    // Paralelno izvršavamo dva upita — items i count
    const [items, totalItems] = await Promise.all([
      this.model.find(filter).sort(sort).skip(skip).limit(limit).exec(),
      this.model.countDocuments(filter).exec(),
    ]);

    return {
      items,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
      currentPage: page,
    };
  }

  async updateById(id: string, data: UpdateQuery<T>): Promise<T | null> {
    return this.model.findByIdAndUpdate(id, data, { new: true }).exec();
  }
  // ... findOne, create, deleteById, exists, count
}
```

Generički parametar `<T extends Document>` znači da `BaseRepository` može da radi sa bilo kojim Mongoose dokumentom. `Model<T>` je injektovan kroz konstruktor, pa svaka konkretna klasa samo prosleđuje odgovarajući model.

#### RoomRepository — konkretna implementacija

```typescript
// api/src/database/repositories/room.repository.ts

@Service()
export class RoomRepository extends BaseRepository<IRoom> {
  constructor() {
    super(RoomModel);  // injektuje RoomModel u BaseRepository
  }

  // findById, findOne, create... dolaze iz BaseRepository besplatno

  // Domenska metoda — specifična za Room
  async findByCode(code: string): Promise<IRoom | null> {
    return this.findOne({ code: code.toUpperCase() });
  }
```

#### Atomski MongoDB operatori za ugnježdene nizove

Najzanimljiviji deo `RoomRepository` su metode koje koriste MongoDB `arrayFilters` — mehanizam koji omogućava ciljano ažuriranje elementa unutar niza bez čitanja celog dokumenta:

```typescript
// Dodaje pogodak u niz guesses[i] runde sa datim indexom
async addGuessToRound(
  roomId: string,
  roundIndex: number,
  guess: Round['guesses'][0]
): Promise<IRoom | null> {
  return this.model.findByIdAndUpdate(
    roomId,
    { $push: { 'rounds.$[elem].guesses': guess } },
    //         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    //         dot-notation put do ugnježdenog niza
    { arrayFilters: [{ 'elem.index': roundIndex }], new: true },
    //               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    //               filter koji identifikuje pravu rundu
  ).exec();
}

// Ažurira connected status jednog igrača u nizu players[]
async updatePlayerConnection(
  roomId: string,
  userId: string,
  connected: boolean
): Promise<void> {
  await this.model.findByIdAndUpdate(
    roomId,
    { $set: { 'players.$[elem].connected': connected } },
    { arrayFilters: [{ 'elem.userId': userId }] },
  ).exec();
}

// Čuva samo poslednjih 200 poruka u chatu
async addMessage(roomId: string, message: ChatMessage): Promise<void> {
  await this.model.findByIdAndUpdate(
    roomId,
    { $push: { messages: { $each: [message], $slice: -200 } } },
    //                                        ^^^^^^^^^^^^^
    //                                        automatski trim na 200 poruka
  ).exec();
}

// Sprečava duplikate u eliminatedPlayerIds
async addEliminatedPlayer(roomId: string, userId: string): Promise<void> {
  await this.model.findByIdAndUpdate(
    roomId,
    { $addToSet: { eliminatedPlayerIds: userId } },
    //  ^^^^^^^^^^^ za razliku od $push, ne dodaje duplikat
  ).exec();
}
```

Sve ove operacije su atomske na nivou MongoDB — u slučaju konkurentnih zahteva (dva igrača šalju pogodak u isto vreme), baza garantuje da neće doći do trke.

---

### 1.6 Povezivanje na MongoDB

```typescript
// api/src/loaders/mongo.loader.ts
import mongoose from 'mongoose';

export default async function mongoLoader(): Promise<void> {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/open-geoguessr';
  await mongoose.connect(uri);
  console.log('MongoDB connected');
}
```

```typescript
// api/src/server.ts — redosled pokretanja
async function bootstrap() {
  await mongoLoader();                          // 1. MongoDB veza
  const server = createServer(app.callback()); // 2. Koa HTTP server
  initWebSocketServer(server);                 // 3. WebSocket server (deli HTTP port)
  server.listen(PORT, () => { ... });
}
```

---

## 2. Real-time komunikacija

### 2.1 Zašto native `ws` umesto Socket.IO?

Socket.IO je popularna biblioteka za WebSocket komunikaciju, ali koristi **sopstveni protokol** koji nije čisti WebSocket. Zahteva odgovarajuću klijentsku biblioteku, uvodi koncepte poput "namespaces" i "rooms" koji dodaju sloj apstrakcije, a sam paket ima oko 350 KB zavisnosti.

Za OpenGeoGuessr su nam bile potrebne dve stvari:
- Slanje JSON poruka između servera i klijenta
- Broadcast svim klijentima u istoj sobi

To je dovoljno jednostavno da se implementira direktno sa nativnom `ws` bibliotekom (6 KB). Klijentska strana koristi browser-nativni `WebSocket` API — bez ijednog eksternog paketa.

---

### 2.2 Arhitektura WebSocket sloja (backend)

```
HTTP Server (Node.js)
    └── WebSocketServer (ws biblioteka)
            ├── ws.server.ts     — inicijalizacija, autentikacija, routing na handlerima
            ├── ws.clients.ts    — in-memory registry aktivnih konekcija
            └── handlers/
                └── game.handler.ts — logika svih eventi (join_room, pin_move, send_message...)
```

#### AuthenticatedClient — prošireni WebSocket objekat

```typescript
// api/src/websocket/ws.clients.ts

// Svaki WebSocket klijent se proširuje sa domenskim podacima
export interface AuthenticatedClient extends WebSocket {
  userId: string;
  username: string;
  roomCode?: string;   // undefined dok se igrač nije pridružio sobi
}

// In-memory mapa: userId → WebSocket konekcija
const clients = new Map<string, AuthenticatedClient>();

// Sve aktivne konekcije u datoj sobi (filtrira po roomCode i readyState)
export function getClientsInRoom(roomCode: string): AuthenticatedClient[] {
  return Array.from(clients.values()).filter(
    (c) => c.roomCode === roomCode && c.readyState === WebSocket.OPEN,
  );
}

// Broadcast svim klijentima u sobi — koristi se stalno u GameService
export function broadcastToRoom(roomCode: string, event: string, data: unknown): void {
  const payload = JSON.stringify({ event, data });
  getClientsInRoom(roomCode).forEach((client) => client.send(payload));
}

// Unicast — jedan klijent po userId
export function sendToClient(userId: string, event: string, data: unknown): void {
  const client = clients.get(userId);
  if (client && client.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify({ event, data }));
  }
}
```

#### Inicijalizacija i JWT autentikacija

WebSocket konekcija se otvara uz JWT token kao query parametar. Server verifikuje token **pre** nego što klijenta doda u registry:

```typescript
// api/src/websocket/ws.server.ts

export function initWebSocketServer(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server }); // deli HTTP port, ne otvara novi
  const gameHandler = Container.get(GameHandler);
  const clients = getClients();

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    // 1. Izvlači JWT token iz query stringa: ws://localhost:4000?token=eyJ...
    const token = extractToken(req);
    if (!token) { ws.close(4001, 'Unauthorized'); return; }

    // 2. Verifikuje token — ako je nevažeći, konekcija se odbija
    let userId: string, username: string;
    try {
      const payload = verifyToken(token);
      userId = payload.userId;
      username = payload.username;
    } catch {
      ws.close(4001, 'Invalid token'); return;
    }

    // 3. Kastuje WebSocket na AuthenticatedClient i dodaje u registry
    const client = ws as AuthenticatedClient;
    client.userId = userId;
    client.username = username;
    clients.set(userId, client);

    // 4. Sve dolazne poruke se rutiraju kroz GameHandler
    client.on('message', async (raw) => {
      try {
        const { event, data } = JSON.parse(raw.toString());
        await gameHandler.handle(client, event, data);
      } catch (err) {
        client.send(JSON.stringify({ event: 'error', data: { message: 'Invalid message' } }));
      }
    });

    // 5. Disconnect — čisti registry i markuje igrača kao disconnected
    client.on('close', async () => {
      if (clients.get(userId) !== client) return; // ignoriše stare sokete kod reconnecta
      if (client.roomCode) await gameHandler.handleDisconnect(client);
      clients.delete(userId);
    });

    client.send(JSON.stringify({ event: 'connected', data: { userId, username } }));
  });

  return wss;
}

function extractToken(req: IncomingMessage): string | null {
  const url = new URL(req.url || '', 'http://localhost');
  return url.searchParams.get('token');
}
```

---

### 2.3 Protokol poruka — format

Sve poruke (u oba smera) koriste isti JSON format:

```json
{ "event": "naziv_eventa", "data": { ...payload... } }
```

Ovo je svesno jednostavna konvencija — nema header-a, nema sekvencijalnih ID-jeva, nema ACK mehanizma. Za igru u realnom vremenu gde svaki event triggeruje novi read iz baze i novi broadcast, to je dovoljno.

#### Kompletna tabela eventi

| Smer | Event | Opis |
|---|---|---|
| C → S | `join_room` | Igrač ulazi u sobu (ili reconnektuje) |
| C → S | `leave_room` | Igrač napušta sobu |
| C → S | `send_message` | Chat poruka (broadcastuje se svim) |
| C → S | `send_team_message` | Chat poruka samo svom timu |
| C → S | `join_team` | Igrač bira tim (1 ili 2) |
| C → S | `pin_move` | Igrač pomera pin na mapi — broadcastuje se spektatorima |
| S → C | `connected` | Potvrda konekcije sa userId/username |
| S → C | `joined_room` | Kompletan state sobe pri ulasku |
| S → C | `room_updated` | Ažurirani state sobe (novi igrač, disconnect...) |
| S → C | `chat_history` | Prethodnih do 200 poruka iz chata |
| S → C | `new_message` | Nova chat poruka od igrača |
| S → C | `new_team_message` | Privatna tim poruka |
| S → C | `game_countdown` | Host startovao igru — počinje odbrojavanje |
| S → C | `countdown_tick` | Svaka sekunda odbrojavanja |
| S → C | `round_started` | Runda počinje (sadrži lokaciju i vreme trajanja) |
| S → C | `round_countdown` | Između rundi — kratko odbrojavanje |
| S → C | `round_countdown_tick` | Svaka sekunda između rundi |
| S → C | `round_ended` | Runda završena (sadrži sve pogotke i scoreove) |
| S → C | `game_over` | Igra završena (sortirana lista igrača) |
| S → C | `spectator_pin_move` | Pozicija igrača za spektatore u realnom vremenu |
| S → C | `error` | Greška — nevaljan event, nevalidna poruka |

---

### 2.4 GameHandler — routovanje eventi

```typescript
// api/src/websocket/handlers/game.handler.ts

@Service()
export class GameHandler {
  constructor(
    private readonly roomRepository: RoomRepository,
    private readonly gameService: GameService,
    private readonly roomService: RoomService,
  ) {}

  async handle(client: AuthenticatedClient, event: string, data: Record<string, unknown>): Promise<void> {
    switch (event) {
      case 'join_room':         return this.onJoinRoom(client, data as { roomCode: string });
      case 'leave_room':        return this.onLeaveRoom(client);
      case 'send_message':      return this.onSendMessage(client, data as { text: string });
      case 'send_team_message': return this.onSendTeamMessage(client, data as { text: string });
      case 'join_team':         return this.onJoinTeam(client, data as { teamId: number });
      case 'pin_move':          return this.onPinMove(client, data as { lat: number; lng: number });
      default:
        client.send(JSON.stringify({ event: 'error', data: { message: `Unknown event: ${event}` } }));
    }
  }
```

#### Catch-up mehanizam pri reconnektu

Ako se igrač diskonektuje tokom igre i ponovo se poveže, `onJoinRoom` mu šalje odgovarajući event za trenutni status sobe. Time igrač dobija tačan state bez refresha stranice:

```typescript
private async onJoinRoom(client: AuthenticatedClient, data: { roomCode: string }): Promise<void> {
  // ... dodaje igrača ili ažurira connected status ...

  // Šalje kompletan room state i istoriju chata
  client.send(JSON.stringify({ event: 'joined_room', data: this.serializeRoom(updatedRoom) }));
  client.send(JSON.stringify({ event: 'chat_history', data: { messages: updatedRoom.messages ?? [] } }));

  // Catch-up: šalje state-restoring event zavisno od statusa sobe
  if (catchUpRoom.status === 'playing') {
    const round = catchUpRoom.rounds[catchUpRoom.currentRoundIndex];
    if (round?.location) {
      client.send(JSON.stringify({
        event: 'round_started',
        data: {
          round: this.gameService.serializeRoundForClient(round as RoundWithLocation),
          roundIndex: catchUpRoom.currentRoundIndex,
          totalRounds: catchUpRoom.totalRounds,
          durationSeconds: catchUpRoom.roundDurationSeconds,
          gameMode: catchUpRoom.gameMode,
          eliminatedPlayerIds: catchUpRoom.eliminatedPlayerIds ?? [],
        },
      }));
    }
  } else if (catchUpRoom.status === 'round_results') {
    // šalje round_ended sa svim pogocima
  } else if (catchUpRoom.status === 'game_over') {
    // šalje game_over sa finalnom tabelom
  }
}
```

#### Broadcast specifičan za timove

```typescript
private async onSendTeamMessage(client: AuthenticatedClient, data: { text: string }): Promise<void> {
  const room = await this.roomRepository.findByCode(client.roomCode);
  const sender = room.players.find((p) => p.userId === client.userId);
  if (!sender?.teamId) return;

  // Filtrira klijente — šalje samo igračima iz istog tima
  const teamClients = getClientsInRoom(client.roomCode).filter((c) => {
    const p = room.players.find((pl) => pl.userId === c.userId);
    return p?.teamId === sender.teamId;
  });

  const payload = JSON.stringify({ event: 'new_team_message', data: message });
  teamClients.forEach((c) => c.send(payload));
}
```

---

### 2.5 Frontend WebSocket klijent — SocketClient klasa

```typescript
// webapp/src/modules/socket/index.ts

class SocketClient {
  private ws: WebSocket | null = null;
  private listeners = new Map<string, Set<EventHandler>>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private token: string | null = null;
  private everConnected = false;
  private pendingMessages: string[] = [];  // čeka da soket bude spreman

  connect(token: string): void {
    this.token = token;
    this.ws = new WebSocket(`${WS_URL}?token=${token}`);  // JWT u query stringu

    this.ws.onopen = () => {
      // Flush poruka koje su poslate pre nego što je soket bio spreman
      const pending = this.pendingMessages.splice(0);
      pending.forEach((msg) => this.ws!.send(msg));

      if (this.everConnected) {
        this.emit('_reconnected', {});  // interni event — GameContext re-joinuje sobu
      }
      this.everConnected = true;
    };

    this.ws.onmessage = (msg) => {
      try {
        const { event, data } = JSON.parse(msg.data);
        this.emit(event, data);  // distribuira svim registrovanim listenerima
      } catch { /* ignoriše nevalidne poruke */ }
    };

    this.ws.onclose = () => {
      if (this.token) {
        // Auto-reconnect nakon 3 sekunde
        this.reconnectTimer = setTimeout(() => this.connect(this.token!), 3000);
      }
    };

    this.ws.onerror = () => this.ws?.close(); // onerror uvek prati onclose
  }

  send(event: string, data: unknown): void {
    const msg = JSON.stringify({ event, data });
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(msg);
    } else {
      this.pendingMessages.push(msg); // buffer dok soket nije spreman
    }
  }

  // Vraća unsubscribe funkciju — čist cleanup pattern
  on(event: string, handler: EventHandler): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(handler);
    return () => this.listeners.get(event)?.delete(handler);
  }
}

const socket = new SocketClient();
export default socket; // singleton — jedna konekcija za celu aplikaciju
```

Ključne karakteristike implementacije:
- **Singleton** — jedna WebSocket konekcija za celu React aplikaciju
- **pendingMessages buffer** — poruke poslate pre `onopen` se ne gube
- **Auto-reconnect** — `onclose` pokušava ponovo svake 3 sekunde
- **`_reconnected` interni event** — GameContext reaguje tako što ponovo pošalje `join_room` i dobije catch-up state

---

### 2.6 GameContext — upravljanje stanjem na frontendu

`GameContext` je centralno mesto koje prima sve WebSocket evente i distribuira ih kroz React state.

#### useReducer za predvidivo upravljanje stanjem

Umesto više `useState` hook-ova, ceo state igre se drži u jednom `GameState` objektu, a menja se kroz `dispatch` akcija. Ovo obezbeđuje predvidive tranzicije stanja:

```typescript
// webapp/src/context/GameContext.tsx

interface GameState {
  room: Room | null;
  currentRound: Round | null;
  roundIndex: number;
  totalRounds: number;
  durationSeconds: number;
  status: GameStatus;           // 'waiting' | 'countdown' | 'playing' | 'round_results' | 'game_over'
  countdownSeconds: number;
  myGuess: { lat: number; lng: number } | null;
  myGuessResult: { distanceKm: number; roundScore: number } | null;
  roundResults: { round: Round; players: Player[]; isLastRound: boolean } | null;
  finalResults: { players: Player[] } | null;
  allRoundResults: RoundSummary[];
  messages: ChatMessage[];
  eliminatedPlayerIds: string[];
  livePlayerPins: LivePin[];    // za spektatorsku mapu
}
```

#### Registracija WebSocket listenera

Svi listeneri se registruju jednom u `useEffect`, a svaki vraća unsubscribe funkciju:

```typescript
useEffect(() => {
  const unsubs = [
    socket.on('_reconnected', () => {
      if (roomCodeRef.current) {
        socket.send('join_room', { roomCode: roomCodeRef.current }); // catch-up
      }
    }),
    socket.on('round_started', (data) => {
      const d = data as { round: Round; roundIndex: number; totalRounds: number; ... };
      setHintResults({});
      dispatch({ type: 'ROUND_STARTED', round: d.round, roundIndex: d.roundIndex, ... });
    }),
    socket.on('round_ended', (data) => {
      setIsSubmittingGuess(false);
      dispatch({ type: 'ROUND_ENDED', round: d.round, players: d.players, ... });
    }),
    socket.on('spectator_pin_move', (data) => {
      dispatch({ type: 'PIN_MOVE', pin: data as LivePin }); // live pozicija igrača
    }),
    // ... ostali eventi
  ];
  return () => unsubs.forEach((u) => u()); // cleanup pri unmount
}, []);
```

#### Primer: submitGuess — hibridni flow (HTTP + WS)

Pogodak se šalje kao **HTTP POST** (jer treba response sa distanceKm i roundScore), ali rezultat vidljiv svim igračima dolazi kroz **WebSocket** (`round_ended`):

```typescript
const submitGuess = useCallback(async (lat: number, lng: number) => {
  dispatch({ type: 'GUESS_PENDING', lat, lng }); // odmah prikazuje pin na mapi
  setIsSubmittingGuess(true);
  try {
    // HTTP poziv — backend računa distancu i skor, vraća samo ovom igraču
    const result = await gameApi.submitGuess(roomCode, lat, lng);
    dispatch({ type: 'GUESS_RESULT', distanceKm: result.distanceKm, roundScore: result.roundScore });
    // Kada svi igrači pogode, backend emituje 'round_ended' svima kroz WS
  } catch (err) { ... }
}, []);
```

#### Session persistence — preživljava page refresh

State se persistuje u `sessionStorage` pa igrač koji osvežiti stranicu ne gubi kontekst:

```typescript
// Čuva state (osim countdown i live pinova — ti su efemerni)
function persistState(state: GameState): void {
  const { countdownSeconds, roundCountdown, messages, livePlayerPins, ...toSave } = state;
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(toSave));
}

// Inicijalizacija — učitava persisted state ako postoji
function makeInitialState(): GameState {
  const persisted = loadPersistedState();
  if (persisted?.room) return { ...initialState, ...persisted };
  return initialState;
}
```

---

### 2.7 Tok igre od starta do kraja

```
Host → POST /game/start
    ↓
GameService.startGame()
    → broadcastToRoom('game_countdown', { seconds: 3 })   // ← svi klijenti čuju
    → setInterval svaku sekundu → broadcastToRoom('countdown_tick', { remaining })
    → po odbrojavanju → startRound(roomCode, 0)

GameService.startRound()
    → LocationService.getOneLocation()   // FamousLocationProvider ili WorldLocationProvider
    → RoomRepository.setRoundLocation()
    → RoomRepository.updateCurrentRound()
    → broadcastToRoom('round_started', { round, roundIndex, durationSeconds, ... })
    → setTimeout(endRound, durationSeconds * 1000)     // tajmer za kraj runde

Igrač → POST /game/guess  { lat, lng }
    → GameService.submitGuess()
    → haversineDistance()              // geografska udaljenost u km
    → ScoringContext.calculate()       // Strategy + Decoratori
    → RoomRepository.addGuessToRound()
    → RoomRepository.updatePlayerScore()
    → ako su svi pogodili → GameService.endRound()   // pre tajmera

GameService.endRound()
    → broadcastToRoom('round_ended', { round, players, isLastRound, elimination? })

Host → POST /game/next-round
    → broadcastToRoom('round_countdown', { seconds: 3 })
    → po odbrojavanju → startRound(roomCode, nextIndex)

[ili ako je poslednja runda]
    → GameService.triggerGameOver()
    → notifyGameOver()   // Observer pattern: LeaderboardObserver + BroadcastObserver
    → BroadcastObserver → broadcastToRoom('game_over', { players })
    → LeaderboardObserver → UserRepository.updateScore() za svakog igrača
```

---

## 3. Projektni obrasci

### 3.1 Factory Method — izbor provajdera lokacija

#### Problem koji se rešava

`GameService` mora da dobije lokaciju za svaku rundu, ali postoje dva načina:
- **Famous** — statička lista poznatih turističkih mesta
- **World** — nasumična Street View lokacija sa Google API-ja

Bez obrasca bi `GameService` morao da zna za oba providera i sam proveravao koji da koristi:

```typescript
// Loše rešenje — bez obrasca
async startRound(roomCode, roundIndex) {
  let location;
  if (room.locationMode === 'famous') {
    location = shuffleArray(FAMOUS_LOCATIONS)[0]; // direktna zavisnost
  } else if (room.locationMode === 'world') {
    location = await cachedRepo.pickRandom();      // direktna zavisnost
    if (!location) location = await googleSV.find(...);
  }
  // GameService zna za implementaciju oba provajdera
  // Dodavanje trećeg moda zahteva izmenu GameService
}
```

#### Rešenje sa Factory Method

```
«interface»
ILocationProvider
  + getLocation(): Promise<Location>
        ↑                 ↑
FamousLocationProvider   WorldLocationProvider


«abstract»
LocationProviderFactory
  + createProvider(mode): ILocationProvider   ← factory method
  + getLocation(mode): Promise<Location>      ← poziva createProvider pa getLocation
        ↑
GameLocationProviderFactory  ← konkretni kreator, zna koji provider da napravi
```

```typescript
// api/src/patterns/factory/location-provider.interface.ts
export interface ILocationProvider {
  getLocation(): Promise<Location>;
}

// Apstraktni kreator — deklariše factory metodu, ali ne implementira je
export abstract class LocationProviderFactory {
  abstract createProvider(mode: LocationMode): ILocationProvider;

  async getLocation(mode: LocationMode): Promise<Location> {
    const provider = this.createProvider(mode); // delegira odluku subklasi
    return provider.getLocation();
  }
}

// Konkretni kreator — zna koji provider da kreira za koji mode
@Service()
export class GameLocationProviderFactory extends LocationProviderFactory {
  private readonly famousProvider: FamousLocationProvider;
  private readonly worldProvider: WorldLocationProvider;

  constructor(cachedLocationRepo: CachedLocationRepository, googleSV: GoogleStreetViewService) {
    super();
    this.famousProvider = new FamousLocationProvider();
    this.worldProvider  = new WorldLocationProvider(cachedLocationRepo, googleSV);
  }

  createProvider(mode: LocationMode): ILocationProvider {
    switch (mode) {
      case 'famous': return this.famousProvider;
      case 'world':  return this.worldProvider;
      default: throw new Error(`Unknown location mode: ${mode}`);
    }
  }
}
```

```typescript
// LocationService — ne zna koji provider se koristi
@Service()
export class LocationService {
  constructor(private readonly factory: GameLocationProviderFactory) {}

  async getOneLocation(mode: LocationMode): Promise<Location> {
    return this.factory.getLocation(mode); // samo delegira fabrici
  }
}

// GameService koristi LocationService — dvostruka izolacija
const location = await this.locationService.getOneLocation(room.locationMode ?? 'famous');
```

#### Prednosti

- `GameService` ne zna ništa o `FamousLocationProvider` ni `WorldLocationProvider`
- Dodavanje trećeg moda (npr. `'capitals'`) zahteva samo: novu klasu koja implementira `ILocationProvider` + jedan `case` u `createProvider`
- `WorldLocationProvider` ima kompleksnu logiku (cache, background fill, Google API) — `GameService` je nesvestan svega toga

#### Mane

- Dodaje slojeve indirekcije — za debugovanje treba pratiti: `GameService → LocationService → Factory → Provider`
- Ako će ikada biti samo jedan provajder, fabrika je over-engineering

---

### 3.2 Decorator — konfiguracija igre i scoring

U projektu postoje **dva odvojena** Decorator upotrebe sa istom motivacijom — dinamično dodavanje funkcionalnosti bez nasledjivanja.

#### 3.2a GameSetup Decorator — konfiguracija sobe

##### Problem

Soba može biti kombinacija: Standard ili Elimination × sa/bez hintova × sa/bez timova × sa/bez spektatora. To je 2³ = 8 kombinacija. Nasledjivanje bi zahtevalo 8 klasa:

```
StandardGame
StandardGameWithHints
StandardGameWithHintsAndTeams
EliminationGame
EliminationGameWithHints
... (8 klasa ukupno)
```

Svako dodavanje novog feature-a duplira broj klasa.

##### Rešenje

```typescript
// api/src/patterns/game-setup/game-setup.interface.ts
export interface IGameSetup {
  describe(): string;
  buildConfig(): GameSettings;
}

// Bazni Decorator — drži referencu na umotani IGameSetup
export abstract class GameSetupDecorator implements IGameSetup {
  constructor(protected readonly game: IGameSetup) {}
  describe(): string { return this.game.describe(); }
  buildConfig(): GameSettings { return this.game.buildConfig(); }
}

// Konkretni dekoratori — svaki dodaje samo svoju izmenu
export class HintsDecorator extends GameSetupDecorator {
  describe() { return `${this.game.describe()} + Hints`; }
  buildConfig() { return { ...this.game.buildConfig(), hintsEnabled: true }; }
}

export class TeamsDecorator extends GameSetupDecorator {
  constructor(game: IGameSetup, private readonly teamSize: number = 2) { super(game); }
  describe() { return `${this.game.describe()} + Teams (${this.teamSize}v${this.teamSize})`; }
  buildConfig() { return { ...this.game.buildConfig(), teamsEnabled: true, teamSize: this.teamSize }; }
}

export class SpectatorDecorator extends GameSetupDecorator {
  describe() { return `${this.game.describe()} + Spectators`; }
  buildConfig() { return { ...this.game.buildConfig(), spectatorsAllowed: true }; }
}
```

##### Upotreba u RoomService

```typescript
// api/src/services/room.service.ts

async createRoom(...) {
  // Korak 1: Bazi objekat zavisno od game moda
  let gameSetup: IGameSetup = gameMode === 'elimination'
    ? new EliminationGameSetup()
    : new StandardGameSetup();

  // Korak 2: Slaganje dekoratora — svaki umotava prethodni
  if (hintsEnabled)       gameSetup = new HintsDecorator(gameSetup);
  if (spectatorsAllowed)  gameSetup = new SpectatorDecorator(gameSetup);
  if (teamsEnabled)       gameSetup = new TeamsDecorator(gameSetup, teamSize);

  // Rezultat: Elimination + Hints + Spectators — bez jedne klase koja ih sve kombinuje
  const gameSettings = gameSetup.buildConfig();
  // gameSettings = { gameMode: 'elimination', hintsEnabled: true, spectatorsAllowed: true, ... }
}
```

`describe()` se slaže lančano: `"Elimination + Hints + Teams (2v2)"` — korisno za logovanje i debug.

---

#### 3.2b Scoring Decorator — modifikatori bodova

##### Problem

Scoring formula se razlikuje po game modu (standard vs elimination), ali oba moda mogu imati hint penale i accuracy bonuse. Nasledjivanjem:

```
DistanceStrategy → DistanceWithHintPenalty → DistanceWithHintPenaltyAndAccuracyBonus
TimeBonusStrategy → TimeBonusWithHintPenalty → ...
```

Opet kombinatorijalna eksplozija.

##### Rešenje

```typescript
// api/src/patterns/scoring/scoring.decorator.ts
export abstract class ScoringDecorator implements ScoringStrategy {
  constructor(protected readonly strategy: ScoringStrategy) {}
  calculate(input: ScoringInput): number { return this.strategy.calculate(input); }
}

// Dve nezavisne strategije
export class DistanceScoringStrategy implements ScoringStrategy {
  calculate({ distanceKm }: ScoringInput): number {
    // Kvadratni pad skora po distanci: 5000 * (1 - km/20000)²
    const ratio = Math.max(0, 1 - distanceKm / MAX_DISTANCE_KM);
    return Math.round(MAX_SCORE_PER_ROUND * Math.pow(ratio, 2));
  }
}

export class TimeBonusScoringStrategy implements ScoringStrategy {
  calculate({ distanceKm, timeTakenSeconds, roundDurationSeconds }: ScoringInput): number {
    const distanceRatio = Math.max(0, 1 - distanceKm / MAX_DISTANCE_KM);
    const timeRatio     = Math.max(0, 1 - timeTakenSeconds / roundDurationSeconds);
    // 70% distanca + 30% brzina
    return Math.round(MAX_SCORE_PER_ROUND * (0.7 * Math.pow(distanceRatio, 2) + 0.3 * timeRatio));
  }
}

// Hint penalizacija: -15% po iskorišćenom hintu (kumulativno)
export class HintPenaltyDecorator extends ScoringDecorator {
  calculate(input: ScoringInput): number {
    const base = this.strategy.calculate(input);
    const multiplier = Math.pow(1 - 0.15, input.hintsUsed ?? 0);
    // 1 hint: × 0.85 = -15%
    // 2 hinta: × 0.72 = -28%
    return Math.round(base * multiplier);
  }
}

// Accuracy bonus: +20% za pogodak unutar 100 km
export class AccuracyBonusDecorator extends ScoringDecorator {
  calculate(input: ScoringInput): number {
    const base = this.strategy.calculate(input);
    if (input.distanceKm <= 100) return Math.round(base * 1.20);
    return base;
  }
}
```

##### Slaganje u GameService

```typescript
// api/src/services/game.service.ts — pri startGame()

// Korak 1: Odabir bazne strategije po game modu
let finalStrategy: ScoringStrategy =
  gameMode === 'elimination'
    ? new TimeBonusScoringStrategy()   // Elimination: brzina je važna
    : new DistanceScoringStrategy();   // Standard: samo distanca

// Korak 2: Kondicionalno slaganje dekoratora
if (room.hintsEnabled) {
  finalStrategy = new HintPenaltyDecorator(finalStrategy); // umotava strategiju
}
finalStrategy = new AccuracyBonusDecorator(finalStrategy); // uvek aktivan

// Korak 3: Ubacivanje u Context i čuvanje za celu partiju
const scoringContext = new ScoringContext();
scoringContext.setStrategy(finalStrategy);
scoringContexts.set(roomCode, scoringContext); // in-memory mapa: roomCode → context

// Pri submitGuess():
const context = scoringContexts.get(roomCode) ?? new ScoringContext();
const roundScore = context.calculate({ distanceKm, timeTakenSeconds, roundDurationSeconds, hintsUsed });
```

Lanac poziva za Elimination igru sa hintovima (2 korišćena), pogodak 50 km:
```
AccuracyBonusDecorator.calculate()
    → HintPenaltyDecorator.calculate()
        → TimeBonusScoringStrategy.calculate()
            → vraća: 3200
        → × 0.72 (2 hinta) = 2304
    → 50 km < 100 km → × 1.20 = 2764
```

#### Prednosti Decorator upotrebe

- Svaki dekorator ima jednu odgovornost
- Kombinacije se menjaju u runtime-u bez novih klasa
- Lako testabilno — svaki dekorator testira se u izolaciji

#### Mane

- Redosled slaganja je bitan — `AccuracyBonusDecorator` mora biti spolja (primenjuje se na finalni skor)
- Teže debugovanje — greška u formuli zahteva praćenje celog lanca

---

### 3.3 Observer — obaveštenja pri kraju igre

#### Problem koji se rešava

Kada igra završi, potrebno je:
1. Emitovati `game_over` WebSocket event svim igračima
2. Ažurirati globalni leaderboard u bazi

Bez obrasca, `GameService` bi direktno pozivao obe operacije, što znači direktnu zavisnost od `UserRepository` i WebSocket infrastrukture. Svaka nova operacija na kraju igre (email notifikacija, statistike...) zahteva izmenu `GameService`.

#### Rešenje

```typescript
// api/src/patterns/observer/game-observer.interface.ts
export interface GameOverEvent {
  roomId: string;
  roomCode: string;
  players: Player[];
}

export interface GameObserver {
  onGameOver(event: GameOverEvent): Promise<void>;
}

// Subject — apstraktna klasa koja upravlja listom observera
export abstract class GameEventSubject {
  private observers: GameObserver[] = [];

  registerObserver(obs: GameObserver): void { this.observers.push(obs); }
  unregisterObserver(obs: GameObserver): void {
    this.observers = this.observers.filter((o) => o !== obs);
  }

  protected async notifyGameOver(event: GameOverEvent): Promise<void> {
    await Promise.all(this.observers.map((obs) => obs.onGameOver(event)));
    // Paralelno poziva sve observere — ni jedan ne blokira drugi
  }
}
```

```typescript
// GameService extends GameEventSubject — dobija notifyGameOver()
@Service()
export class GameService extends GameEventSubject {
  constructor(
    private readonly roomRepository: RoomRepository,
    private readonly locationService: LocationService,
    leaderboardObserver: LeaderboardObserver,
    broadcastObserver: BroadcastObserver,
  ) {
    super();
    this.registerObserver(leaderboardObserver);
    this.registerObserver(broadcastObserver);
  }

  private async triggerGameOver(roomId: string, roomCode: string): Promise<void> {
    scoringContexts.delete(roomCode);
    await this.roomRepository.setStatus(roomId, 'game_over');
    const finalRoom = await this.roomRepository.findByCode(roomCode);

    // Jedan poziv — notifikuje sve registrovane observere
    await this.notifyGameOver({ roomId, roomCode, players: finalRoom.players });
  }
}
```

```typescript
// Observer 1 — ažurira globalni leaderboard
@Service()
export class LeaderboardObserver implements GameObserver {
  constructor(private readonly userRepository: UserRepository) {}

  async onGameOver(event: GameOverEvent): Promise<void> {
    await Promise.all(
      event.players.map((player) =>
        this.userRepository.updateScore(player.userId, player.score),
      ),
    );
  }
}

// Observer 2 — broadcastuje game_over event svim klijentima
@Service()
export class BroadcastObserver implements GameObserver {
  async onGameOver(event: GameOverEvent): Promise<void> {
    const sorted = [...event.players].sort((a, b) => b.score - a.score);
    broadcastToRoom(event.roomCode, 'game_over', { players: sorted });
  }
}
```

#### Prednosti

- `GameService` ne zna da postoje `UserRepository` ni WebSocket — samo zna za `GameObserver` interfejs
- Novi feature (npr. email posle igre) = nova klasa koja implementira `GameObserver` + jedna linija `registerObserver`
- Observeri se izvršavaju paralelno (`Promise.all`)

#### Mane

- Ako observer baci grešku, `Promise.all` odbacuje ceo poziv — za produkcijsku upotrebu svaki observer treba da hvata greške interno
- Redosled notifikacija nije garantovan (Promise.all je paralelno) — ako bi jedan observer zavisio od drugog, to bi bio problem

---

### 3.4 Strategy — algoritmi bodovanja

Strategy je usko povezan sa Decorator-om prikazanim u 3.2b, ali vredi naglasiti aspekt koji Strategy donosi sam po sebi.

**Ključna razlika između dva pristupa bodovanju:**

```typescript
// DistanceScoringStrategy — samo distanca
calculate({ distanceKm }: ScoringInput): number {
  const ratio = Math.max(0, 1 - distanceKm / MAX_DISTANCE_KM);
  return Math.round(MAX_SCORE_PER_ROUND * Math.pow(ratio, 2));
  // 0 km → 5000 poena; 10000 km → 1250 poena; 20000 km → 0 poena
}

// TimeBonusScoringStrategy — distanca + brzina (nezavisna implementacija)
calculate({ distanceKm, timeTakenSeconds, roundDurationSeconds }: ScoringInput): number {
  const distanceRatio = Math.max(0, 1 - distanceKm / MAX_DISTANCE_KM);
  const timeRatio     = Math.max(0, 1 - timeTakenSeconds / roundDurationSeconds);
  return Math.round(MAX_SCORE_PER_ROUND * (0.7 * Math.pow(distanceRatio, 2) + 0.3 * timeRatio));
  // Isti pogodak, ali brži igrač dobija više poena
}
```

Bez Strategy-ja, `GameService` bi imao `if (gameMode === 'elimination') { formula1 } else { formula2 }` rasute kroz kod. Sa Strategy-jem, `ScoringContext` jednostavno poziva `this.strategy.calculate()` — ne zna ništa o formuli.

**`ScoringContext` se kreira jednom pri `startGame` i čuva kroz celu partiju:**

```typescript
// in-memory mapa: roomCode → ScoringContext
const scoringContexts = new Map<string, ScoringContext>();

// Kreira se jednom i živi dok igra traje
scoringContexts.set(roomCode, scoringContext);

// Svaki pogodak koristi isti context
const context = scoringContexts.get(roomCode) ?? new ScoringContext();
const roundScore = context.calculate({ distanceKm, timeTakenSeconds, roundDurationSeconds, hintsUsed });

// Briše se kada igra završi
scoringContexts.delete(roomCode); // u triggerGameOver()
```

---

### 3.5 Dependency Injection (TypeDI)

Nije klasičan GoF uzorak, ali je prisutan kroz ceo backend i vredi objasniti.

`@Service()` dekorator iz `typedi` biblioteke markira klasu kao singleton koji IoC kontejner instancira i injektuje automatski:

```typescript
@Service()
export class GameService extends GameEventSubject {
  constructor(
    private readonly roomRepository: RoomRepository,       // TypeDI injektuje
    private readonly locationService: LocationService,     // TypeDI injektuje
    leaderboardObserver: LeaderboardObserver,              // TypeDI injektuje
    broadcastObserver: BroadcastObserver,                  // TypeDI injektuje
  ) { ... }
}

// Korišćenje u rutama — Container.get() vraća singleton instancu
const gameService = () => Container.get(GameService);
```

Bez DI:
```typescript
// Bez DI — ručno kreiranje zavisnosti (anti-pattern)
const userRepo = new UserRepository();
const roomRepo = new RoomRepository();
const locationService = new LocationService(new GameLocationProviderFactory(...));
const gameService = new GameService(roomRepo, locationService, ...);
```

DI smanjuje coupling između klasa i čini testiranje lakšim — u testovima se može injektovati mock umesto realnog repositorija.

---

### 3.6 Pregled svih obrazaca i njihove lokacije

| Obrazac | Lokacija | Uloga |
|---|---|---|
| **Factory Method** | `patterns/factory/` | Izbor `FamousLocationProvider` vs `WorldLocationProvider` po `LocationMode` |
| **Decorator (GameSetup)** | `patterns/game-setup/` | Kombinovanje opcija sobe (Hints, Spectators, Teams) bez nasledjivanja |
| **Decorator (Scoring)** | `patterns/scoring/` | Slaganje hint penala i accuracy bonusa povrh bazne scoring strategije |
| **Strategy** | `patterns/scoring/` | Zamenjivi algoritmi bodovanja (`DistanceScoringStrategy`, `TimeBonusScoringStrategy`) |
| **Observer** | `patterns/observer/` | `LeaderboardObserver` i `BroadcastObserver` reaguju na kraj igre |
| **Repository** | `database/repositories/` | `BaseRepository<T>` + `RoomRepository` — apstrakcija nad Mongoose |
| **Dependency Injection** | ceo backend | TypeDI `@Service()` — upravljanje lifecycle-om servisa i zavisnostima |
