# Skripta za prezentaciju — Open GeoGuessr

Beleške za usmenu odbranu, slajd po slajd. Ovo nije tekst za čitanje napamet — to su
podsetnici šta da kažeš svojim rečima. Ukupno 29 slajdova, ciljano tempo ~30–40s po
slajdu ⇒ prezentacija ~15–18 min, ostavlja prostor za pitanja.

**Pravilo:** za svaki projektni obrazac postoje 2 slajda (Problem+dijagram, pa
Kod+Prednosti/Mane) — na prvom pričaš PROBLEM svojim rečima, na drugom pokazuješ KOD i
brzo pročitaš prednosti/mane sa slajda (ne moraš da ih pamtiš, tekst je tu).

---

## Pre početka — priprema

- Otvori `OpenGeoGuessr_v2.pptx` u prezentacionom modu.
- Ako imaš vremena/mogućnost, drži otvoren i browser sa živom aplikacijom (lobby → igra
  → rezultati) da po potrebi pokažeš real demo umesto screenshot placeholdera.
- Drži otvoren editor sa `api/src/patterns/` folderom — ako profesor pita "pokaži mi to u
  kodu", da ne tražiš fajl uživo.

**Otvaranje (pre slajda 1):**
> "Dobar dan, predstaviću projekat Open GeoGuessr — open-source multiplayer geografsku
> igru inspirisanu GeoGuessr-om, sa fokusom na arhitekturu i projektne obrasce koje sam
> primenio u backend delu."

---

## Deo 1 — Uvod i pregled aplikacije (slajdovi 1–4)

### Slajd 1 — Naslovni (~15s)
- Ime, broj indeksa, predmet. Kratko — samo pročitaj karticu, ne zadržavaj se.

### Slajd 2 — Šta je Open GeoGuessr (~1 min)
- Jedna rečenica: igrači dobijaju Street View fotografiju nepoznate lokacije i pogađaju
  gde se nalazi na mapi; bliži pogodak = više poena.
- Prođi kroz tok igre (6 koraka na slajdu) brzo, jedan po jedan: Lobby → Countdown →
  Street View → Guess → Rezultati → Game Over.
- Spomeni 4 moda igre u jednoj rečenici svaki (Standard, Elimination, Teams, Spectator) —
  ne ulazi u detalje, to dolazi kasnije kroz obrasce (Elimination i Teams su primeri
  Decorator/Strategy primene).

### Slajdovi 3a–3d — Ekrani aplikacije (~2 min ukupno, ~30s po slajdu)
- Ovo je "vizuelni tour" — ne objašnjavaj kod, samo šta korisnik vidi.
- 3a Lobby: Room Code, lista igrača uživo, host podešava mod/broj rundi, start.
- 3b Gameplay: Street View razgledanje + klik na mapu za pin.
- 3c Rezultati: mapa sa svim pogocima i linijama do tačne lokacije + podijum na kraju.
- 3d Leaderboard: globalni rang, ažurira se odmah po završetku igre (najavi da ćeš kasnije
  objasniti KAKO se ažurira — Observer obrazac).

### Slajd 4 — Funkcionalnosti (~30s)
- Ne čitaj sve stavke. Reci: "Ovde je kompletan pregled — gameplay, komunikacija i
  napredne opcije poput hintova i timova. Prelazim na tehnički deo."

---

## Deo 2 — Tehnologije i baza podataka (slajdovi 5a–6d)

### Slajdovi 5a–5c — Stek tehnologija (~1.5 min ukupno)
- 5a Backend: Node.js + Koa za REST API, TypeScript svuda, **TypeDI za dependency
  injection** (najavi da ćeš se vratiti na ovo), native WebSocket (`ws`), JWT, axios za
  Google API pozive.
- 5b Baza + infrastruktura: MongoDB + Mongoose, Hetzner/Docker/Nginx/Vercel — brzo, ovo
  nije fokus odbrane.
- 5c Frontend: React 18 + TypeScript + Context/useReducer + Google Maps API.

### Slajdovi 6a–6d — Zašto MongoDB i kako je organizovana baza (~2.5 min)
- 6a: Ključna poenta — **cela igra živi u jednom Room dokumentu** (igrači, runde,
  pogotci, chat su ugnježdeni). Nema JOIN-ova. Napomeni i manu: nema referencijalnog
  integriteta, transakcije su ograničene — koristimo atomske operatore umesto njih.
- 6b: Pokaži šemu — Room je centar, Player/Round/ChatMessage/RoundGuess su ugnježdeni
  dokumenti. Kratko: "_id: false na pod-šemama jer nisu samostalni dokumenti."
- 6c: Mongoose ODM — objasni lanac Interface (TypeScript) → Schema (validacija) →
  Model (MongoDB kolekcija). Jedna rečenica dovoljno.
- 6d: **Repository Pattern** — `BaseRepository<T>` generička apstrakcija sa
  `findById/create/updateById...`, `RoomRepository` je nasleđuje i dodaje domenske metode.
  Ovo je odlična prelazna tačka: "Sada prelazim na arhitekturu aplikacije u celini, pa na
  ostale projektne obrasce."

