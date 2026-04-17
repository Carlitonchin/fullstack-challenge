import { Injectable } from "@nestjs/common";
import { EntityManager } from "@mikro-orm/postgresql";
import { Round, RoundStatus } from "@games/domain/round/round";
import type { RoundDomainError } from "@games/domain/round/round.errors";
import {
  type IRoundRepository,
  type RoundRepositoryError,
  type RoundRepositoryResult,
  RoundVersionConflictError,
} from "@games/port/round.repository";
import { ProvablyFairStrategyDefinitionSchema } from "../schema/provably-fair-strategy-definition";
import { type IRound, RoundSchema, RoundStatusType } from "../schema/round";

@Injectable()
export class RoundRepository implements IRoundRepository {
  constructor(private readonly em: EntityManager) {}

  async findCurrentRound(): Promise<RoundRepositoryResult<Round | undefined>> {
    const record = await this.em.findOne(
      RoundSchema,
      {},
      {
        orderBy: { createdAt: "desc" },
        populate: ["provablyFairStrategy"],
      },
    );

    if (!record) {
      return RoundRepository.success(undefined);
    }

    return this.mapRecord(record);
  }

  async findById(id: string): Promise<RoundRepositoryResult<Round | undefined>> {
    const record = await this.em.findOne(
      RoundSchema,
      { id },
      { populate: ["provablyFairStrategy"] },
    );

    if (!record) {
      return RoundRepository.success(undefined);
    }

    return this.mapRecord(record);
  }

  async persist(round: Round): Promise<RoundRepositoryResult<Round>> {
    const entity = this.em.create(
      RoundSchema,
      {
        id: round.id,
        version: round.version,
        status: this.mapStatusToSchema(round.status),
        crashPoint: round.crashPoint,
        provablyFairStrategy: this.em.getReference(
          ProvablyFairStrategyDefinitionSchema,
          round.provablyFairStrategyId,
        ),
        nonce: round.nonce,
        serverSeedHash: round.serverSeedHash,
        serverSeed: round.serverSeed,
        startedAt: round.startedAt,
        bettingClosesAt: round.bettingClosesAt,
        crashedAt: round.crashedAt,
        crashMultiplier: round.crashMultiplier,
        failedAt: round.failedAt,
        errorReason: round.errorReason,
        refundRequired: round.refundRequired,
        createdAt: round.createdAt,
      },
    );

    this.em.persist(entity);

    return RoundRepository.success(round);
  }

  async update(round: Round): Promise<RoundRepositoryResult<Round>> {
    const qb = this.em.createQueryBuilder(RoundSchema);
    const result = await qb
      .update({
        status: this.mapStatusToSchema(round.status),
        crashPoint: round.crashPoint,
        provablyFairStrategy: round.provablyFairStrategyId,
        nonce: round.nonce,
        serverSeedHash: round.serverSeedHash,
        serverSeed: round.serverSeed,
        startedAt: round.startedAt,
        bettingClosesAt: round.bettingClosesAt,
        crashedAt: round.crashedAt,
        crashMultiplier: round.crashMultiplier,
        failedAt: round.failedAt,
        errorReason: round.errorReason,
        refundRequired: round.refundRequired,
        version: round.version + 1,
      })
      .where({ id: round.id, version: round.version })
      .execute();

    if (result.affectedRows <= 0) {
      return RoundRepository.failure(
        new RoundVersionConflictError(round.id, round.version),
      );
    }

    return RoundRepository.success(round);
  }

  private mapRecord(record: IRound): RoundRepositoryResult<Round> {
    const roundResult = Round.rehydrate({
      id: record.id,
      version: record.version,
      status: this.mapStatusToDomain(record.status),
      crashPoint: Number(record.crashPoint),
      provablyFairStrategyId: record.provablyFairStrategy.id,
      nonce: record.nonce,
      serverSeedHash: record.serverSeedHash,
      serverSeed: record.serverSeed,
      startedAt: record.startedAt ?? null,
      bettingClosesAt: record.bettingClosesAt,
      crashedAt: record.crashedAt ?? null,
      crashMultiplier:
        record.crashMultiplier === null ? null : Number(record.crashMultiplier),
      failedAt: record.failedAt ?? null,
      errorReason: record.errorReason ?? null,
      refundRequired: record.refundRequired,
      createdAt: record.createdAt,
    });

    if (!roundResult.success) {
      return RoundRepository.failure(roundResult.error);
    }

    return RoundRepository.success(roundResult.data!);
  }

  private mapStatusToSchema(status: RoundStatus): RoundStatusType {
    return RoundStatusType[status];
  }

  private mapStatusToDomain(status: RoundStatusType): RoundStatus {
    return RoundStatus[status];
  }

  private extractAffectedRows(result: unknown): number {
    if (
      result &&
      typeof result === "object" &&
      "affectedRows" in result &&
      typeof result.affectedRows === "number"
    ) {
      return result.affectedRows;
    }

    return 0;
  }

  private static success<T>(data: T): RoundRepositoryResult<T> {
    return { success: true, data };
  }

  private static failure<T>(error: RoundRepositoryError): RoundRepositoryResult<T> {
    return { success: false, error };
  }
}
