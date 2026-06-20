import { GameSettings } from '../game-setup.interface';
import { GameSetupDecorator } from '../game-setup.decorator';

export class HintsDecorator extends GameSetupDecorator {
  describe(): string {
    return `${this.game.describe()} + Hints`;
  }

  buildConfig(): GameSettings {
    return { ...this.game.buildConfig(), hintsEnabled: true };
  }
}
