import { ScoringInput, ScoringStrategy } from './scoring.strategy';
import { DistanceScoringStrategy } from './distance.strategy';

export class ScoringContext {
  private strategy: ScoringStrategy;

  constructor(strategy: ScoringStrategy = new DistanceScoringStrategy()) {
    this.strategy = strategy;
  }

  setStrategy(strategy: ScoringStrategy): void {
    this.strategy = strategy;
  }

  calculate(input: ScoringInput): number {
    return this.strategy.calculate(input);
  }
}
