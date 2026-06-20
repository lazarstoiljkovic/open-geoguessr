import { GameObserver, GameOverEvent } from './game-observer.interface';

export abstract class GameEventSubject {
  private observers: GameObserver[] = [];

  registerObserver(obs: GameObserver): void {
    this.observers.push(obs);
  }

  unregisterObserver(obs: GameObserver): void {
    this.observers = this.observers.filter((o) => o !== obs);
  }

  protected async notifyGameOver(event: GameOverEvent): Promise<void> {
    await Promise.all(this.observers.map((obs) => obs.onGameOver(event)));
  }
}
