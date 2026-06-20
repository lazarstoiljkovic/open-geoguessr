import { GameSettings, IGameSetup } from '../game-setup.interface';

export class EliminationGameSetup implements IGameSetup {
  describe(): string {
    return 'Elimination';
  }

  buildConfig(): GameSettings {
    return {
      gameMode: 'elimination',
      hintsEnabled: false,
      spectatorsAllowed: false,
      teamsEnabled: false,
      teamSize: 2,
    };
  }
}
