import { GameSettings, IGameSetup } from '../game-setup.interface';

export class StandardGameSetup implements IGameSetup {
  describe(): string {
    return 'Standard';
  }

  buildConfig(): GameSettings {
    return {
      gameMode: 'standard',
      hintsEnabled: false,
      spectatorsAllowed: false,
      teamsEnabled: false,
      teamSize: 2,
    };
  }
}
