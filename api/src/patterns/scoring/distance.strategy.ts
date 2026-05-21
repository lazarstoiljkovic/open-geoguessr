import { ScoringInput, ScoringStrategy } from './scoring.strategy';
import { MAX_DISTANCE_KM, MAX_SCORE_PER_ROUND } from 'src/constants';

export class DistanceScoringStrategy implements ScoringStrategy {
  calculate({ distanceKm }: ScoringInput): number {
    if (distanceKm <= 0) return MAX_SCORE_PER_ROUND;
    const ratio = Math.max(0, 1 - distanceKm / MAX_DISTANCE_KM);
    return Math.round(MAX_SCORE_PER_ROUND * Math.pow(ratio, 2));
  }
}
