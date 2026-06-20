import { ScoringInput, ScoringStrategy } from './scoring.strategy';
import { MAX_DISTANCE_KM, MAX_SCORE_PER_ROUND } from 'src/constants';

// Nezavisan algoritam — kombinuje distancu (70%) i brzinu (30%) kroz sopstvenu formulu.
// Ne oslanja se na DistanceScoringStrategy.
export class TimeBonusScoringStrategy implements ScoringStrategy {
  calculate({ distanceKm, timeTakenSeconds, roundDurationSeconds }: ScoringInput): number {
    const distanceRatio = Math.max(0, 1 - distanceKm / MAX_DISTANCE_KM);
    const timeRatio = Math.max(0, 1 - timeTakenSeconds / roundDurationSeconds);
    const score = MAX_SCORE_PER_ROUND * (0.7 * Math.pow(distanceRatio, 2) + 0.3 * timeRatio);
    return Math.round(score);
  }
}
