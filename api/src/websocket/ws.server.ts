import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage, Server } from 'http';
import { Container } from 'typedi';
import { verifyToken } from 'src/utils/jwt.utils';
import { GameHandler } from './handlers/game.handler';
import { AuthenticatedClient, getClients } from './ws.clients';

export { AuthenticatedClient, broadcastToRoom } from './ws.clients';
export { getClientsInRoom, sendToClient } from './ws.clients';

export function initWebSocketServer(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server });
  const gameHandler = Container.get(GameHandler);
  const clients = getClients();

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const token = extractToken(req);
    if (!token) {
      ws.close(4001, 'Unauthorized');
      return;
    }

    let userId: string;
    let username: string;
    try {
      const payload = verifyToken(token);
      userId = payload.userId;
      username = payload.username;
    } catch {
      ws.close(4001, 'Invalid token');
      return;
    }

    const client = ws as AuthenticatedClient;
    client.userId = userId;
    client.username = username;
    clients.set(userId, client);

    client.on('message', async (raw) => {
      try {
        const { event, data } = JSON.parse(raw.toString());
        await gameHandler.handle(client, event, data);
      } catch (err) {
        client.send(JSON.stringify({ event: 'error', data: { message: 'Invalid message' } }));
      }
    });

    client.on('close', async () => {
      if (clients.get(userId) !== client) return;
      if (client.roomCode) {
        await gameHandler.handleDisconnect(client);
      }
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