---

## Deo 3 — Arhitektura aplikacije (slajdovi 7a–7b, ~2.5 min)

### Slajd 7a — Backend slojevita arhitektura (~1.5 min)
Ovo je jedan od najvažnijih slajdova — pokazuje da razumeš CELU sliku, ne samo pojedinačne
obrasce. Pređi traku po traku odozgo nadole:
> "Zahtev ulazi kroz transportni sloj — HTTP ili WebSocket, oba dele isti port. Rutira se
> kroz Routing/Handler sloj do middleware-a koji proverava JWT. Servisni sloj sadrži
> biznis logiku i tu se koriste projektni obrasci koje ću odmah pokazati — Factory,
> Decorator, Strategy, Observer. Servisi nikad direktno ne diraju bazu, već idu kroz
> Repository sloj, koji jedini zna za Mongoose."
- Desna kutija: **Dependency Injection (TypeDI)** provlači zavisnosti kroz sve slojeve —
  objasni da to znači da nijedna klasa ručno ne pravi svoje zavisnosti (`new`), već ih
  kontejner injektuje kroz konstruktor. Ovo pripremi teren za slajd 8f (DI slajd).

### Slajd 7b — Frontend slojevi + tok podataka (~1 min)
- Levo: brzo prođi 4 sloja frontenda (Pages → Komponente → Context/useReducer → Socket/
  HTTP klijenti).
- Desno: **ovo je najbolji slajd da pokažeš da razumeš end-to-end tok** — proveri da li
  imaš vremena da ga pročitaš korak po korak (6 koraka, `submitGuess` primer). Ako je
  vremena malo, samo reci: "Ovde sam prikazao kompletan tok jednog pogotka kroz sve
  slojeve — od klika na mapi do WebSocket broadcast-a svim igračima. Hibridni pristup:
  HTTP za pojedinačni odgovor, WebSocket za broadcast."

---

## Deo 4 — Projektni obrasci (slajdovi 8a1–8g, ~8–9 min — SRCE ODBRANE)

Za svaki obrazac koristi isti obrazac pričanja (bez cimanja teksta sa slajda):
1. Reci PROBLEM svojim rečima (2 rečenice) — zašto naivno rešenje ne valja.
2. Pređi na drugi slajd, pokaži KOD, i pročitaj/parafraziraj JEDNU prednost i JEDNU manu.

### 8a1 + 8a2 — Factory Method (~1.5 min)
- **Problem:** GameService treba lokaciju iz dva izvora (Famous lista ili World preko
  Google Street View), a ne želimo da on sam odlučuje if/else i poznaje obe implementacije.
- **Rešenje u jednoj rečenici:** `LocationProviderFactory` ima factory metodu
  `createProvider(mode)` koju konkretna `GameLocationProviderFactory` implementira; klijent
  (`LocationService`) zna samo za apstraktni `ILocationProvider`.
- **Ako pitaju "zašto Factory Method a ne obična if/else":** "Zato što dodavanje trećeg
  moda lokacije (npr. samo Evropa) tada zahteva samo novu klasu i jedan `case`, bez
  diranja `GameService`-a — to je Open/Closed princip u praksi."

### 8b1 + 8b2 — Strategy (~1.5 min)
- **Problem:** Standard mod boduje samo po distanci, Elimination dodaje bonus za brzinu —
  bez obrasca to bi bio `if (gameMode === 'elimination') {...} else {...}` razbacan kroz
  kod.
- **Rešenje:** `ScoringStrategy` interfejs, dve konkretne implementacije
  (`DistanceScoringStrategy`, `TimeBonusScoringStrategy`), `ScoringContext` drži trenutnu
  strategiju i deleguje joj poziv.
- **Ako pitaju "koja je razlika između Strategy i Decorator kod tebe":** ovo je KLJUČNO
  pitanje, imaš ga spremljeno u PATTERNS.md — "Strategy bira KOJI algoritam se koristi,
  Decorator DODAJE ponašanje povrh već izabranog algoritma. Kod mene: Strategy bira
  Distance vs TimeBonus, a Decorator dodaje hint penal i accuracy bonus povrh bilo koje
  od te dve."

### 8c1 + 8c2 — Decorator (GameSetup) (~1.5 min)
- **Problem:** 3 opcije (Hints/Teams/Spectators) × 2 moda = 8 kombinacija; nasleđivanjem
  bi trebalo 8 klasa, svaki novi feature duplira broj klasa.
- **Rešenje:** svaki feature je dekorator koji umotava `IGameSetup` i dodaje svoju izmenu
  u `buildConfig()`. Slažu se uslovno u `RoomService.createRoom()`.
- **Konkretan primer da izgovoriš:** "Elimination + Hints + Teams (2v2)" — to je
  `describe()` string koji se lančano gradi kroz tri umotavanja.

