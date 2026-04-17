import {
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { Bet } from "@games/domain/bet/bet";
import {
  type Round,
  RoundStatus,
} from "@games/domain/round/round";
import {
  BETTING_WINDOW_IN_SECONDS,
  buildPublicRoundCurve,
  type RoundTimingStrategy,
} from "@games/domain/round/round-timing.strategy";
import { ROUND_TIMING_STRATEGY } from "@games/domain/round/round.tokens";
import {
  PROVABLY_FAIR_STRATEGY_DEFINITION_REPOSITORY,
  type IProvablyFairStrategyDefinitionRepository,
} from "@games/port/provably-fair-strategy-definition.repository";
import {
  ROUND_REPOSITORY,
  type RoundRepositoryError,
  type IRoundRepository,
} from "@games/port/round.repository";
import {
  BET_REPOSITORY,
  type BetRepositoryError,
  type IBetRepository,
} from "@games/port/bet.repository";
import type {
  CurrentGameSnapshotView,
  GameBetView,
  GameRoundHistoryEntryView,
  GameRoundView,
} from "./game-view.types";

const HISTORY_LIMIT = 20;

@Injectable()
export class GameQueryService {
  constructor(
    @Inject(ROUND_REPOSITORY)
    private readonly roundRepository: IRoundRepository,
    @Inject(BET_REPOSITORY)
    private readonly betRepository: IBetRepository,
    @Inject(PROVABLY_FAIR_STRATEGY_DEFINITION_REPOSITORY)
    private readonly provablyFairStrategyDefinitionRepository: IProvablyFairStrategyDefinitionRepository,
    @Inject(ROUND_TIMING_STRATEGY)
    private readonly roundTimingStrategy: RoundTimingStrategy,
  ) {}

  async getCurrentSnapshot(at: Date = new Date()): Promise<CurrentGameSnapshotView> {
    const roundResult = await this.roundRepository.findCurrentRound();

    if (!roundResult.success) {
      throw new InternalServerErrorException(
        getRepositoryErrorMessage(roundResult.error),
      );
    }

    const round = roundResult.data;

    if (!round) {
      return {
        serverTime: at.toISOString(),
        round: null,
        bets: [],
      };
    }

    const bets = await this.getRoundBets(round.id);
    const publicBets = bets.filter((bet) => isPublicBetStatus(bet.status));

    return {
      serverTime: at.toISOString(),
      round: this.mapRound(round, publicBets, at),
      bets: publicBets.map((bet) => this.mapBet(bet)),
    };
  }

  async getRoundHistory(): Promise<GameRoundHistoryEntryView[]> {
    const roundsResult = await this.roundRepository.findRecentSettledRounds(
      HISTORY_LIMIT,
    );

    if (!roundsResult.success) {
      throw new InternalServerErrorException(
        getRepositoryErrorMessage(roundsResult.error),
      );
    }

    const rounds = roundsResult.data.filter((round) => round.isSettled);
    const historyEntries: GameRoundHistoryEntryView[] = [];

    for (const round of rounds) {
      const bets = await this.getRoundBets(round.id);

      historyEntries.push({
        id: round.id,
        crashPoint: round.crashMultiplier ?? round.crashPoint,
        crashedAt:
          round.crashedAt?.toISOString() ??
          round.settlesAt?.toISOString() ??
          round.createdAt.toISOString(),
        serverSeedHash: round.serverSeedHash,
        playerCount: bets.filter((bet) => isPublicBetStatus(bet.status)).length,
      });
    }

    return historyEntries;
  }

  async getMyBets(playerId: string): Promise<GameBetView[]> {
    const normalizedPlayerId = playerId.trim();

    if (!normalizedPlayerId) {
      throw new InternalServerErrorException("Authenticated player id is missing");
    }

    const betsResult = await this.betRepository.findByPlayerId(normalizedPlayerId);

    if (!betsResult.success) {
      throw new InternalServerErrorException(
        getRepositoryErrorMessage(betsResult.error),
      );
    }

    return betsResult.data.map((bet) => this.mapBet(bet));
  }

  async getRoundVerification(roundId: string) {
    const roundResult = await this.roundRepository.findById(roundId);

    if (!roundResult.success) {
      throw new InternalServerErrorException(
        getRepositoryErrorMessage(roundResult.error),
      );
    }

    const round = roundResult.data;

    if (!round) {
      throw new NotFoundException(`Round ${roundId} was not found`);
    }

    const strategyResult =
      await this.provablyFairStrategyDefinitionRepository.findById(
        round.provablyFairStrategyId,
      );

    if (!strategyResult.success) {
      throw new InternalServerErrorException(strategyResult.error.message);
    }

    const strategy = strategyResult.data;

    if (!strategy) {
      throw new NotFoundException(
        `Strategy ${round.provablyFairStrategyId} was not found`,
      );
    }

    const snapshotResult = round.projectProvablyFairPublicSnapshot(strategy);

    if (!snapshotResult.success) {
      throw new InternalServerErrorException(snapshotResult.error.message);
    }

    return snapshotResult.data!;
  }

  private async getRoundBets(roundId: string): Promise<Bet[]> {
    const betsResult = await this.betRepository.findByRoundId(roundId);

    if (!betsResult.success) {
      throw new InternalServerErrorException(
        getRepositoryErrorMessage(betsResult.error),
      );
    }

    return betsResult.data;
  }

  private mapRound(round: Round, bets: Bet[], at: Date): GameRoundView {
    return {
      id: round.id,
      status: round.status,
      bettingOpenedAt: this.resolveBettingOpenedAt(round),
      bettingClosesAt: round.bettingClosesAt?.toISOString() ?? null,
      startsAt: round.startsAt?.toISOString() ?? null,
      startedAt: round.startedAt?.toISOString() ?? null,
      scheduledCrashAt: this.shouldExposeScheduledCrashAt(round)
        ? round.scheduledCrashAt?.toISOString() ?? null
        : null,
      settlesAt: round.settlesAt?.toISOString() ?? null,
      crashedAt: round.crashedAt?.toISOString() ?? null,
      currentMultiplier: this.resolveMultiplier(round, at),
      curve: buildPublicRoundCurve({
        crashPoint: round.crashPoint,
        startedAt: round.startedAt ?? round.startsAt ?? round.createdAt,
        scheduledCrashAt:
          round.scheduledCrashAt ?? round.startedAt ?? round.startsAt ?? round.createdAt,
      }),
      crashPoint: round.isServerSeedRevealed ? round.crashPoint : null,
      serverSeedHash: round.serverSeedHash,
      serverSeed: round.isServerSeedRevealed ? round.serverSeed : null,
      isServerSeedRevealed: round.isServerSeedRevealed,
      playerCount: bets.length,
    };
  }

  private resolveMultiplier(round: Round, at: Date): number {
    if (round.status === RoundStatus.CRASHED || round.status === RoundStatus.SETTLED) {
      return round.crashMultiplier ?? round.crashPoint;
    }

    if (
      round.status !== RoundStatus.IN_PROGRESS ||
      round.startedAt === null ||
      round.scheduledCrashAt === null
    ) {
      return 1;
    }

    return this.roundTimingStrategy.multiplierAt({
      crashPoint: round.crashPoint,
      startedAt: round.startedAt,
      scheduledCrashAt: round.scheduledCrashAt,
      at,
    });
  }

  private shouldExposeScheduledCrashAt(round: Round): boolean {
    return (
      round.status === RoundStatus.CRASHED ||
      round.status === RoundStatus.SETTLED ||
      round.status === RoundStatus.ERROR
    );
  }

  private resolveBettingOpenedAt(round: Round): string | null {
    if (round.isWaitingForFirstBet || round.bettingClosesAt === null) {
      return null;
    }

    return new Date(
      round.bettingClosesAt.getTime() - BETTING_WINDOW_IN_SECONDS * 1000,
    ).toISOString();
  }

  mapBet(bet: Bet): GameBetView {
    return {
      id: bet.id,
      roundId: bet.roundId,
      playerId: bet.playerId,
      playerUsername: bet.playerUsername,
      amountInCents: bet.amountInCents,
      currency: bet.currency,
      status: bet.status,
      acceptedAt: bet.acceptedAt?.toISOString() ?? null,
      rejectedAt: bet.rejectedAt?.toISOString() ?? null,
      rejectionReason: bet.rejectionReason,
      cashoutMultiplier: bet.cashoutMultiplier,
      payoutAmountInCents: bet.payoutAmountInCents,
      createdAt: bet.createdAt.toISOString(),
      settledAt: bet.settledAt?.toISOString() ?? null,
    };
  }
}

function isPublicBetStatus(status: Bet["status"]): boolean {
  return (
    status === "ACCEPTED" ||
    status === "CASHED_OUT" ||
    status === "LOST" ||
    status === "SETTLED"
  );
}

function getRepositoryErrorMessage(
  error: Error | RoundRepositoryError | BetRepositoryError | { name: string },
): string {
  if (error instanceof Error) {
    return error.message;
  }

  return error.name;
}
