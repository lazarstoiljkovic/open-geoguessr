import { ScoringInput, ScoringStrategy } from './scoring.strategy';

// Bazna Decorator klasa — implementira isti interfejs kao komponenta,
// čuva referencu na umotanu strategiju i po defaultu samo prosleđuje poziv.
export abstract class ScoringDecorator implements ScoringStrategy {
  constructor(protected readonly strategy: ScoringStrategy) {}

  calculate(input: ScoringInput): number {
    return this.strategy.calculate(input);
  }
}