### 8d1 + 8d2 — Decorator (Scoring) (~1.5 min)
- **Problem:** hint penal (-15% po hintu) i accuracy bonus (+20% na <100km) treba
  primeniti povrh BILO koje scoring strategije, za oba moda.
- **Konkretan brojčani primer — ZAPAMTI GA, odličan je za odbranu:**
  Elimination mod, 2 iskorišćena hinta, pogodak na 50km:
  `TimeBonusScoringStrategy` → 3200 poena → `HintPenaltyDecorator` (×0.72 za 2 hinta) →
  2304 → `AccuracyBonusDecorator` (50km < 100km, ×1.20) → **finalno 2764 poena**.
- **Ako pitaju "zašto je redosled bitan":** "AccuracyBonusDecorator mora biti spolja jer
  se primenjuje na finalni skor — kad bi bio unutra, bonus bi se računao pre penala i
  dao pogrešan rezultat."

### 8e1 + 8e2 — Observer (~1.5 min)
- **Problem:** kad igra završi treba i broadcast svim igračima I update leaderboard-a u
  bazi — bez obrasca `GameService` bi direktno zavisio od `UserRepository` i WebSocket
  infrastrukture.
- **Rešenje:** `GameService` nasleđuje `GameEventSubject`, registruje dva observera
  (`LeaderboardObserver`, `BroadcastObserver`) u konstruktoru, a kad igra završi samo
  pozove `notifyGameOver()` — ne zna ko će i kako reagovati.
- **Ako pitaju "šta ako dodaš email notifikaciju posle igre":** "Nova klasa
  `EmailObserver implements GameObserver`, jedna linija `registerObserver()` u
  konstruktoru — `GameService` se ne dira uopšte."

### 8f1 + 8f2 — Dependency Injection / TypeDI (~1 min)
- Nije klasičan GoF obrazac — reci to eksplicitno, pokazuje da znaš razliku.
- **Poenta:** `@Service()` markira klasu, `Container.get(GameService)` automatski
  rešava CEO graf zavisnosti (repository, servisi, observeri) rekurzivno kroz
  konstruktore — nema ručnog `new`.
- **Zašto je bitno za testiranje:** mock repozitorijum se ubaci umesto pravog bez ijedne
  izmene servisa.

### 8g — Pregled svih obrazaca (~30s)
- Ovo je "cheat sheet" slajd — koristi ga kao zaključak dela o obrascima:
  > "Da rezimiram — Factory Method za izbor izvora lokacija, Strategy i Decorator za
  > bodovanje i podešavanja sobe, Observer za reakcije na kraj igre, Repository za
  > apstrakciju baze, i Dependency Injection koji sve to povezuje. Svaki obrazac je
  > rešio konkretan problem vezan pre Open/Closed principa — dodavanje novog ponašanja
  > bez izmene postojećeg koda."

---

## Zaključak (posle slajda 8g, ~30s)

> "To je pregled arhitekture i projektnih obrazaca u Open GeoGuessr projektu. Hvala na
> pažnji, rado odgovaram na pitanja."

---

## Najverovatnija pitanja komisije (brza referenca)

| Pitanje | Kratak odgovor |
|---|---|
| Zašto MongoDB a ne SQL? | Cela partija je jedan dokument koji se čita/piše zajedno — nema JOIN-ova; mana je slabiji referencijalni integritet, rešeno atomskim operatorima. |
| Strategy vs Decorator — razlika kod tebe? | Strategy BIRA algoritam (Distance/TimeBonus), Decorator DODAJE ponašanje povrh (hint penal, accuracy bonus). |
| Zašto ne Socket.IO nego native `ws`? | Socket.IO ima svoj protokol i ~350KB zavisnosti; nama treba samo JSON poruke + broadcast po sobi — native `ws` je 6KB i dovoljan. |
| Šta radi TypeDI/DI ovde? | `@Service()` + `Container.get()` — kontejner automatski injektuje sve zavisnosti kroz konstruktor, bez ručnog `new`; olakšava testiranje (mock injection). |
| Kako se leaderboard ažurira? | Observer obrazac — `LeaderboardObserver.onGameOver()` se poziva paralelno sa `BroadcastObserver` kad `GameService` javi `notifyGameOver()`. |
| Šta ako dva igrača pošalju guess istovremeno? | MongoDB atomski operatori (`$push` sa `arrayFilters`) garantuju da nema race condition-a na nivou baze. |
| Zašto Factory Method a ne samo `if/else`? | Dodavanje novog izvora lokacija (npr. samo Evropa) ne bi zahtevalo izmenu `GameService`/`LocationService`, samo novu klasu + jedan `case`. |
| Koja je mana Decorator obrasca kod tebe? | Redosled umotavanja je bitan (AccuracyBonus mora biti spolja) — pogrešan redosled = pogrešan rezultat; debug zahteva praćenje celog lanca. |
| Da li si testirao ovo (unit testovi)? | Ako nemaš testove — budi iskren: "Trenutno nema formalnih unit testova, ali arhitektura (DI + interfejsi) je namenski projektovana da bude testabilna — mock repozitorijumi/observeri se lako ubacuju." |
