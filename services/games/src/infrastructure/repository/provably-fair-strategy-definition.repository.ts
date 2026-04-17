import { Injectable } from "@nestjs/common";
import { EntityManager } from "@mikro-orm/postgresql";
import { ProvablyFairStrategyDefinition } from "@games/domain/provably-fair/provably-fair-strategy-definition";
import type {
  ProvablyFairDomainDefinitionError,
  ProvablyFairResult,
} from "@games/domain/provably-fair/provably-fair.errors";
import type { IProvablyFairStrategyDefinitionRepository } from "@games/port/provably-fair-strategy-definition.repository";
import {
  createProvablyFairStrategyDefinitionSnapshotRecord,
  type IProvablyFairStrategyDefinitionSnapshot,
  type PersistedProvablyFairVerificationStep,
  ProvablyFairStrategyDefinitionSchema,
} from "../schema/provably-fair-strategy-definition";

@Injectable()
export class ProvablyFairStrategyDefinitionRepository
  implements IProvablyFairStrategyDefinitionRepository
{
  constructor(private readonly em: EntityManager) {}

  async findCurrentStrategy(
  ): Promise<ProvablyFairResult<ProvablyFairStrategyDefinition | undefined>> {
    const record = await this.em.findOne(
      ProvablyFairStrategyDefinitionSchema,
      {},
      { orderBy: { createdAt: "desc" } },
    );

    if (!record) {
      return ProvablyFairStrategyDefinitionRepository.success(undefined);
    }

    return this.mapRecord(record);
  }

  async persist({
    snapshotId,
    definition,
    createdAt,
  }: {
    snapshotId: string;
    definition: ProvablyFairStrategyDefinition;
    createdAt?: Date;
  }): Promise<ProvablyFairResult<ProvablyFairStrategyDefinition>> {
    const entity = this.em.create(
      ProvablyFairStrategyDefinitionSchema,
      createProvablyFairStrategyDefinitionSnapshotRecord({
        id: snapshotId,
        strategyId: definition.id,
        algorithm: definition.algorithm,
        version: definition.version,
        displayName: definition.displayName,
        description: definition.description,
        hashAlgorithm: definition.hashAlgorithm,
        outcomeAlgorithm: definition.outcomeAlgorithm,
        houseEdgeDescription: definition.houseEdgeDescription,
        verificationFormula: definition.verificationFormula,
        verificationSteps: definition.verificationSteps,
        createdAt,
      }),
    );

    this.em.persist(entity);

    return ProvablyFairStrategyDefinitionRepository.success(definition);
  }

  private mapRecord(
    record: IProvablyFairStrategyDefinitionSnapshot,
  ): ProvablyFairResult<ProvablyFairStrategyDefinition> {
    const verificationSteps =
      record.verificationSteps as PersistedProvablyFairVerificationStep[];
    const result = ProvablyFairStrategyDefinition.create({
      id: record.strategyId,
      algorithm: record.algorithm,
      version: record.version,
      displayName: record.displayName,
      description: record.description,
      hashAlgorithm: record.hashAlgorithm,
      outcomeAlgorithm: record.outcomeAlgorithm,
      houseEdgeDescription: record.houseEdgeDescription,
      verificationFormula: record.verificationFormula,
      verificationSteps: verificationSteps.map((step) => ({
        order: step.order,
        instruction: step.instruction,
      })),
    });

    if (!result.success) {
      return ProvablyFairStrategyDefinitionRepository.failure(result.error);
    }

    return ProvablyFairStrategyDefinitionRepository.success(result.data!);
  }

  private static success<T>(data: T): ProvablyFairResult<T> {
    return { success: true, data };
  }

  private static failure<T>(
    error: ProvablyFairDomainDefinitionError,
  ): ProvablyFairResult<T> {
    return { success: false, error };
  }
}
