import { WS_URL } from '../../env';

type EventHandler = (data: unknown) => void;

class SocketClient {
  private ws: WebSocket | null = null;
  private listeners = new Map<string, Set<EventHandler>>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private token: string | null = null;
  private everConnected = false;
  private pendingMessages: string[] = [];

  connect(token: string): void {
    if (this.ws && this.ws.readyState !== WebSocket.CLOSED) {
      this.ws.onclose = null;
      this.ws.close();
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.token = token;
    this.ws = new WebSocket(`${WS_URL}?token=${token}`);

    this.ws.onopen = () => {
      const pending = this.pendingMessages.splice(0);
      pending.forEach((msg) => this.ws!.send(msg));

      if (this.everConnected) {
        this.emit('_reconnected', {});
      }
      this.everConnected = true;
    };

    this.ws.onmessage = (msg) => {
      try {
        const { event, data } = JSON.parse(msg.data);
        this.emit(event, data);
      } catch {  }
    };

    this.ws.onclose = () => {
      if (this.token) {
        this.reconnectTimer = setTimeout(() => this.connect(this.token!), 3000);
      }
    };

    this.ws.onerror = () => this.ws?.close();
  }

  disconnect(): void {
    this.token = null;
    this.pendingMessages = [];
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
    this.listeners.clear();
  }

  send(event: string, data: unknown): void {
    const msg = JSON.stringify({ event, data });
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(msg);
    } else {
      this.pendingMessages.push(msg);
    }
  }

  on(event: string, handler: EventHandler): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(handler);
    return () => this.listeners.get(event)?.delete(handler);
  }

  private emit(event: string, data: unknown): void {
    this.listeners.get(event)?.forEach((h) => h(data));
  }
}

const socket = new SocketClient();
export default socket;
