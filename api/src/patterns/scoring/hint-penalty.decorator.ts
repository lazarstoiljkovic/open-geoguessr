import { ScoringInput } from './scoring.strategy';
import { ScoringDecorator } from './scoring.decorator';

const HINT_PENALTY = 0.15; // 15% kazna po iskorišćenom hintu

export class HintPenaltyDecorator extends ScoringDecorator {
  calculate(input: ScoringInput): number {
    const base = this.strategy.calculate(input);
    const hintsUsed = input.hintsUsed ?? 0;
    if (hintsUsed === 0) return base;
    const multiplier = Math.pow(1 - HINT_PENALTY, hintsUsed);
    return Math.round(base * multiplier);
  }
}
