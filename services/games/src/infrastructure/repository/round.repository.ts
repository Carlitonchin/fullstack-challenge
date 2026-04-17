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
    const [record] = await this.em.find(
      RoundSchema,
      {},
      {
        orderBy: { createdAt: "desc" },
        limit: 1,
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

  async findRecentSettledRounds(
    limit: number,
  ): Promise<RoundRepositoryResult<Round[]>> {
    const records = await this.em.find(
      RoundSchema,
      { status: RoundStatusType.SETTLED },
      {
        orderBy: { createdAt: "desc" },
        limit,
        populate: ["provablyFairStrategy"],
      },
    );

    const rounds: Round[] = [];

    for (const record of records) {
      const mappedRound = this.mapRecord(record);

      if (!mappedRound.success) {
        return mappedRound;
      }

      rounds.push(mappedRound.data!);
    }

    return RoundRepository.success(rounds);
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
        startsAt: round.startsAt,
        startedAt: round.startedAt,
        bettingClosesAt: round.bettingClosesAt,
        scheduledCrashAt: round.scheduledCrashAt,
        settlesAt: round.settlesAt,
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
        startsAt: round.startsAt,
        startedAt: round.startedAt,
        bettingClosesAt: round.bettingClosesAt,
        scheduledCrashAt: round.scheduledCrashAt,
        settlesAt: round.settlesAt,
        crashedAt: round.crashedAt,
        crashMultiplier: round.crashMultiplier,
        failedAt: round.failedAt,
        errorReason: round.errorReason,
        refundRequired: round.refundRequired,
        version: round.version + 1,
      })
      .where({ id: round.id, version: round.version })
      .execute();

    if (this.extractAffectedRows(result) <= 0) {
      return RoundRepository.failure(
        new RoundVersionConflictError(round.id, round.version),
      );
    }

    return RoundRepository.success(round.withVersion(round.version + 1));
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
      startsAt: record.startsAt,
      startedAt: record.startedAt ?? null,
      bettingClosesAt: record.bettingClosesAt,
      scheduledCrashAt: record.scheduledCrashAt,
      settlesAt: record.settlesAt,
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
