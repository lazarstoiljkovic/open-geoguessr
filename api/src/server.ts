import 'reflect-metadata';
import dotenv from 'dotenv';
dotenv.config();

import { createServer } from 'http';
import app from './app';
import mongoLoader from './loaders/mongo.loader';
import { initWebSocketServer } from './websocket/ws.server';

const PORT = parseInt(process.env.PORT || '4000', 10);

async function bootstrap() {
  await mongoLoader();

  const server = createServer(app.callback());
  initWebSocketServer(server);

  server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`WebSocket ready on ws://localhost:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
