import type { Round } from "@games/domain/round/round";
import type {
  RoundDomainError,
} from "@games/domain/round/round.errors";

export const ROUND_REPOSITORY = Symbol("ROUND_REPOSITORY");

export class RoundVersionConflictError {
  name: string;
  constructor(
    readonly roundId: string,
    readonly expectedVersion: number,
  ) {
    this.name = "RoundVersionConflictError";
  }
}

export interface IRoundRepository {
  findCurrentRound(): Promise<RoundRepositoryResult<Round | undefined>>;
  findById(id: string): Promise<RoundRepositoryResult<Round | undefined>>;
  findRecentSettledRounds(limit: number): Promise<RoundRepositoryResult<Round[]>>;
  findSettledRoundsPage(
    limit: number,
    offset: number,
  ): Promise<RoundRepositoryResult<Round[]>>;
  countSettledRounds(): Promise<RoundRepositoryResult<number>>;
  persist(round: Round): Promise<RoundRepositoryResult<Round>>;
  update(round: Round): Promise<RoundRepositoryResult<Round>>;
}

export type RoundRepositoryError = RoundDomainError | RoundVersionConflictError;

export type RoundRepositoryResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: RoundRepositoryError };
