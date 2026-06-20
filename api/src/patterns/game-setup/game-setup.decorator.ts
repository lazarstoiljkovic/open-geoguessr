import { GameSettings, IGameSetup } from './game-setup.interface';

export abstract class GameSetupDecorator implements IGameSetup {
  constructor(protected readonly game: IGameSetup) {}

  describe(): string {
    return this.game.describe();
  }

  buildConfig(): GameSettings {
    return this.game.buildConfig();
  }
}
