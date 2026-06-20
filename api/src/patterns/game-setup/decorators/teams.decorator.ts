import { GameSettings, IGameSetup } from '../game-setup.interface';
import { GameSetupDecorator } from '../game-setup.decorator';

export class TeamsDecorator extends GameSetupDecorator {
  constructor(game: IGameSetup, private readonly teamSize: number = 2) {
    super(game);
  }

  describe(): string {
    return `${this.game.describe()} + Teams (${this.teamSize}v${this.teamSize})`;
  }

  buildConfig(): GameSettings {
    return { ...this.game.buildConfig(), teamsEnabled: true, teamSize: this.teamSize };
  }
}
