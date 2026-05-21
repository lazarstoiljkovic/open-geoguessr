# Deployment Guide

Stack: **Hetzner VPS** (backend + MongoDB) + **Vercel** (frontend)

---

## Preduslovi

- Hetzner nalog — [hetzner.com/cloud](https://www.hetzner.com/cloud)
- Vercel nalog — [vercel.com](https://vercel.com)
- Domen (npr. `tvojdomen.com`)
- Repo na GitHub-u

---

## 1. Hetzner — Kreiranje servera

1. Hetzner Cloud Console → **New Project** → **Add Server**
2. Location: **Nuremberg** ili **Helsinki**
3. Image: **Ubuntu 22.04**
4. Type: **CX22** (2 vCPU, 4 GB RAM, 40 GB disk — €4.15/mes)
5. SSH Keys: dodaj svoj public key
6. Klikni **Create & Buy**

Sačekaj ~30s da se server podigne, zapamti IP adresu.

---

## 2. DNS (Porkbun)

Idi na **porkbun.com → Account → Domain Management → tvoj domen → DNS Records**.

Dodaj sledeće recordove:

| Type | Host | Answer | TTL |
|------|------|--------|-----|
| `A` | `@` | `76.76.21.21` | 600 |
| `CNAME` | `www` | `cname.vercel-dns.com` | 600 |
| `A` | `api` | `<IP Hetzner servera>` | 600 |

- `@` → `76.76.21.21` je Vercel-ov fiksni IP (root domen za React app)
- `www` → Vercel alias za `www.tvojdomen.com`
- `api` → tvoj Hetzner server (`api.tvojdomen.com`)

> Porkbun koristi sopstvene nameservere — ne treba ništa dodatno da menjaš, samo dodaš recordove kroz njihov UI.

DNS propagacija obično traje 5–30 minuta. Možeš da pratiš na [dnschecker.org](https://dnschecker.org).

---

## 3. Setup servera

SSH na server kao root:

```bash
ssh root@<IP>
```

Kloniraj repo:

```bash
git clone https://github.com/TVOJ-USERNAME/open-geoguessr.git
cd open-geoguessr
```

Pokreni setup skriptu (instalira Docker, Nginx, Certbot, SSL):

```bash
bash deploy/setup.sh api.tvojdomen.com
```

Skripta radi sledeće automatski:
- Instalira `docker`, `docker-compose-v2`, `nginx`, `certbot`
- Pribavlja Let's Encrypt SSL sertifikat za domen
- Konfiguriše Nginx kao reverse proxy sa WebSocket podrškom
- Reloaduje Nginx

---

## 4. Backend — Environment varijable

```bash
cd ~/open-geoguessr/api
cp .env.production.example .env.production
nano .env.production
```

Popuni fajl:

```env
PORT=4000
NODE_ENV=production

MONGODB_URI=mongodb://mongo:27017/open-geoguessr

# Generiši: openssl rand -base64 48
JWT_SECRET=PROMENI_OVO

GOOGLE_MAPS_API_KEY=AIza...
MAPILLARY_CLIENT_TOKEN=MLY|...
```

---

## 5. Backend — Pokretanje

```bash
cd ~/open-geoguessr/api
docker compose up -d --build
```

Provjeri da su oba kontejnera živa:

```bash
docker compose ps
```

Trebalo bi da vidiš `api` i `mongo` u statusu `running`.

Provjeri logove:

```bash
docker compose logs -f api
```

---

## 6. Prefill lokacija u bazi

Posle prvog pokretanja, popuni bazu sa potvrđenim Street View lokacijama:

```bash
docker compose exec api node dist/scripts/prefill-locations.js 500 5
# arg1: broj lokacija (preporučeno 500+)
# arg2: broj paralelnih workera (5 je optimalno)
```

Ovo radi u pozadini, može da traje 10-15 minuta. Možeš da zatvoriš terminal — Docker nastavlja da radi.

Za pokretanje u pozadini:

```bash
docker compose exec -d api node dist/scripts/prefill-locations.js 500 5
```

---

## 7. Vercel — Frontend

1. Idi na [vercel.com](https://vercel.com) → **Add New Project** → importuj GitHub repo
2. Podesi:
   - **Root Directory**: `webapp`
   - **Framework Preset**: Create React App (Vercel detektuje automatski)
3. Dodaj **Environment Variables**:


| Variable | Value |
|---|---|
| `REACT_APP_API_URL` | `https://api.tvojdomen.com/api` |
| `REACT_APP_WS_URL` | `wss://api.tvojdomen.com` |
| `REACT_APP_GOOGLE_MAPS_API_KEY` | `AIza...` |
| `REACT_APP_MAPILLARY_CLIENT_TOKEN` | `MLY|...` (opciono) |

4. Klikni **Deploy**
5. Nakon deploya idi na **Settings → Domains → Add Domain** → ukucaj `tvojdomen.com`

Vercel automatski izdaje SSL za custom domen i deploya svaki push na `main` branch.

---

## 8. Update koda (redeploy)

**Backend:**

```bash
ssh root@<IP>
cd ~/open-geoguessr
git pull
cd api
docker compose up -d --build
```

**Frontend:** automatski — svaki push na `main` triggeruje Vercel deploy.

---

## Struktura u produkciji

```
Internet
  │
  ├── webapp.vercel.app  (ili tvojdomen.com)
  │     └── React SPA (Vercel CDN)
  │
  └── api.tvojdomen.com  (Hetzner CX22)
        └── Nginx (SSL, port 443)
              └── Node.js API + WebSocket (port 4000, samo localhost)
                    └── MongoDB (port 27017, samo interni Docker network)
```

---

## Korisne komande na serveru

```bash
# Status kontejnera
docker compose -f ~/open-geoguessr/api/docker-compose.yml ps

# Logovi API-ja (live)
docker compose -f ~/open-geoguessr/api/docker-compose.yml logs -f api

# Restart API-ja
docker compose -f ~/open-geoguessr/api/docker-compose.yml restart api

# MongoDB shell
docker compose -f ~/open-geoguessr/api/docker-compose.yml exec mongo mongosh open-geoguessr

# Broj lokacija u bazi
docker compose -f ~/open-geoguessr/api/docker-compose.yml exec mongo \
  mongosh open-geoguessr --eval "db.cachedlocations.countDocuments()"

# Nginx status
systemctl status nginx

# Obnova SSL sertifikata (automatski via cron, ali može i ručno)
certbot renew --dry-run
```

---

## Troubleshooting

**API ne odgovara:**
```bash
docker compose logs api --tail 50
curl http://localhost:4000/api/health  # trebalo bi da vrati 200
```

**WebSocket ne radi:**
- Provjeri Nginx config: `nginx -t`
- Provjeri da Nginx ima `proxy_set_header Upgrade $http_upgrade;`
- Provjeri da koristiš `wss://` (ne `ws://`) u frontend env varijablama

**MongoDB izgubio podatke:**
- Docker volume `mongo_data` čuva podatke čak i ako se kontejner restartuje
- `docker compose down` NE briše volume; `docker compose down -v` briše

**SSL sertifikat istekao:**
```bash
certbot renew
systemctl reload nginx
```
