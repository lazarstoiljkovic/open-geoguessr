# Open GeoGuessr — Projektni obrasci

Dokument opisuje primenjene projektne obrasce u domenskoj logici backend aplikacije,
sa UML strukturom, obrazloženjem i primerima proširenja.

---

## Sadržaj

1. [Factory Method](#1-factory-method)
2. [Strategy](#2-strategy)
3. [Decorator — Scoring](#3-decorator)
4. [Decorator — Game Setup](#4-decorator--game-setup)
5. [Observer — Game Lifecycle](#5-observer--game-lifecycle)
6. [Repository](#6-repository)

---

## 1. Factory Method

### Problem

`LocationService` je direktno odlučivao koju logiku za dohvatanje lokacije da koristi kroz
`if/else` u klijentskom kodu:

```typescript
// Naivno rešenje — klijent poznaje sve konkretne klase
async getOneLocation(mode: 'famous' | 'world'): Promise<Location> {
  return mode === 'world' ? this.getOneWorldLocation() : this.getOneFamousLocation();
}
```

Svaki novi tip lokacije zahtevao bi izmenu `LocationService`-a. Klijent je poznavao sve
konkretne implementacije.

---

### Rešenje

Selekcija je enkapsulirana u factory method `createProvider(mode)`. Klijent zna samo za
apstraktni `ILocationProvider` interfejs i apstraktni `LocationProviderFactory` — nikad za
konkretne klase.

Primenjena je **parametrizovana varijanta** Factory Method-a (jedna ConcreteCreator klasa,
bez paralelne hijerarhije kreatora).

---

### Učesnici

| Uloga | Klasa / Interface | Fajl |
|---|---|---|
| Product (apstraktni) | `ILocationProvider` | `patterns/factory/location-provider.interface.ts` |
| ConcreteProduct | `FamousLocationProvider` | `patterns/factory/providers/famous-location.provider.ts` |
| ConcreteProduct | `WorldLocationProvider` | `patterns/factory/providers/world-location.provider.ts` |
| Creator (apstraktni) | `LocationProviderFactory` | `patterns/factory/location-provider.factory.ts` |
| ConcreteCreator | `GameLocationProviderFactory` | `patterns/factory/location-provider.factory.ts` |
| Klijent | `LocationService` | `services/location.service.ts` |

---

### Struktura fajlova

```
src/patterns/factory/
├── location-provider.interface.ts     ← Product (apstraktni)
├── location-provider.factory.ts       ← Creator (apstraktni) + ConcreteCreator
└── providers/
    ├── famous-location.provider.ts    ← ConcreteProduct
    └── world-location.provider.ts     ← ConcreteProduct
```

---

### UML dijagram

```
«interface»
ILocationProvider
─────────────────
+ getLocation(): Promise<Location>
        ▲
        │ implements
   ─────┴──────────────────────────
   │                               │
FamousLocationProvider     WorldLocationProvider
──────────────────────     ─────────────────────
+ getLocation()            + getLocation()
                           + discoverAndSave()


LocationProviderFactory                 (abstract Creator)
────────────────────────────────────────
+ createProvider(mode): ILocationProvider   «abstract»
+ getLocation(mode): Promise<Location>      «template method»
        ▲
        │ extends
GameLocationProviderFactory             (ConcreteCreator)
────────────────────────────────────────
- famousProvider: FamousLocationProvider
- worldProvider: WorldLocationProvider
+ createProvider(mode): ILocationProvider
        │
        │ creates
        ├──────────────────► FamousLocationProvider
        └──────────────────► WorldLocationProvider
```

---

### Ključni kod

**Product (apstraktni)**
```typescript
export interface ILocationProvider {
  getLocation(): Promise<Location>;
}
```

**Creator (apstraktni) sa template metodom**
```typescript
export abstract class LocationProviderFactory {
  abstract createProvider(mode: LocationMode): ILocationProvider;

  // Template method — poziva factory method interno
  async getLocation(mode: LocationMode): Promise<Location> {
    return this.createProvider(mode).getLocation();
  }
}
```

**ConcreteCreator — parametrizovani factory method**
```typescript
@Service()
export class GameLocationProviderFactory extends LocationProviderFactory {
  constructor(cachedLocationRepo: CachedLocationRepository, googleSV: GoogleStreetViewService) {
    super();
    this.famousProvider = new FamousLocationProvider();
    this.worldProvider = new WorldLocationProvider(cachedLocationRepo, googleSV);
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

**Klijent — ne poznaje konkretne klase**
```typescript
@Service()
export class LocationService {
  constructor(private readonly factory: GameLocationProviderFactory) {}

  async getOneLocation(mode: LocationMode): Promise<Location> {
    return this.factory.getLocation(mode); // ne zna šta se dešava ispod
  }
}
```

---

### ConcreteProduct-i

**FamousLocationProvider**
Vraća nasumičnu lokaciju iz statičke liste 39 poznatih svetskih znamenitosti (Ajfelova
kula, Kolosesum, Machu Picchu...). Nema eksternih zavisnosti — potpuno deterministički.

**WorldLocationProvider**
Vraća nasumičnu lokaciju sa bilo kog mesta na svetu. Koristi Google Street View API za
verifikaciju postojanja panorame i interni MongoDB cache. Sadrži logiku za background refill
cache-a kada padne ispod praga od 20 lokacija.

---

### Potencijalna proširenja

Dodavanje novog tipa lokacije zahteva **samo novi fajl** i **jednu `case` liniju** u
`createProvider()`. `LocationService` i `GameService` se **ne menjaju**.

| Novi mode | Nova klasa | Opis |
|---|---|---|
| `'country'` | `CountryLocationProvider` | Lokacije unutar izabrane države, lat/lng bounding box po country code-u |
| `'europe'` | `EuropeLocationProvider` | Samo evropske lokacije, bias na gustinu Street View pokrivenosti |
| `'mapillary'` | `MapillaryLocationProvider` | Lokacije iz Mapillary izvora umesto Google Street View |

Primer dodavanja `CountryLocationProvider` bez ikakve izmene postojećeg koda:

```typescript
// 1. Novi fajl: providers/country-location.provider.ts
export class CountryLocationProvider implements ILocationProvider {
  constructor(private readonly countryCode: string) {}
  async getLocation(): Promise<Location> { /* logika za datu državu */ }
}

// 2. Jedna linija u createProvider():
case 'country': return new CountryLocationProvider(options.countryCode);

// LocationService, GameService — nula promena
```

---

## 2. Strategy

### Problem

`GameService` je direktno instancirao `DistanceScoringStrategy` kao hardkodiranu konstantu.
Strategija nije mogla da se menja između partija, a `TimeBonusScoringStrategy` je postojala
ali se nikada nije koristila:

```typescript
// Naivno rešenje — hardkodirana strategija, ne može da se menja
@Service()
export class GameService {
  private readonly scoring = new DistanceScoringStrategy(); // uvek ista

  // ...
  const roundScore = this.scoring.calculate({ distanceKm, timeTakenSeconds, roundDurationSeconds });
}
```

---

### Rešenje

Uveden je `ScoringContext` (Context objekat iz obrasca) koji čuva referencu na trenutnu
strategiju i nudi metodu za njenu zamenu. `GameService` (klijent) bira strategiju pri startu
igre i postavlja je na Context — bez ikakvog poznavanja detalja implementacije algoritma.

---

### Učesnici

| Uloga | Klasa | Fajl |
|---|---|---|
| Strategy (interfejs) | `ScoringStrategy` | `patterns/scoring/scoring.strategy.ts` |
| ConcreteStrategy | `DistanceScoringStrategy` | `patterns/scoring/distance.strategy.ts` |
| ConcreteStrategy | `TimeBonusScoringStrategy` | `patterns/scoring/time-bonus.strategy.ts` |
| Context | `ScoringContext` | `patterns/scoring/scoring.context.ts` |
| Klijent | `GameService` | `services/game.service.ts` |

---

### Struktura fajlova

```
src/patterns/scoring/
├── scoring.strategy.ts     ← Strategy interfejs + ScoringInput tip
├── distance.strategy.ts    ← ConcreteStrategy: bodovanje po distanci
├── time-bonus.strategy.ts  ← ConcreteStrategy: distanca + bonus za brzinu
└── scoring.context.ts      ← Context: čuva i delegira trenutnoj strategiji
```

---

### UML dijagram

```
«interface»
ScoringStrategy
─────────────────────────────────────
+ calculate(input: ScoringInput): number
        ▲
        │ implements
   ─────┴──────────────────────────────────
   │                                        │
DistanceScoringStrategy          TimeBonusScoringStrategy
───────────────────────          ────────────────────────
+ calculate(input): number       + calculate(input): number
  score = MAX * (1 - d/MAX)²       score = DistanceScore
                                           + TimeBonus


ScoringContext                          (Context)
──────────────────────────────────────────────────
- strategy: ScoringStrategy
+ constructor(strategy?)
+ setStrategy(strategy): void
+ calculate(input): number
        │
        │ delegira
        └──────────────────► strategy.calculate(input)


GameService                             (Klijent)
──────────────────────────────────────────────────
- scoringContexts: Map<roomCode, ScoringContext>
+ startGame()    → bira i postavlja strategiju na Context
+ submitGuess()  → poziva context.calculate()
```

---

### Ključni kod

**Strategy interfejs**
```typescript
export interface ScoringInput {
  distanceKm: number;
  timeTakenSeconds: number;
  roundDurationSeconds: number;
}

export interface ScoringStrategy {
  calculate(input: ScoringInput): number;
}
```

**Context objekat**
```typescript
export class ScoringContext {
  private strategy: ScoringStrategy;

  constructor(strategy: ScoringStrategy = new DistanceScoringStrategy()) {
    this.strategy = strategy;
  }

  setStrategy(strategy: ScoringStrategy): void {
    this.strategy = strategy;
  }

  calculate(input: ScoringInput): number {
    return this.strategy.calculate(input); // delegira — ne zna koji algoritam radi
  }
}
```

**Klijent — bira i postavlja strategiju pri startu igre**
```typescript
// U GameService.startGame() — klijent odlučuje koja strategija se koristi
const scoringContext = new ScoringContext();
scoringContext.setStrategy(
  gameMode === 'elimination'
    ? new TimeBonusScoringStrategy()   // vreme + distanca — kod eliminacije dodaje urgentnost
    : new DistanceScoringStrategy(),   // čista distanca — standardna partija
);
scoringContexts.set(roomCode, scoringContext);

// U GameService.submitGuess() — Context delegira, GameService ne zna koji algoritam radi
const context = scoringContexts.get(roomCode) ?? new ScoringContext();
const roundScore = context.calculate({ distanceKm, timeTakenSeconds, roundDurationSeconds });
```

---

### ConcreteStrategy-i

**DistanceScoringStrategy**
Boduje isključivo na osnovu distance od tačne lokacije. Koristi kvadratni pad — igrač koji
pogodi na 100 km dobija znatno više od onog koji pogodi na 1000 km:
```
score = MAX_SCORE * (1 - distanceKm / MAX_DISTANCE)²
```

**TimeBonusScoringStrategy**
Počinje od `DistanceScoringStrategy` rezultata i dodaje bonus za brzinu. Igrač koji pogodi
isti guess za 10 sekundi dobija više od onog koji pogodi za 55 sekundi (od 60s ukupno):
```
score = DistanceScore + MAX_TIME_BONUS * (1 - timeTaken / roundDuration)
```

---

### Potencijalno proširenje

Dodavanje nove strategije zahteva samo novu klasu i jednu liniju u `GameService.startGame()`.
`ScoringContext`, `submitGuess` i sve ostalo se **ne menjaju**:

```typescript
// 1. Nova klasa — eksponencijalni pad skora
export class ExponentialScoringStrategy implements ScoringStrategy {
  calculate({ distanceKm }: ScoringInput): number {
    return Math.round(MAX_SCORE_PER_ROUND * Math.exp(-distanceKm / 1000));
  }
}

// 2. Jedna nova grana u GameService.startGame():
case 'teams': scoringContext.setStrategy(new ExponentialScoringStrategy());

// ScoringContext, submitGuess — nula promena
```

---

## 3. Decorator

### Problem

`TimeBonusScoringStrategy` je interno instancirala `DistanceScoringStrategy` i pozivala
`base.calculate()`, što je arhitekturno identično Decorator obrascu — "osnovna" strategija
se "umotava" i njena vrednost se dopunjuje. Dva problema:

1. Strategy obrazac zahteva **nezavisne, zamenljive algoritme** — ne lanac wrappera
2. Penalizacija za korišćenje hintova nije imala mesto u arhitekturi

---

### Rešenje

Uveden je Decorator obrazac **paralelno** sa Strategy obrascem u istom scoring domenu,
što jasno pokazuje razliku između dva obrasca:

- **Strategy**: biramo *koji algoritam* — `DistanceScoringStrategy` ili `TimeBonusScoringStrategy`
- **Decorator**: *dodajemo ponašanje* povrh izabranog algoritma — `HintPenaltyDecorator`

`HintPenaltyDecorator` omata **bilo koju** `ScoringStrategy` i smanjuje finalni skor
za 15% po svakom iskorišćenom hintu, bez znanja o tome koji algoritam je ispod.

---

### Učesnici

| Uloga | Klasa | Fajl |
|---|---|---|
| Component (interfejs) | `ScoringStrategy` | `patterns/scoring/scoring.strategy.ts` |
| ConcreteComponent | `DistanceScoringStrategy` | `patterns/scoring/distance.strategy.ts` |
| ConcreteComponent | `TimeBonusScoringStrategy` | `patterns/scoring/time-bonus.strategy.ts` |
| Decorator (apstraktni) | `ScoringDecorator` | `patterns/scoring/scoring.decorator.ts` |
| ConcreteDecorator | `HintPenaltyDecorator` | `patterns/scoring/hint-penalty.decorator.ts` |
| ConcreteDecorator | `AccuracyBonusDecorator` | `patterns/scoring/accuracy-bonus.decorator.ts` |
| Klijent | `GameService` | `services/game.service.ts` |

---

### Struktura fajlova

```
src/patterns/scoring/
├── scoring.strategy.ts           ← Component interfejs (ScoringStrategy + ScoringInput)
├── distance.strategy.ts          ← ConcreteComponent
├── time-bonus.strategy.ts        ← ConcreteComponent (nezavisan algoritam)
├── scoring.context.ts            ← Context za Strategy obrazac
├── scoring.decorator.ts          ← Bazna Decorator klasa
├── hint-penalty.decorator.ts     ← ConcreteDecorator: kazna za hintove
└── accuracy-bonus.decorator.ts   ← ConcreteDecorator: bonus za preciznost
```

---

### UML dijagram

```
«interface»
ScoringStrategy
──────────────────────────────────────────
+ calculate(input: ScoringInput): number
        ▲
        │ implements
   ─────┴──────────────────────┬──────────────────────────────────────
   │                           │                                      │
DistanceScoringStrategy  TimeBonusScoringStrategy          ScoringDecorator (abstract)
───────────────────────  ────────────────────────          ──────────────────────────
+ calculate(input)       + calculate(input)                - strategy: ScoringStrategy
  score = f(distanca)      score = 0.7*f(d) +             + calculate(input) → prosleđuje
                                   0.3*f(vreme)                    ▲
                                                                   │ extends
                                                    ───────────────┴───────────────
                                                    │                              │
                                           HintPenaltyDecorator      AccuracyBonusDecorator
                                           ───────────────────────   ──────────────────────
                                           + calculate(input)        + calculate(input)
                                             penalty = 0.85^hints      if dist < 100km:
                                             return base * penalty        return base * 1.20
```

---

### Ključni kod

**Bazna Decorator klasa**
```typescript
export abstract class ScoringDecorator implements ScoringStrategy {
  constructor(protected readonly strategy: ScoringStrategy) {}

  // Default — samo prosleđuje, konkretni dekoratori overriduju
  calculate(input: ScoringInput): number {
    return this.strategy.calculate(input);
  }
}
```

**ConcreteDecorator — HintPenaltyDecorator**
```typescript
const HINT_PENALTY = 0.15; // 15% kazna po hintu

export class HintPenaltyDecorator extends ScoringDecorator {
  calculate(input: ScoringInput): number {
    const base = this.strategy.calculate(input); // poziva umotanu strategiju
    const hintsUsed = input.hintsUsed ?? 0;
    if (hintsUsed === 0) return base;
    const multiplier = Math.pow(1 - HINT_PENALTY, hintsUsed); // 0 hintova=100%, 1=85%, 2=72.25%
    return Math.round(base * multiplier);
  }
}
```

**AccuracyBonusDecorator**
```typescript
const ACCURACY_THRESHOLD_KM = 100;
const ACCURACY_BONUS = 0.20; // +20% za pogodak unutar 100 km

export class AccuracyBonusDecorator extends ScoringDecorator {
  calculate(input: ScoringInput): number {
    const base = this.strategy.calculate(input);
    if (input.distanceKm <= ACCURACY_THRESHOLD_KM) {
      return Math.round(base * (1 + ACCURACY_BONUS));
    }
    return base;
  }
}
```

**Klijent — GameService kondicionalno slaže dekoratore**
```typescript
// Strategy: bira algoritam na osnovu game moda
let finalStrategy: ScoringStrategy =
  gameMode === 'elimination' ? new TimeBonusScoringStrategy() : new DistanceScoringStrategy();

// Decorator sloj 1 (kondicionalno): -15% po iskorišćenom hintu
if (room.hintsEnabled) {
  finalStrategy = new HintPenaltyDecorator(finalStrategy);
}
// Decorator sloj 2 (uvek): +20% ako je pogodak unutar 100 km
finalStrategy = new AccuracyBonusDecorator(finalStrategy);

scoringContext.setStrategy(finalStrategy);
```

Redosled omatanja određuje redosled primene: `AccuracyBonusDecorator` se primenjuje na
rezultat `HintPenaltyDecorator`-a. Klijent ne zna koliko je slojeva ispod — interfejs je
uvek isti `ScoringStrategy`.

---

### Razlika Strategy vs Decorator u ovom primeru

| | Strategy | Decorator |
|---|---|---|
| **Šta radi** | Bira algoritam za računanje skora | Dodaje ponašanje povrh algoritma |
| **Kada se primenjuje** | Pri `startGame` — jednom po partiji | Pri `startGame` — ako su hintovi uključeni |
| **Klijent bira** | `DistanceScoringStrategy` ili `TimeBonusScoringStrategy` | Da li da omota sa `HintPenaltyDecorator` |
| **Lanac** | Ne — jedna aktivna strategija | Da — `HintPenaltyDecorator` → `Strategy` |

---

### Potencijalna proširenja

**Nova strategija** — samo nova klasa koja implementira `ScoringStrategy`:

| Naziv | Opis |
|---|---|
| `ExponentialScoringStrategy` | Eksponencijalni pad skora — strože kažnjava loše guesse |
| `CountryOnlyScoringStrategy` | Boduje samo da li je igrač pogodio ispravnu državu (0 ili MAX) |

**Novi dekorator** — samo nova klasa koja nasljeđuje `ScoringDecorator`:

| Naziv | Opis |
|---|---|
| `StreakBonusDecorator` | Bonus za uzastopne runde iznad praga preciznosti |
| `FirstGuessBonusDecorator` | Bonus za prvog igrača koji pošalje guess u rundi |

Primer kombinovanja tri dekoratora povrh bilo koje strategije — bez ijedne promene u
postojećim klasama:

```typescript
let strategy: ScoringStrategy = new TimeBonusScoringStrategy();
strategy = new HintPenaltyDecorator(strategy);      // sloj 1: kazna za hintove
strategy = new AccuracyBonusDecorator(strategy);    // sloj 2: bonus za preciznost
strategy = new StreakBonusDecorator(strategy);      // sloj 3: bonus za streak

// DistanceScoringStrategy, TimeBonusScoringStrategy, HintPenaltyDecorator,
// AccuracyBonusDecorator — nula promena
```

## 4. Decorator — Game Setup

### Motivacija

Svaka igra ima određeni osnovni mod (Standard ili Elimination), a na to se mogu opciono
nadovezivati dodatne karakteristike: hints, spektatori, timovi. Umesto da za svaku
kombinaciju postoji posebna klasa ili da `RoomService` sadrži složenu `if/else` logiku,
primenjujemo **Decorator obrazac** koji svaki feature dodaje kao zaseban omotač.

---

### Učesnici

| Uloga | Klasa | Fajl |
|---|---|---|
| Component (interfejs) | `IGameSetup` | `patterns/game-setup/game-setup.interface.ts` |
| ConcreteComponent | `StandardGameSetup` | `patterns/game-setup/setups/standard-game.setup.ts` |
| ConcreteComponent | `EliminationGameSetup` | `patterns/game-setup/setups/elimination-game.setup.ts` |
| Decorator (apstraktna klasa) | `GameSetupDecorator` | `patterns/game-setup/game-setup.decorator.ts` |
| ConcreteDecorator | `HintsDecorator` | `patterns/game-setup/decorators/hints.decorator.ts` |
| ConcreteDecorator | `SpectatorDecorator` | `patterns/game-setup/decorators/spectator.decorator.ts` |
| ConcreteDecorator | `TeamsDecorator` | `patterns/game-setup/decorators/teams.decorator.ts` |
| Client | `RoomService.createRoom` | `services/room.service.ts` |

---

### UML dijagram

```
         «interface»
          IGameSetup
    ┌──────────────────┐
    │ describe(): str  │
    │ buildConfig():   │
    │   GameSettings   │
    └────────┬─────────┘
             │ implements
    ┌────────┴──────────────────────────────────────────┐
    │                                                   │
    ▼                                           ┌───────┴──────────┐
StandardGameSetup                               │ GameSetupDecorator│
EliminationGameSetup                            │ (abstract)        │
                                                │ - game: IGameSetup│
                                                │ describe()        │
                                                │ buildConfig()     │
                                                └───────┬──────────┘
                                                        │ extends
                                          ┌─────────────┼──────────────┐
                                          ▼             ▼              ▼
                                    HintsDecorator  SpectatorDecorator  TeamsDecorator
```

---

### Interfejs i apstraktni Decorator

```typescript
// game-setup.interface.ts
export interface GameSettings {
  gameMode: GameMode;
  hintsEnabled: boolean;
  spectatorsAllowed: boolean;
  teamsEnabled: boolean;
  teamSize: number;
}

export interface IGameSetup {
  describe(): string;
  buildConfig(): GameSettings;
}
```

```typescript
// game-setup.decorator.ts
export abstract class GameSetupDecorator implements IGameSetup {
  constructor(protected readonly game: IGameSetup) {}

  describe(): string {
    return this.game.describe();
  }

  buildConfig(): GameSettings {
    return this.game.buildConfig();
  }
}
```

Apstraktni `GameSetupDecorator` čuva referencu na `IGameSetup` i prosleđuje pozive —
svaki ConcreteDecorator samo preklapa ono što mu je potrebno.

---

### ConcreteComponents

```typescript
// standard-game.setup.ts
export class StandardGameSetup implements IGameSetup {
  describe() { return 'Standard'; }
  buildConfig(): GameSettings {
    return { gameMode: 'standard', hintsEnabled: false, spectatorsAllowed: false, teamsEnabled: false, teamSize: 2 };
  }
}

// elimination-game.setup.ts
export class EliminationGameSetup implements IGameSetup {
  describe() { return 'Elimination'; }
  buildConfig(): GameSettings {
    return { gameMode: 'elimination', hintsEnabled: false, spectatorsAllowed: false, teamsEnabled: false, teamSize: 2 };
  }
}
```

---

### ConcreteDecorators

```typescript
// hints.decorator.ts
export class HintsDecorator extends GameSetupDecorator {
  describe() { return `${this.game.describe()} + Hints`; }
  buildConfig(): GameSettings {
    return { ...this.game.buildConfig(), hintsEnabled: true };
  }
}

// spectator.decorator.ts
export class SpectatorDecorator extends GameSetupDecorator {
  describe() { return `${this.game.describe()} + Spectators`; }
  buildConfig(): GameSettings {
    return { ...this.game.buildConfig(), spectatorsAllowed: true };
  }
}

// teams.decorator.ts
export class TeamsDecorator extends GameSetupDecorator {
  constructor(game: IGameSetup, private readonly teamSize: number = 2) {
    super(game);
  }
  describe() { return `${this.game.describe()} + Teams (${this.teamSize}v${this.teamSize})`; }
  buildConfig(): GameSettings {
    return { ...this.game.buildConfig(), teamsEnabled: true, teamSize: this.teamSize };
  }
}
```

---

### Upotreba u RoomService

```typescript
// room.service.ts — createRoom()
let gameSetup: IGameSetup = gameMode === 'elimination'
  ? new EliminationGameSetup()
  : new StandardGameSetup();

if (hintsEnabled)      gameSetup = new HintsDecorator(gameSetup);
if (spectatorsAllowed) gameSetup = new SpectatorDecorator(gameSetup);
if (teamsEnabled)      gameSetup = new TeamsDecorator(gameSetup, teamSize);

const gameSettings = gameSetup.buildConfig();
// gameSettings sadrži sve opcije za kreiranje sobe
```

Primer opisa za Elimination + Hints + Teams 3v3:
```
gameSetup.describe()
// → "Elimination + Hints + Teams (3v3)"
```

---

### Proširivanje

Svaki novi feature je samo nova klasa — ništa drugo se ne menja:

| Naziv | Opis |
|---|---|
| `TimeLimitDecorator` | Smanjuje `roundDurationSeconds` na fiksnih 30s bez obzira na podešavanja |
| `PrivateRoomDecorator` | Dodaje `passwordProtected: true` i `roomPassword` u config |
| `TournamentDecorator` | Postavlja `tournamentMode: true`, blokira join posle starta |

Primer — dodavanje password zaštite bez ijedne promene u postojećim klasama:

```typescript
let gameSetup: IGameSetup = new StandardGameSetup();
gameSetup = new HintsDecorator(gameSetup);
gameSetup = new PrivateRoomDecorator(gameSetup, 'tajnaLozinka');

gameSetup.describe();
// → "Standard + Hints + Private"
gameSetup.buildConfig();
// → { ..., hintsEnabled: true, passwordProtected: true, roomPassword: 'tajnaLozinka' }
```

---

## 5. Observer — Game Lifecycle

### Motivacija i problem koji se rešava

Pre primene obrasca, metoda `triggerGameOver` u `GameService` je radila tri nepovezane stvari:

```typescript
// STARI KOD — jedna metoda, tri odgovornosti
private async triggerGameOver(roomId: string, roomCode: string) {
  scoringContexts.delete(roomCode);                          // 1. cleanup memorije
  await this.roomRepository.setStatus(roomId, 'game_over');
  for (const player of finalRoom.players) {
    await this.userRepository.updateScore(player.userId, player.score); // 2. leaderboard
  }
  broadcastToRoom(roomCode, 'game_over', { players });       // 3. WebSocket broadcast
}
```

Svaki put kad bi dodali novu reakciju na kraj igre (notifikacije, achievements, analytics),
morali bi da menjamo `GameService`. To krši **Open/Closed princip** i **Single Responsibility**.

Observer rešava ovo tako što `GameService` samo objavi da je igra završena — a svaki
observer samostalno reaguje na taj događaj.

---

### Učesnici

| Uloga | Klasa | Fajl |
|---|---|---|
| Observer (interfejs) | `GameObserver` | `patterns/observer/game-observer.interface.ts` |
| Subject (apstraktna klasa) | `GameEventSubject` | `patterns/observer/game-event-subject.ts` |
| Concrete Subject | `GameService` | `services/game.service.ts` |
| Concrete Observer | `LeaderboardObserver` | `patterns/observer/observers/leaderboard.observer.ts` |
| Concrete Observer | `BroadcastObserver` | `patterns/observer/observers/broadcast.observer.ts` |

---

### UML dijagram

```
      «interface»
      GameObserver
  ┌──────────────────────┐
  │ onGameOver(event):   │
  │   Promise<void>      │
  └──────────┬───────────┘
             │ implements
  ┌──────────┴───────────┐──────────────────┐
  ▼                      ▼
LeaderboardObserver   BroadcastObserver
(ažurira User kol.)   (šalje WS event)

  GameEventSubject  (apstraktni Subject)
  ┌────────────────────────────────────┐
  │ - observers: GameObserver[]        │
  │ + registerObserver(obs)            │
  │ + unregisterObserver(obs)          │
  │ # notifyGameOver(event): Promise   │
  └───────────────┬────────────────────┘
                  │ extends
           GameService
      (registruje observere u konstruktoru,
       poziva notifyGameOver iz triggerGameOver)
```

---

### Interfejs i Subject

```typescript
// game-observer.interface.ts
export interface GameOverEvent {
  roomId: string;
  roomCode: string;
  players: Player[];
}

export interface GameObserver {
  onGameOver(event: GameOverEvent): Promise<void>;
}
```

```typescript
// game-event-subject.ts
export abstract class GameEventSubject {
  private observers: GameObserver[] = [];

  registerObserver(obs: GameObserver): void {
    this.observers.push(obs);
  }

  unregisterObserver(obs: GameObserver): void {
    this.observers = this.observers.filter((o) => o !== obs);
  }

  protected async notifyGameOver(event: GameOverEvent): Promise<void> {
    await Promise.all(this.observers.map((obs) => obs.onGameOver(event)));
  }
}
```

---

### Concrete Observers

```typescript
// leaderboard.observer.ts — ažurira totalScore i gamesPlayed u User kolekciji
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
```

```typescript
// broadcast.observer.ts — šalje game_over WebSocket event svim klijentima
@Service()
export class BroadcastObserver implements GameObserver {
  async onGameOver(event: GameOverEvent): Promise<void> {
    const sorted = [...event.players].sort((a, b) => b.score - a.score);
    broadcastToRoom(event.roomCode, 'game_over', { players: sorted });
  }
}
```

---

### Concrete Subject — registracija i notifikacija

```typescript
// game.service.ts
@Service()
export class GameService extends GameEventSubject {
  constructor(
    private readonly roomRepository: RoomRepository,
    private readonly locationService: LocationService,
    leaderboardObserver: LeaderboardObserver,
    broadcastObserver: BroadcastObserver,
  ) {
    super();
    this.registerObserver(leaderboardObserver); // prijava observera
    this.registerObserver(broadcastObserver);
  }

  private async triggerGameOver(roomId: string, roomCode: string): Promise<void> {
    scoringContexts.delete(roomCode);
    await this.roomRepository.setStatus(roomId, 'game_over');
    const finalRoom = await this.roomRepository.findByCode(roomCode);
    if (!finalRoom) return;

    // GameService ne zna ko će reagovati — samo obaveštava sve registrovane observere
    await this.notifyGameOver({ roomId, roomCode, players: finalRoom.players });
  }
}
```

---

### Šta se postiže

| Pre | Posle |
|---|---|
| `GameService` direktno poziva `userRepository.updateScore` | `LeaderboardObserver` jedini zna za `UserRepository` |
| `GameService` direktno poziva `broadcastToRoom` za game_over | `BroadcastObserver` jedini zna za WebSocket |
| Dodavanje novog ponašanja = izmena `GameService` | Dodavanje novog ponašanja = nova klasa koja implementira `GameObserver` |

Push model obaveštavanja — `GameService` šalje `GameOverEvent` sa svim podacima.
Observeri ne moraju sami da pitaju za stanje (nema pull-a).

---

### Proširivanje

Svaka nova reakcija na kraj igre je samo nova klasa — `GameService` se ne menja:

| Klasa | Opis |
|---|---|
| `AchievementObserver` | Proverava da li je igrač osvojio neku nagradu (prva pobeda, 5 wins itd.) |
| `AnalyticsObserver` | Loguje metriku igre (trajanje, prosečna distanca, broj igrača) |
| `CleanupObserver` | Čisti `hintUsage` i `roundTimers` iz memorije po završetku igre |

---

## 6. Repository

### Motivacija

Servisi kao što su `GameService` i `LeaderboardObserver` trebaju da čitaju i pišu podatke u bazu, ali ne bi trebalo da znaju ništa o tome kako je baza organizovana, koji ORM se koristi, niti o Mongoose specifičnostima (`Model`, `FilterQuery`, `$inc`, agregacije...). Repository obrazac uvodi sloj apstrakcije između poslovne logike i perzistencije podataka.

Rezultat: servisi rade sa čistim domenskim metodama (`findByCode`, `updateScore`, `pickRandom`) — bez ijednog Mongoose poziva.

---

### Učesnici

| Uloga | Klasa | Fajl |
|---|---|---|
| Apstraktni Repository | `BaseRepository<T>` | `database/repositories/base.repository.ts` |
| Concrete Repository | `UserRepository` | `database/repositories/user.repository.ts` |
| Concrete Repository | `RoomRepository` | `database/repositories/room.repository.ts` |
| Concrete Repository | `CachedLocationRepository` | `database/repositories/cached-location.repository.ts` |
| Client | `GameService`, `LeaderboardObserver`, `RoomService` | `services/` |

---

### UML dijagram

```
    BaseRepository<T extends Document>
    ┌───────────────────────────────────────┐
    │ # model: Model<T>                     │
    │                                       │
    │ + findById(id): Promise<T | null>     │
    │ + findOne(filter): Promise<T | null>  │
    │ + findMany(filter): Promise<T[]>      │
    │ + findPaginated(filter, opts)         │
    │ + create(data): Promise<T>            │
    │ + updateById(id, data)                │
    │ + updateOne(filter, data)             │
    │ + deleteById(id)                      │
    │ + deleteMany(filter)                  │
    │ + exists(filter): Promise<boolean>    │
    │ + count(filter): Promise<number>      │
    └────────────────┬──────────────────────┘
                     │ extends
      ┌──────────────┼──────────────────────┐
      ▼              ▼                      ▼
UserRepository   RoomRepository    CachedLocationRepository
(+ findByEmail   (+ findByCode     (+ pickRandom
 + findByUsername + createRoom      + markUsed)
 + updateScore    + addPlayer
 + getLeaderboard + addGuessToRound...)
```

---

### Apstraktni Repository

```typescript
// base.repository.ts
export abstract class BaseRepository<T extends Document> {
  constructor(protected readonly model: Model<T>) {}

  async findById(id: string): Promise<T | null> {
    return this.model.findById(id).exec();
  }

  async findOne(filter: FilterQuery<T>): Promise<T | null> {
    return this.model.findOne(filter).exec();
  }

  async findMany(filter: FilterQuery<T> = {}): Promise<T[]> {
    return this.model.find(filter).exec();
  }

  async findPaginated(filter: FilterQuery<T>, options: PaginationOptions = {}): Promise<PaginatedResult<T>> {
    const { page = 1, limit = 20, sort = '-createdAt' } = options;
    const skip = (page - 1) * limit;
    const [items, totalItems] = await Promise.all([
      this.model.find(filter).sort(sort).skip(skip).limit(limit).exec(),
      this.model.countDocuments(filter).exec(),
    ]);
    return { items, totalItems, totalPages: Math.ceil(totalItems / limit), currentPage: page };
  }

  async create(data: Partial<T>): Promise<T> { ... }
  async updateById(id: string, data: UpdateQuery<T>): Promise<T | null> { ... }
  async deleteMany(filter: FilterQuery<T>): Promise<void> { ... }
  async exists(filter: FilterQuery<T>): Promise<boolean> { ... }
  async count(filter: FilterQuery<T>): Promise<number> { ... }
}
```

`BaseRepository` enkapsulira sve standardne Mongoose operacije. Konkretne klase dobijaju ove metode besplatno i dodaju samo ono što je specifično za njihov domenski entitet.

---

### Concrete Repositories

**UserRepository** — domenski specifične metode za korisnika:

```typescript
@Service()
export class UserRepository extends BaseRepository<IUser> {
  constructor() {
    super(UserModel); // jedino mesto gde se Mongoose model pominje
  }

  async findByEmail(email: string): Promise<IUser | null> {
    return this.findOne({ email }); // koristi BaseRepository.findOne
  }

  async updateScore(userId: string, scoreToAdd: number): Promise<void> {
    await this.model.findByIdAndUpdate(userId, {
      $inc: { totalScore: scoreToAdd, gamesPlayed: 1 }, // atomska operacija
    }).exec();
  }

  async getLeaderboard(limit = 20): Promise<IUser[]> {
    return this.model.find().sort({ totalScore: -1 }).limit(limit)
      .select('username totalScore gamesPlayed createdAt').exec();
  }
}
```

**CachedLocationRepository** — domenski specifične metode za keširane lokacije:

```typescript
@Service()
export class CachedLocationRepository extends BaseRepository<ICachedLocation> {
  constructor() {
    super(CachedLocationModel);
  }

  async pickRandom(): Promise<ICachedLocation | null> {
    // MongoDB agregacija $sample — nasumični dokument
    const [doc] = await this.model.aggregate<ICachedLocation>([{ $sample: { size: 1 } }]);
    return doc ?? null;
  }

  async markUsed(id: string): Promise<void> {
    await this.updateById(id, {
      $inc: { usedCount: 1 },
      $set: { lastUsedAt: new Date() },
    });
  }
}
```

---

### Upotreba u servisima

Servisi ne vide ni jedan Mongoose import — rade isključivo sa domenskim metodama:

```typescript
// LeaderboardObserver — koristi UserRepository, ne zna za Mongoose
@Service()
export class LeaderboardObserver implements GameObserver {
  constructor(private readonly userRepository: UserRepository) {}

  async onGameOver(event: GameOverEvent): Promise<void> {
    await Promise.all(
      event.players.map((p) => this.userRepository.updateScore(p.userId, p.score)),
    );
  }
}

// RoomService — koristi RoomRepository
async joinTeam(roomCode: string, userId: string, teamId: number) {
  const room = await this.roomRepository.findByCode(roomCode); // domenski naziv
  if (!room) throw new Error('Room not found');
  const inTeam = room.players.filter((p) => p.teamId === teamId && p.userId !== userId);
  if (inTeam.length >= room.teamSize) throw new Error(`Team ${teamId} is full`);
  return this.roomRepository.updatePlayerTeam(room._id.toString(), userId, teamId);
}
```

---

### Šta se postiže

| Bez Repository | Sa Repository |
|---|---|
| Servisi direktno pozivaju `UserModel.findByIdAndUpdate(...)` | Servisi pozivaju `userRepository.updateScore(...)` |
| Promena ORM-a (npr. sa Mongoose na Prisma) zahteva izmenu svih servisa | Promena ORM-a zahteva izmenu samo repository klasa |
| Mongoose specifičnosti (`$inc`, `$set`, agregacije) razasute kroz servisni sloj | Sve DB specifičnosti enkapsulisane u jednom sloju |
| Testiranje servisa zahteva pravi MongoDB | Repository se može lako zameniti mock implementacijom u testovima |

---

### Proširivanje

Dodavanje novog entiteta je samo nova klasa koja nasledi `BaseRepository`:

```typescript
@Service()
export class AchievementRepository extends BaseRepository<IAchievement> {
  constructor() {
    super(AchievementModel);
  }

  // sve BaseRepository metode su odmah dostupne
  async findByUser(userId: string): Promise<IAchievement[]> {
    return this.findMany({ userId });
  }

  async grantIfNotExists(userId: string, type: string): Promise<void> {
    const exists = await this.exists({ userId, type });
    if (!exists) await this.create({ userId, type, grantedAt: new Date() });
  }
}
```
