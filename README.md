# Open GeoGuessr

A real-time multiplayer GeoGuessr clone built with Koa + TypeScript + MongoDB on the backend and React + TypeScript on the frontend.

## Tech Stack

**Backend (`api/`)**
- Koa + koa-router (HTTP server)
- `ws` library (WebSocket server for real-time game)
- MongoDB + Mongoose (database)
- typedi (dependency injection)
- JWT + bcrypt (authentication)
- Wikipedia REST API (free landmark images)

**Frontend (`webapp/`)**
- React 18 + TypeScript
- React Router v6
- Leaflet + react-leaflet (interactive guess map)
- SCSS modules
- Native WebSocket client

## Architecture Patterns

| Pattern | Where |
|---|---|
| Repository | `api/src/database/repositories/` — abstraction over MongoDB |
| Strategy | `api/src/patterns/scoring/` — pluggable scoring algorithms |
| Factory | `api/src/patterns/factory/game.factory.ts` — game mode configs |
| Observer | `api/src/websocket/` + `webapp/src/modules/socket/` — WS events |
| Facade | `GameHandler` — orchestrates Room, Round, Score logic |
| State machine | `GameContext.tsx` reducer — lobby→countdown→playing→results→game_over |

## Getting Started

### Prerequisites
- Node.js 18+
- MongoDB running locally (`mongod`)

### Backend

```bash
cd api
cp .env.example .env   # adjust MONGODB_URI/JWT_SECRET as needed
yarn install
yarn dev               # starts on http://localhost:4000
```

### Frontend

```bash
cd webapp
yarn install
yarn start             # starts on http://localhost:3000
```

## Game Flow

1. **Register / Login** — JWT auth stored in localStorage
2. **Lobby** — Create a room (Classic 30s or Time Attack 15s) or join with a 6-char code
3. **Waiting Room** — Share the code, host sees Start button
4. **Countdown** — 3-second countdown for all players
5. **Playing** — Each round: see a landmark photo, click on the world map to guess
6. **Round Results** — See all guesses on the map, distances, scores
7. **Game Over** — Final leaderboard, scores saved to database

## Free Image Source

Landmark images are fetched from the **Wikipedia REST API** (`en.wikipedia.org/api/rest_v1/page/summary/{title}`) — completely free, no API key needed. Results are cached in memory for the server's lifetime.
