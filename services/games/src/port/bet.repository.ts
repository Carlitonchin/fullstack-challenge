import type { Bet } from "@games/domain/bet/bet";
import type { BetDomainError } from "@games/domain/bet/bet.errors";

export const BET_REPOSITORY = Symbol("BET_REPOSITORY");

export class BetVersionConflictError {
  name: string;

  constructor(
    readonly betId: string,
    readonly expectedVersion: number,
  ) {
    this.name = "BetVersionConflictError";
  }
}

export interface IBetRepository {
  findCurrentByPlayerIdAndRoundId(
    playerId: string,
    roundId: string,
  ): Promise<BetRepositoryResult<Bet | undefined>>;
  findByRoundId(roundId: string): Promise<BetRepositoryResult<Bet[]>>;
  findByPlayerId(playerId: string): Promise<BetRepositoryResult<Bet[]>>;
  findPageByPlayerId(
    playerId: string,
    limit: number,
    offset: number,
  ): Promise<BetRepositoryResult<Bet[]>>;
  countByPlayerId(playerId: string): Promise<BetRepositoryResult<number>>;
  findById(id: string): Promise<BetRepositoryResult<Bet | undefined>>;
  persist(bet: Bet): Promise<BetRepositoryResult<Bet>>;
  update(bet: Bet): Promise<BetRepositoryResult<Bet>>;
}

export type BetRepositoryError = BetDomainError | BetVersionConflictError;

export type BetRepositoryResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: BetRepositoryError };
