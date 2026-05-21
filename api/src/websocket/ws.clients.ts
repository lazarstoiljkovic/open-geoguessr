import { WebSocket } from 'ws';

export interface AuthenticatedClient extends WebSocket {
  userId: string;
  username: string;
  roomCode?: string;
}

const clients = new Map<string, AuthenticatedClient>();

export function getClients(): Map<string, AuthenticatedClient> {
  return clients;
}

export function getClientsInRoom(roomCode: string): AuthenticatedClient[] {
  return Array.from(clients.values()).filter(
    (c) => c.roomCode === roomCode && c.readyState === WebSocket.OPEN,
  );
}

export function broadcastToRoom(roomCode: string, event: string, data: unknown): void {
  const payload = JSON.stringify({ event, data });
  getClientsInRoom(roomCode).forEach((client) => client.send(payload));
}

export function sendToClient(userId: string, event: string, data: unknown): void {
  const client = clients.get(userId);
  if (client && client.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify({ event, data }));
  }
}
