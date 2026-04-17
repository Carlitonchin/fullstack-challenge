import type { ProvablyFairStrategyDefinition } from "@games/domain/provably-fair/provably-fair-strategy-definition";
import type { ProvablyFairResult } from "@games/domain/provably-fair/provably-fair.errors";

export const PROVABLY_FAIR_STRATEGY_DEFINITION_REPOSITORY = Symbol(
  "PROVABLY_FAIR_STRATEGY_DEFINITION_REPOSITORY",
);

export interface IProvablyFairStrategyDefinitionRepository {
  findCurrentStrategy(): Promise<
    ProvablyFairResult<ProvablyFairStrategyDefinition | undefined>
  >;
  persist(params: {
    definition: ProvablyFairStrategyDefinition;
    createdAt?: Date;
  }): Promise<ProvablyFairResult<ProvablyFairStrategyDefinition>>;
}
