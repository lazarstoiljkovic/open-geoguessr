import { ScoringInput, ScoringStrategy } from './scoring.strategy';
import { DistanceScoringStrategy } from './distance.strategy';

const MAX_TIME_BONUS = 1000;

export class TimeBonusScoringStrategy implements ScoringStrategy {
  private readonly base = new DistanceScoringStrategy();

  calculate(input: ScoringInput): number {
    const baseScore = this.base.calculate(input);
    if (baseScore === 0) return 0;
    const timeRatio = Math.max(0, 1 - input.timeTakenSeconds / input.roundDurationSeconds);
    const timeBonus = Math.round(MAX_TIME_BONUS * timeRatio);
    return baseScore + timeBonus;
  }
}
