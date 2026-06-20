import { Player } from 'src/types';

export interface GameOverEvent {
  roomId: string;
  roomCode: string;
  players: Player[];
}

export interface GameObserver {
  onGameOver(event: GameOverEvent): Promise<void>;
}
