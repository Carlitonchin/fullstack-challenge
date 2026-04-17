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
    definition,
    createdAt,
  }: {
    definition: ProvablyFairStrategyDefinition;
    createdAt?: Date;
  }): Promise<ProvablyFairResult<ProvablyFairStrategyDefinition>> {
    const persistedRecord = createProvablyFairStrategyDefinitionSnapshotRecord({
      id: definition.id,
      algorithm: definition.algorithm,
      displayName: definition.displayName,
      description: definition.description,
      hashAlgorithm: definition.hashAlgorithm,
      outcomeAlgorithm: definition.outcomeAlgorithm,
      houseEdgeDescription: definition.houseEdgeDescription,
      verificationFormula: definition.verificationFormula,
      verificationSteps: definition.verificationSteps,
      createdAt,
    });
    const existingEntity = await this.em.findOne(
      ProvablyFairStrategyDefinitionSchema,
      { id: definition.id },
    );

    if (existingEntity) {
      existingEntity.algorithm = persistedRecord.algorithm;
      existingEntity.displayName = persistedRecord.displayName;
      existingEntity.description = persistedRecord.description;
      existingEntity.hashAlgorithm = persistedRecord.hashAlgorithm;
      existingEntity.outcomeAlgorithm = persistedRecord.outcomeAlgorithm;
      existingEntity.houseEdgeDescription = persistedRecord.houseEdgeDescription;
      existingEntity.verificationFormula = persistedRecord.verificationFormula;
      existingEntity.verificationSteps = persistedRecord.verificationSteps;

      if (createdAt) {
        existingEntity.createdAt = persistedRecord.createdAt;
      }
    } else {
      const entity = this.em.create(
        ProvablyFairStrategyDefinitionSchema,
        persistedRecord,
      );

      this.em.persist(entity);
    }

    return ProvablyFairStrategyDefinitionRepository.success(definition);
  }

  private mapRecord(
    record: IProvablyFairStrategyDefinitionSnapshot,
  ): ProvablyFairResult<ProvablyFairStrategyDefinition> {
    const verificationSteps =
      record.verificationSteps as PersistedProvablyFairVerificationStep[];
    const result = ProvablyFairStrategyDefinition.create({
      id: record.id,
      algorithm: record.algorithm,
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
