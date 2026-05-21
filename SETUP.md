# Setup & Pokretanje — Open GeoGuessr

Ovaj fajl je jedino što treba da pročitaš da bi aplikacija radila lokalno.

---

## Korak 1 — Preduslovi

Proveri da li imaš sve instalirano:

```bash
node --version   # treba >= 18 (preporučeno 21.x)
yarn --version   # treba 1.x
mongod --version # treba >= 6
```

### Ako nemaš Node.js:
```bash
# macOS — preporučeno preko nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
nvm install 21
nvm use 21
```

### Ako nemaš Yarn:
```bash
npm install -g yarn
```

### Ako nemaš MongoDB:
```bash
# macOS
brew tap mongodb/brew
brew install mongodb-community
```

---

## Korak 2 — Kloniranje / pozicioniranje

```bash
cd Desktop/other/open-geoguessr
ls
# treba da vidiš: api/  webapp/  DOCS.md  SETUP.md  README.md
```

---

## Korak 3 — Pokretanje MongoDB

```bash
# macOS — Homebrew servis (ostaje u pozadini)
brew services start mongodb-community

# Provjeri da li radi
mongosh --eval "db.runCommand({ connectionStatus: 1 })" --quiet
# treba da ispiše: { ok: 1 }
```

> Ako ne koristiš Homebrew, pokreni direktno: `mongod --dbpath /tmp/mongodb`

---

## Korak 4 — Backend (API)

### 4a. Instaliraj zavisnosti

```bash
cd api
yarn install
```

### 4b. Napravi .env fajl

```bash
cp .env.example .env
```

Otvori `api/.env` i provjeri sadržaj (treba da izgleda ovako):

```env
PORT=4000
MONGODB_URI=mongodb://localhost:27017/open-geoguessr
JWT_SECRET=open-geoguessr-secret-dev-key-2024
NODE_ENV=development
MAPILLARY_CLIENT_TOKEN=       ← ostavi prazno za sada, popuni u Koraku 6
```

### 4c. Pokreni backend

```bash
yarn dev
```

Treba da vidiš:
```
MongoDB connected
Server running on http://localhost:4000
WebSocket ready on ws://localhost:4000
```

> Terminal zadrži otvoren — backend mora da radi dok igračeš.

---

## Korak 5 — Frontend (webapp)

Otvori **novi terminal** (backend mora ostati pokrenut u prvom).

### 5a. Instaliraj zavisnosti

```bash
cd webapp
yarn install
```

### 5b. Provjeri .env fajl

Fajl `webapp/.env` već postoji. Treba da izgleda ovako:

```env
REACT_APP_API_URL=http://localhost:4000/api
REACT_APP_WS_URL=ws://localhost:4000
REACT_APP_MAPILLARY_CLIENT_TOKEN=    ← ostavi prazno za sada, popuni u Koraku 6
```

### 5c. Pokreni frontend

```bash
yarn start
```

Browser se automatski otvara na `http://localhost:3000`.

---

## Korak 6 — Mapillary Street View (opciono, ali preporučeno)

Bez ovoga aplikacija radi normalno sa photo gallery-em umjesto pravog Street View-a.

### 6a. Registruj se na Mapillary

1. Idi na [https://www.mapillary.com](https://www.mapillary.com) → **Sign up** (besplatno)
2. Potvrdi email

### 6b. Napravi aplikaciju i dobij token

1. Idi na [https://www.mapillary.com/developer/app](https://www.mapillary.com/developer/app)
2. Klikni **Register application**
3. Popuni:
   - **Name**: `open-geoguessr-dev` (bilo šta)
   - **Callback URL**: `http://localhost:3000`
   - **Permissions**: `public:read` (samo ovo treba)
4. Klikni **Save**
5. Kopiraj **Client Token** (počinje sa `MLY|...`)

### 6c. Unesi token u oba .env fajla

**`api/.env`**:
```env
MAPILLARY_CLIENT_TOKEN=MLY|tvoj_token_ovde
```

**`webapp/.env`**:
```env
REACT_APP_MAPILLARY_CLIENT_TOKEN=MLY|tvoj_token_ovde
```

### 6d. Restartuj backend i frontend

```bash
# Terminal 1 (api/) — Ctrl+C pa ponovo:
yarn dev

# Terminal 2 (webapp/) — Ctrl+C pa ponovo:
yarn start
```

Od sada `World Explorer` i `Mixed` modovi imaju pravi 360° Street View sa navigacijom.

---

## Korak 7 — Prva igra (provjera da sve radi)

1. Otvori `http://localhost:3000`
2. Klikni **Register** → unesi username, email, password
3. Na Lobby stranici odaberi mod (npr. **Classic**) → klikni **Create Room**
4. Kopiraj 6-slovni kod sobe
5. Otvori **drugi browser tab** (ili drugi browser) → **Register** drugi nalog → **Join Room** → unesi kod
6. U prvom tabu klikni **Start Game**
7. Igraj!

### Brzi test sa jednim playerom

Možeš igrati i sam — samo klikni **Start Game** odmah u waiting roomu bez drugog igrača.

---

## Česti problemi

### `Error: connect ECONNREFUSED 127.0.0.1:27017`
MongoDB nije pokrenut.
```bash
brew services start mongodb-community
```

### `Error: Cannot find module '...'`
Zavisnosti nisu instalirane.
```bash
cd api && yarn install
cd ../webapp && yarn install
```

### Frontend se ne konektuje na backend
Provjeri da li backend radi na portu 4000:
```bash
curl http://localhost:4000/api/leaderboard
# treba da vrati: {"leaderboard":[]}
```

### Street View ne radi (vidi samo photo gallery)
- Provjeri da li je token unesen u **oba** `.env` fajla
- Token mora počinjati sa `MLY|`
- Nakon promjene `.env` moraš **restartovati** i backend i frontend

### Port 4000 već zauzet
```bash
lsof -ti:4000 | xargs kill -9
```

### Port 3000 već zauzet
```bash
lsof -ti:3000 | xargs kill -9
```

---

## Sažetak — minimalni koraci za pokretanje

```bash
# Terminal 1
brew services start mongodb-community
cd open-geoguessr/api
yarn install && yarn dev

# Terminal 2
cd open-geoguessr/webapp
yarn install && yarn start
```

Otvori `http://localhost:3000` → registruj se → igraj.
