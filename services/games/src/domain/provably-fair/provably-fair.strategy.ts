import type {
  ProvablyFairCommitment,
  ProvablyFairInputs,
  ProvablyFairOutcome,
} from "./provably-fair.types";

export interface ProvablyFairStrategy {
  commit(serverSeed: string): ProvablyFairCommitment;
  generate(inputs: ProvablyFairInputs): ProvablyFairOutcome;
  verify(inputs: ProvablyFairInputs, expectedCrashPoint: number): boolean;
}
