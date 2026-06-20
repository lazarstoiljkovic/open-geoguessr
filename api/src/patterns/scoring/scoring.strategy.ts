export interface ScoringInput {
  distanceKm: number;
  timeTakenSeconds: number;
  roundDurationSeconds: number;
  hintsUsed?: number;
}

export interface ScoringStrategy {
  calculate(input: ScoringInput): number;
}
