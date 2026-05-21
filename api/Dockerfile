# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:21-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

# tsc compiles TS → JS; tsc-alias rewrites 'src/...' path aliases to relative paths
RUN npm run build

# ── Stage 2: production ────────────────────────────────────────────────────────
FROM node:21-alpine
WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

EXPOSE 4000

CMD ["node", "dist/src/server.js"]
