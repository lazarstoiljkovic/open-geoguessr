# Open GeoGuessr — Dokumentacija

## Sadržaj

1. [Pokretanje aplikacije](#pokretanje-aplikacije)
2. [Testiranje](#testiranje)
3. [Struktura projekta](#struktura-projekta)
4. [Arhitekturni obrasci](#arhitekturni-obrasci)
5. [WebSocket protokol](#websocket-protokol)
6. [Game flow](#game-flow)
7. [API referenca](#api-referenca)
8. [Slobodni API-ji za lokacije](#slobodni-api-ji-za-lokacije)

---

## Pokretanje aplikacije

### Preduslovi

| Alat | Verzija |
|------|---------|
| Node.js | 18+ (preporučeno 21.x) |
| MongoDB | 6+ (lokalni ili Atlas) |
| Yarn | 1.x |

### 1. MongoDB

```bash
# macOS (Homebrew)
brew services start mongodb-community

# ili direktno
mongod --dbpath /usr/local/var/mongodb
```

### 2. Backend (`api/`)

```bash
cd api

# Kopiraj .env i podesi po potrebi
cp .env.example .env

# Instaliraj zavisnosti
yarn install

# Development mode (hot-reload)
yarn dev
# → HTTP:      http://localhost:4000
# → WebSocket: ws://localhost:4000
```

**Dostupne skripte:**

| Skripta | Opis |
|---------|------|
| `yarn dev` | Dev server sa ts-node-dev (hot-reload) |
| `yarn build` | TypeScript kompajliranje u `dist/` |
| `yarn start` | Pokretanje kompajliranog builda |
| `yarn lint` | ESLint provera |

### 3. Frontend (`webapp/`)

```bash
cd webapp

# Instaliraj zavisnosti
yarn install

# Development server
yarn start
# → http://localhost:3000

# Production build
yarn build
```

**Environment varijable** (`.env`):

```env
REACT_APP_API_URL=http://localhost:4000/api
REACT_APP_WS_URL=ws://localhost:4000
```

---

## Testiranje

### Ručno testiranje (flow igre)

> Otvori dva browser prozora da testiraš multiplayer

**1. Registracija i login**

```
POST http://localhost:4000/api/auth/register
Content-Type: application/json

{ "username": "player1", "email": "p1@test.com", "password": "test123" }
```

**2. Kreiranje sobe**

```
POST http://localhost:4000/api/rooms/create
Authorization: Bearer <token>
Content-Type: application/json

{ "mode": "classic" }       // classic | time-attack | world
```

**3. Pridruživanje sobi**

```
POST http://localhost:4000/api/rooms/join
Authorization: Bearer <token>

{ "code": "ABC123" }
```

**4. WebSocket konekcija**

```javascript
// Browser konzola
const ws = new WebSocket('ws://localhost:4000?token=<jwt_token>');
ws.onmessage = (msg) => console.log(JSON.parse(msg.data));

// Pridruži se sobi
ws.send(JSON.stringify({ event: 'join_room', data: { roomCode: 'ABC123' } }));

// Pošalji guess (lat/lng Pariza)
ws.send(JSON.stringify({ event: 'submit_guess', data: { lat: 48.85, lng: 2.35 } }));
```

**5. Leaderboard**

```
GET http://localhost:4000/api/leaderboard
```

### Testiranje sa curl

```bash
# Registracija
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","email":"test@test.com","password":"test123"}'

# Login i sačuvaj token
TOKEN=$(curl -s -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

# Kreiraj sobu
curl -X POST http://localhost:4000/api/rooms/create \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mode":"world"}'
```

### TypeScript provera (bez pokretanja)

```bash
# Backend
cd api && node_modules/.bin/tsc --noEmit

# Frontend  
cd webapp && node_modules/.bin/tsc --noEmit
```

---

## Struktura projekta

```
open-geoguessr/
├── api/                              # Backend
│   └── src/
│       ├── server.ts                 # Entry point, HTTP + WS bootstrap
│       ├── app.ts                    # Koa app, middleware stack
│       ├── constants/
│       │   └── index.ts              # ROUND_DURATION, MAX_SCORE, itd.
│       ├── types/
│       │   └── index.ts              # Globalni TypeScript tipovi
│       ├── database/
│       │   ├── models/
│       │   │   ├── user.model.ts     # Mongoose User schema
│       │   │   └── room.model.ts     # Mongoose Room schema (igra, runde, guessovi)
│       │   └── repositories/
│       │       ├── user.repository.ts   # CRUD + leaderboard query
│       │       └── room.repository.ts   # Sva logika sobe u bazi
│       ├── routes/
│       │   ├── index.ts              # Kompozicija svih ruta
│       │   ├── auth.routes.ts        # POST /auth/register, /auth/login
│       │   ├── rooms.routes.ts       # POST /rooms/create, /rooms/join; GET /rooms/:code
│       │   └── leaderboard.routes.ts # GET /leaderboard
│       ├── services/
│       │   ├── auth.service.ts       # Bcrypt + JWT logika
│       │   ├── room.service.ts       # Kreiranje/pridruživanje sobi
│       │   └── location.service.ts   # Wikipedia geo-search + curated lokacije
│       ├── websocket/
│       │   ├── ws.server.ts          # WS server, auth handshake, broadcast helpers
│       │   └── handlers/
│       │       └── game.handler.ts   # Svi WS eventi, timeri, scoring
│       ├── patterns/
│       │   ├── scoring/
│       │   │   ├── scoring.strategy.ts    # Interface ScoringStrategy
│       │   │   ├── distance.strategy.ts   # Bodovanje po distanci
│       │   │   └── time-bonus.strategy.ts # Distanca + time bonus
│       │   └── factory/
│       │       └── game.factory.ts    # Kreiranje game config po modu
│       ├── middlewares/
│       │   └── auth.middleware.ts    # JWT verifikacija za HTTP rute
│       ├── loaders/
│       │   └── mongo.loader.ts       # MongoDB konekcija
│       └── utils/
│           ├── geo.utils.ts          # Haversine formula, shuffle, room code gen
│           └── jwt.utils.ts          # Sign/verify token
│
└── webapp/                           # Frontend
    └── src/
        ├── App.tsx                   # Root, BrowserRouter + Providers
        ├── index.tsx                 # ReactDOM.createRoot
        ├── types.ts                  # Globalni TypeScript tipovi
        ├── env.ts                    # API_URL, WS_URL iz env
        ├── api/
        │   ├── auth.api.ts           # register, login
        │   ├── rooms.api.ts          # createRoom, joinRoom, getRoom
        │   └── leaderboard.api.ts    # getLeaderboard
        ├── modules/
        │   └── socket/
        │       └── index.ts          # WebSocket klijent singleton, auto-reconnect
        ├── context/
        │   ├── AuthContext.tsx        # User, token, login/logout
        │   └── GameContext.tsx        # Reducer state machine za sve faze igre
        ├── hooks/
        │   ├── useCountdown.ts        # Lokalni timer hook
        │   └── useSocketEvent.ts      # WS event listener hook
        ├── router/
        │   └── index.tsx              # Sve rute aplikacije
        ├── pages/
        │   ├── Login/                 # Login forma
        │   ├── Register/              # Register forma
        │   ├── Lobby/                 # Kreiranje/pridruživanje sobi, odabir moda
        │   ├── Game/
        │   │   ├── Room.tsx           # Waiting room (pre igre)
        │   │   └── Game.tsx           # Gameplay, countdown, rezultati
        │   └── Leaderboard/           # Rang lista
        ├── components/
        │   ├── Layout/                # Header + nav wrapper
        │   ├── Map/
        │   │   └── GuessMap.tsx       # Leaflet mapa za klikanje i prikaz rezultata
        │   ├── Timer/                 # SVG kružni tajmer
        │   ├── Scoreboard/            # Lista igrača sa skorovima
        │   └── LocationGallery/       # Navigabilna galerija fotografija lokacije
        └── scss/
            ├── _variables.scss        # Boje, fontovi, razmaci
            └── _mixins.scss           # Reusable SCSS mixini
```

---

## Arhitekturni obrasci

### Repository pattern

Apstraktuje MongoDB operacije. Svaki repository ima metode koje odgovaraju domenskim operacijama:

```
UserRepository   → create, findByEmail, findByUsername, updateScore, getLeaderboard
RoomRepository   → create, findByCode, addPlayer, updateCurrentRound, addGuessToRound, ...
```

**Zašto**: Services i handlers ne znaju ništa o Mongoose-u. Ako se baza promeni, menja se samo repository.

### Strategy pattern (Scoring)

```
ScoringStrategy (interface)
    ├── DistanceScoringStrategy     → score = MAX * (1 - distance/MAX_DIST)²
    └── TimeBonusScoringStrategy    → DistanceScore + TimeBonus(1000 * timeRatio)
```

`GameFactory` bira koja strategija se koristi za dati mod igre.

### Factory pattern (GameFactory)

```typescript
GameFactory.create('classic')      // 30s po rundi, distance scoring
GameFactory.create('time-attack')  // 15s po rundi, time bonus scoring  
GameFactory.create('world')        // 30s, distance scoring, nasumične lokacije
```

### Observer pattern (WebSocket events)

Backend emituje eventi, frontend i backend slušaju bez direktne sprege:

```
Backend (ws.server.ts) →  broadcastToRoom(code, 'round_started', data)
Frontend (socket/index.ts) → socket.on('round_started', handler)
GameContext.tsx → dispatch(action) → state update → React re-render
```

### State machine (GameContext)

```
waiting ──start──► countdown ──0s──► playing ──all guessed / timeout──►
round_results ──next──► playing (loop) ... ──last round──► game_over
```

---

## WebSocket protokol

### Client → Server

| Event | Payload | Opis |
|-------|---------|------|
| `join_room` | `{ roomCode }` | Pridruži se sobi (i poveži WS klijenta sa sobom) |
| `leave_room` | `{}` | Napusti sobu |
| `start_game` | `{ mode? }` | Host pokreće igru |
| `submit_guess` | `{ lat, lng }` | Pošalji guess za trenutnu rundu |
| `next_round` | `{}` | Host prelazi na sledeću rundu |

### Server → Client

| Event | Payload | Opis |
|-------|---------|------|
| `connected` | `{ userId, username }` | Potvrda konekcije |
| `joined_room` | `Room` | Potvrda, dobijas celo stanje sobe |
| `room_updated` | `Room` | Igrač se pridružio/otišao/promenio status |
| `game_countdown` | `{ seconds: 3 }` | Countdown počinje |
| `countdown_tick` | `{ remaining }` | Svake sekunde |
| `round_started` | `{ round, roundIndex, totalRounds, durationSeconds }` | Nova runda (bez koordinata!) |
| `guess_acknowledged` | `{ distanceKm, roundScore }` | Tvoj guess primljen i scored |
| `round_ended` | `{ round (sa koordinatama!), players, isLastRound }` | Runda završena, prikaz rezultata |
| `game_over` | `{ players (sortirani po skoru) }` | Igra završena |
| `error` | `{ message }` | Greška |

---

## Game flow

```
[LOBBY]
  → POST /rooms/create  → dobij code
  → WS: join_room       → room_updated se emituje svim igračima

[WAITING ROOM]
  → Host klikne "Start Game"
  → WS: start_game      → backend fetchuje lokacije sa Wikipedia API
  → WS: game_countdown  → 3 sekunde countdown

[PLAYING]
  → WS: round_started   → prikazuje se galerija fotografija
  → Korisnik navigira kroz fotografije, klika na mapu, potvrdi guess
  → WS: submit_guess    → backend računa distancu + score (Strategy)
  → WS: guess_acknowledged → klijent dobija distanceKm + roundScore
  → Kad svi guess-uju (ili timeout) → WS: round_ended

[ROUND RESULTS]
  → Prikaz mape sa svim guess-ovima i tačnom lokacijom
  → Prikaz scoreboarda
  → Host klikne "Next Round" → WS: next_round
  → (ponavlja se za svaku rundu)

[GAME OVER]
  → WS: game_over → finalni scoreboard
  → Skorovi se snimaju u bazu (UserModel.totalScore += score)
```

---

## API referenca

### Auth

```
POST /api/auth/register
Body: { username, email, password }
Response: { token, user: { id, username, email } }

POST /api/auth/login
Body: { email, password }
Response: { token, user: { id, username, email } }
```

### Rooms

```
POST /api/rooms/create        [Auth required]
Body: { mode?: "classic" | "time-attack" | "world" }
Response: { room: { id, code, status, players, totalRounds } }

POST /api/rooms/join          [Auth required]
Body: { code }
Response: { room }

GET  /api/rooms/:code         [Auth required]
Response: { room }
```

### Leaderboard

```
GET /api/leaderboard
Response: { leaderboard: [{ rank, username, totalScore, gamesPlayed }] }
```

---

## Slobodni API-ji za lokacije

### Wikipedia REST API (curated famous landmarks)

```
GET https://en.wikipedia.org/api/rest_v1/page/summary/{title}
```

Vraća `thumbnail.source` — URL slike za stranu. Koristi se za 30+ čuvenih lokacija u kodu.

### Wikipedia Geo-search (nasumične lokacije)

```
GET https://en.wikipedia.org/w/api.php
  ?action=query
  &list=geosearch
  &gscoord={lat}|{lng}
  &gsradius=10000      # 10km radius
  &gslimit=5
  &format=json
  &origin=*
```

Vraća Wikipedia artikle blizu zadatih koordinata. Svaki artikal ima `pageid` i `title`.

### Wikipedia Page Thumbnail (iz geo-search resulta)

```
GET https://en.wikipedia.org/w/api.php
  ?action=query
  &titles={title}
  &prop=pageimages|extracts
  &pithumbsize=800
  &exintro=1
  &format=json
  &origin=*
```

Vraća `thumbnail.source` URL za datu stranicu. Kombinacijom geo-search + page thumbnail dobijamo besplatne fotografije svakog mesta na svetu.

**Nema API ključa, nema rate limit-a za razumno korišćenje.**
