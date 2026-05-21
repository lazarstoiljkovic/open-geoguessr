import { ScoringStrategy } from '../scoring/scoring.strategy';
import { DistanceScoringStrategy } from '../scoring/distance.strategy';

export type GameMode = 'famous' | 'world';
export type LocationMode = 'famous' | 'world';

export interface GameConfig {
  totalRounds: number;
  roundDurationSeconds: number;
  scoringStrategy: ScoringStrategy;
  locationMode: LocationMode;
}

export class GameFactory {
  static create(mode: GameMode, durationSeconds = 60, totalRounds = 5): GameConfig {
    return {
      totalRounds,
      roundDurationSeconds: durationSeconds,
      scoringStrategy: new DistanceScoringStrategy(),
      locationMode: mode,
    };
  }
}
