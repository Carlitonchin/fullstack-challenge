import { Injectable } from "@nestjs/common";
import { EntityManager } from "@mikro-orm/postgresql";
import { Bet, BetStatus } from "@games/domain/bet/bet";
import { BetAmount, type BetCurrency } from "@games/domain/bet/bet-amount";
import { PayoutAmount } from "@games/domain/bet/payout-amount";
import {
  type BetRepositoryError,
  type BetRepositoryResult,
  BetVersionConflictError,
  type IBetRepository,
} from "@games/port/bet.repository";
import { RoundSchema } from "../schema/round";
import { BetSchema, BetStatusType, type IBet } from "../schema/bet";

@Injectable()
export class BetRepository implements IBetRepository {
  constructor(private readonly em: EntityManager) {}

  async findCurrentByPlayerIdAndRoundId(
    playerId: string,
    roundId: string,
  ): Promise<BetRepositoryResult<Bet | undefined>> {
    const record = await this.em.findOne(BetSchema, {
      playerId,
      round: roundId,
      status: { $ne: BetStatusType.REJECTED },
    });

    if (!record) {
      return BetRepository.success(undefined);
    }

    return this.mapRecord(record);
  }

  async findByRoundId(roundId: string): Promise<BetRepositoryResult<Bet[]>> {
    const records = await this.em.find(
      BetSchema,
      { round: roundId },
      { orderBy: { createdAt: "asc" }, populate: ["round"] },
    );

    const bets: Bet[] = [];

    for (const record of records) {
      const mappedBet = this.mapRecord(record);

      if (!mappedBet.success) {
        return mappedBet;
      }

      bets.push(mappedBet.data!);
    }

    return BetRepository.success(bets);
  }

  async findByPlayerId(playerId: string): Promise<BetRepositoryResult<Bet[]>> {
    const records = await this.em.find(
      BetSchema,
      { playerId },
      { orderBy: { createdAt: "desc" }, populate: ["round"] },
    );

    const bets: Bet[] = [];

    for (const record of records) {
      const mappedBet = this.mapRecord(record);

      if (!mappedBet.success) {
        return mappedBet;
      }

      bets.push(mappedBet.data!);
    }

    return BetRepository.success(bets);
  }

  async findById(id: string): Promise<BetRepositoryResult<Bet | undefined>> {
    const record = await this.em.findOne(BetSchema, { id });

    if (!record) {
      return BetRepository.success(undefined);
    }

    return this.mapRecord(record);
  }

  async persist(bet: Bet): Promise<BetRepositoryResult<Bet>> {
    const entity = this.em.create(BetSchema, {
      id: bet.id,
      version: bet.version,
      round: this.em.getReference(RoundSchema, bet.roundId),
      playerId: bet.playerId,
      playerUsername: bet.playerUsername,
      amountInCents: BigInt(bet.amountInCents),
      currency: bet.currency,
      status: this.mapStatusToSchema(bet.status),
      placedAt: bet.placedAt,
      acceptedAt: bet.acceptedAt,
      rejectedAt: bet.rejectedAt,
      rejectionReason: bet.rejectionReason,
      cashedOutAt: bet.cashedOutAt,
      cashoutMultiplier: bet.cashoutMultiplier,
      payoutAmountInCents:
        bet.payoutAmountInCents === null ? null : BigInt(bet.payoutAmountInCents),
      lostAt: bet.lostAt,
      settledAt: bet.settledAt,
      createdAt: bet.createdAt,
    });

    this.em.persist(entity);

    return BetRepository.success(bet);
  }

  async update(bet: Bet): Promise<BetRepositoryResult<Bet>> {
    const qb = this.em.createQueryBuilder(BetSchema);
    const result = await qb
      .update({
        status: this.mapStatusToSchema(bet.status),
        acceptedAt: bet.acceptedAt,
        rejectedAt: bet.rejectedAt,
        rejectionReason: bet.rejectionReason,
        playerUsername: bet.playerUsername,
        cashedOutAt: bet.cashedOutAt,
        cashoutMultiplier: bet.cashoutMultiplier,
        payoutAmountInCents:
          bet.payoutAmountInCents === null ? null : BigInt(bet.payoutAmountInCents),
        lostAt: bet.lostAt,
        settledAt: bet.settledAt,
        version: bet.version + 1,
      })
      .where({ id: bet.id, version: bet.version })
      .execute();

    if (this.extractAffectedRows(result) <= 0) {
      return BetRepository.failure(
        new BetVersionConflictError(bet.id, bet.version),
      );
    }

    return BetRepository.success(bet.withVersion(bet.version + 1));
  }

  private mapRecord(record: IBet): BetRepositoryResult<Bet> {
    const currency = record.currency as BetCurrency;

    const amountResult = BetAmount.create({
      amountInCents: Number(record.amountInCents),
      currency,
    });
    if (!amountResult.success) {
      return BetRepository.failure(amountResult.error);
    }

    const payoutAmountResult =
      record.payoutAmountInCents === null
        ? null
        : PayoutAmount.create({
            amountInCents: Number(record.payoutAmountInCents),
            currency,
          });

    if (payoutAmountResult && !payoutAmountResult.success) {
      return BetRepository.failure(payoutAmountResult.error);
    }

    const betResult = Bet.rehydrate({
      id: record.id,
      version: record.version,
      roundId: record.round.id,
      playerId: record.playerId,
      playerUsername: record.playerUsername,
      amount: amountResult.data!,
      status: this.mapStatusToDomain(record.status),
      placedAt: record.placedAt,
      acceptedAt: record.acceptedAt ?? null,
      rejectedAt: record.rejectedAt ?? null,
      rejectionReason: record.rejectionReason ?? null,
      cashedOutAt: record.cashedOutAt ?? null,
      cashoutMultiplier:
        record.cashoutMultiplier === null ? null : Number(record.cashoutMultiplier),
      payoutAmount: payoutAmountResult?.data ?? null,
      lostAt: record.lostAt ?? null,
      settledAt: record.settledAt ?? null,
      createdAt: record.createdAt,
    });

    if (!betResult.success) {
      return BetRepository.failure(betResult.error);
    }

    return BetRepository.success(betResult.data!);
  }

  private mapStatusToSchema(status: BetStatus): BetStatusType {
    return BetStatusType[status];
  }

  private mapStatusToDomain(status: BetStatusType): BetStatus {
    return BetStatus[status];
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

  private static success<T>(data: T): BetRepositoryResult<T> {
    return { success: true, data };
  }

  private static failure<T>(error: BetRepositoryError): BetRepositoryResult<T> {
    return { success: false, error };
  }
}
