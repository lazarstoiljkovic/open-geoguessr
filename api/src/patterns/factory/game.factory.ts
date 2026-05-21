import { ScoringStrategy } from '../scoring/scoring.strategy';
import { DistanceScoringStrategy } from '../scoring/distance.strategy';
import { GameMode } from 'src/types';

export type LocationMode = 'famous' | 'world';
export { GameMode };

export interface GameConfig {
  totalRounds: number;
  roundDurationSeconds: number;
  scoringStrategy: ScoringStrategy;
  locationMode: LocationMode;
  gameMode: GameMode;
}

export class GameFactory {
  static create(locationMode: LocationMode = 'famous', durationSeconds = 60, totalRounds = 5, gameMode: GameMode = 'standard'): GameConfig {
    return {
      // For elimination, totalRounds is a large cap — actual end is determined by player count
      totalRounds: gameMode === 'elimination' ? 99 : totalRounds,
      roundDurationSeconds: durationSeconds,
      scoringStrategy: new DistanceScoringStrategy(),
      locationMode,
      gameMode,
    };
  }
}
