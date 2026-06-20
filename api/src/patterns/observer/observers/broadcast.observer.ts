import { Service } from 'typedi';
import { broadcastToRoom } from 'src/websocket/ws.clients';
import { GameObserver, GameOverEvent } from '../game-observer.interface';

@Service()
export class BroadcastObserver implements GameObserver {
  async onGameOver(event: GameOverEvent): Promise<void> {
    const sorted = [...event.players].sort((a, b) => b.score - a.score);
    broadcastToRoom(event.roomCode, 'game_over', { players: sorted });
  }
}
