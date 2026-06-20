import { ScoringInput } from './scoring.strategy';
import { ScoringDecorator } from './scoring.decorator';

const ACCURACY_THRESHOLD_KM = 100;
const ACCURACY_BONUS = 0.20; // +20% na finalni skor za pogodak unutar 100 km

export class AccuracyBonusDecorator extends ScoringDecorator {
  calculate(input: ScoringInput): number {
    const base = this.strategy.calculate(input);
    if (input.distanceKm <= ACCURACY_THRESHOLD_KM) {
      return Math.round(base * (1 + ACCURACY_BONUS));
    }
    return base;
  }
}
