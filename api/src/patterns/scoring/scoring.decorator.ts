import { ScoringInput, ScoringStrategy } from './scoring.strategy';

export abstract class ScoringDecorator implements ScoringStrategy {
  constructor(protected readonly strategy: ScoringStrategy) {}

  calculate(input: ScoringInput): number {
    return this.strategy.calculate(input);
  }
}
