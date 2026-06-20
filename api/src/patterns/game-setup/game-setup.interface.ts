import { GameMode } from 'src/types';

export interface GameSettings {
  gameMode: GameMode;
  hintsEnabled: boolean;
  spectatorsAllowed: boolean;
  teamsEnabled: boolean;
  teamSize: number;
}

export interface IGameSetup {
  describe(): string;
  buildConfig(): GameSettings;
}
