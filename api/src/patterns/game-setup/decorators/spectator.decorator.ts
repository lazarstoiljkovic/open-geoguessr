import { GameSettings } from '../game-setup.interface';
import { GameSetupDecorator } from '../game-setup.decorator';

export class SpectatorDecorator extends GameSetupDecorator {
  describe(): string {
    return `${this.game.describe()} + Spectators`;
  }

  buildConfig(): GameSettings {
    return { ...this.game.buildConfig(), spectatorsAllowed: true };
  }
}
