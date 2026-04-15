import type { ProvablyFairStrategyDefinition } from "./provably-fair-strategy-definition";
import type {
  ProvablyFairCommitment,
  ProvablyFairInputs,
  ProvablyFairOutcome,
} from "./provably-fair.types";

export interface ProvablyFairStrategy {
  readonly definition: ProvablyFairStrategyDefinition;
  commit(serverSeed: string): ProvablyFairCommitment;
  generate(inputs: ProvablyFairInputs): ProvablyFairOutcome;
  verify(inputs: ProvablyFairInputs, expectedCrashPoint: number): boolean;
}
