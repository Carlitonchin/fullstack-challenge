import {
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { Bet } from "@games/domain/bet/bet";
import type { ProvablyFairStrategy } from "@games/domain/provably-fair/provably-fair.strategy";
import { PROVABLY_FAIR_STRATEGY } from "@games/domain/provably-fair/provably-fair.tokens";
import type { ProvablyFairStrategyDefinition } from "@games/domain/provably-fair/provably-fair-strategy-definition";
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
import {
  buildPaginatedResponse,
} from "./paginated-response";
import type {
  CurrentGameSnapshotView,
  GameBetView,
  GameRoundFairnessView,
  GameRoundHistoryEntryView,
  GameRoundView,
  PaginatedGameBetView,
  PaginatedGameRoundHistoryView,
  PreviousRoundProofView,
} from "./game-view.types";
const PREVIOUS_ROUND_PROOF_LIMIT = 2;

@Injectable()
export class GameQueryService {
  constructor(
    @Inject(ROUND_REPOSITORY)
    private readonly roundRepository: IRoundRepository,
    @Inject(BET_REPOSITORY)
    private readonly betRepository: IBetRepository,
    @Inject(PROVABLY_FAIR_STRATEGY_DEFINITION_REPOSITORY)
    private readonly provablyFairStrategyDefinitionRepository: IProvablyFairStrategyDefinitionRepository,
    @Inject(PROVABLY_FAIR_STRATEGY)
    private readonly provablyFairStrategy: ProvablyFairStrategy,
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

    const fairness = await this.projectRoundFairness(round, at);

    return {
      serverTime: at.toISOString(),
      round: this.mapRound(round, publicBets, at, fairness),
      bets: publicBets.map((bet) => this.mapBet(bet)),
    };
  }

  async getRoundHistory(params: {
    page: number;
    limit: number;
    offset: number;
  }): Promise<PaginatedGameRoundHistoryView> {
    const [roundsResult, totalRoundsResult] = await Promise.all([
      this.roundRepository.findSettledRoundsPage(params.limit, params.offset),
      this.roundRepository.countSettledRounds(),
    ]);

    if (!roundsResult.success) {
      throw new InternalServerErrorException(
        getRepositoryErrorMessage(roundsResult.error),
      );
    }

    if (!totalRoundsResult.success) {
      throw new InternalServerErrorException(
        getRepositoryErrorMessage(totalRoundsResult.error),
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

    return buildPaginatedResponse({
      items: historyEntries,
      page: params.page,
      limit: params.limit,
      totalItems: totalRoundsResult.data,
    });
  }

  async getMyBets(
    playerId: string,
    params: {
      page: number;
      limit: number;
      offset: number;
    },
  ): Promise<PaginatedGameBetView> {
    const normalizedPlayerId = playerId.trim();

    if (!normalizedPlayerId) {
      throw new InternalServerErrorException("Authenticated player id is missing");
    }

    const [betsResult, totalBetsResult] = await Promise.all([
      this.betRepository.findPageByPlayerId(
        normalizedPlayerId,
        params.limit,
        params.offset,
      ),
      this.betRepository.countByPlayerId(normalizedPlayerId),
    ]);

    if (!betsResult.success) {
      throw new InternalServerErrorException(
        getRepositoryErrorMessage(betsResult.error),
      );
    }

    if (!totalBetsResult.success) {
      throw new InternalServerErrorException(
        getRepositoryErrorMessage(totalBetsResult.error),
      );
    }

    const roundCrashMultipliers = new Map<string, number | null>();
    const betViews: GameBetView[] = [];

    for (const bet of betsResult.data) {
      if (!roundCrashMultipliers.has(bet.roundId)) {
        roundCrashMultipliers.set(
          bet.roundId,
          await this.resolveRoundCrashMultiplier(bet.roundId),
        );
      }

      betViews.push(
        this.mapBet(bet, {
          roundCrashMultiplier: shouldShowRoundCrashMultiplier(bet.status)
            ? roundCrashMultipliers.get(bet.roundId) ?? null
            : null,
        }),
      );
    }

    return buildPaginatedResponse({
      items: betViews,
      page: params.page,
      limit: params.limit,
      totalItems: totalBetsResult.data,
    });
  }

  async getBetById(betId: string): Promise<GameBetView | null> {
    const normalizedBetId = betId.trim();

    if (!normalizedBetId) {
      throw new InternalServerErrorException("Bet id is missing");
    }

    const betResult = await this.betRepository.findById(normalizedBetId);

    if (!betResult.success) {
      throw new InternalServerErrorException(
        getRepositoryErrorMessage(betResult.error),
      );
    }

    const bet = betResult.data;

    if (!bet) {
      return null;
    }

    return this.mapBet(bet, {
      roundCrashMultiplier: shouldShowRoundCrashMultiplier(bet.status)
        ? await this.resolveRoundCrashMultiplier(bet.roundId)
        : null,
    });
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

    const strategy = await this.getStrategyDefinition(round.provablyFairStrategyId);
    const snapshot = this.projectRoundProvablyFairSnapshot(round, strategy);

    return {
      ...snapshot,
      publishedAt: round.createdAt.toISOString(),
    };
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

  private async projectRoundFairness(
    round: Round,
    at: Date,
  ): Promise<GameRoundFairnessView> {
    const strategy = await this.getStrategyDefinition(round.provablyFairStrategyId);
    const previousRoundProof = await this.resolvePreviousRoundProof(round.id);
    const publicSnapshot = this.projectRoundProvablyFairSnapshot(round, strategy);

    return {
      nonce: publicSnapshot.nonce,
      commitment: {
        serverSeedHash: publicSnapshot.serverSeedHash,
        isSeedRevealed: publicSnapshot.isServerSeedRevealed,
      },
      strategy: {
        strategyId: publicSnapshot.strategyId,
        strategyDisplayName: publicSnapshot.strategyDisplayName,
        algorithm: publicSnapshot.algorithm,
        hashAlgorithm: publicSnapshot.hashAlgorithm,
        outcomeAlgorithm: publicSnapshot.outcomeAlgorithm,
        houseEdgeDescription: publicSnapshot.houseEdgeDescription,
        verificationFormula: publicSnapshot.verificationFormula,
        verificationSteps: publicSnapshot.verificationSteps,
      },
      timeline: {
        publishedAt: round.createdAt.toISOString(),
        bettingOpenedAt: this.resolveBettingOpenedAt(round),
        bettingClosesAt: round.bettingClosesAt?.toISOString() ?? null,
        startsAt: round.startsAt?.toISOString() ?? null,
        serverTime: at.toISOString(),
      },
      curve: buildPublicRoundCurve({
        crashPoint: round.crashPoint,
        startedAt: round.startedAt ?? round.startsAt ?? round.createdAt,
        scheduledCrashAt:
          round.scheduledCrashAt ?? round.startedAt ?? round.startsAt ?? round.createdAt,
      }),
      previousRoundProof,
    };
  }

  private mapRound(
    round: Round,
    bets: Bet[],
    at: Date,
    fairness: GameRoundFairnessView,
  ): GameRoundView {
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
      fairness,
    };
  }

  private async resolvePreviousRoundProof(
    currentRoundId: string,
  ): Promise<PreviousRoundProofView | null> {
    const roundsResult = await this.roundRepository.findRecentSettledRounds(
      PREVIOUS_ROUND_PROOF_LIMIT,
    );

    if (!roundsResult.success) {
      throw new InternalServerErrorException(
        getRepositoryErrorMessage(roundsResult.error),
      );
    }

    const previousRound = roundsResult.data.find(
      (round) => round.id !== currentRoundId && round.isSettled,
    );

    if (!previousRound || !previousRound.isServerSeedRevealed) {
      return null;
    }

    const crashPoint = previousRound.crashMultiplier ?? previousRound.crashPoint;

    return {
      roundId: previousRound.id,
      serverSeedHash: previousRound.serverSeedHash,
      serverSeed: previousRound.serverSeed,
      nonce: previousRound.nonce,
      crashPoint,
      verified: this.verifyRoundProof(previousRound, crashPoint),
    };
  }

  private verifyRoundProof(round: Round, expectedCrashPoint: number): boolean {
    if (!round.isServerSeedRevealed) {
      return false;
    }

    if (this.provablyFairStrategy.definition.id !== round.provablyFairStrategyId) {
      return false;
    }

    return this.provablyFairStrategy.verify(
      {
        serverSeed: round.serverSeed,
        nonce: round.nonce,
      },
      expectedCrashPoint,
    );
  }

  private async getStrategyDefinition(
    strategyId: string,
  ): Promise<ProvablyFairStrategyDefinition> {
    const strategyResult =
      await this.provablyFairStrategyDefinitionRepository.findById(strategyId);

    if (!strategyResult.success) {
      throw new InternalServerErrorException(strategyResult.error.message);
    }

    const strategy = strategyResult.data;

    if (!strategy) {
      throw new NotFoundException(`Strategy ${strategyId} was not found`);
    }

    return strategy;
  }

  private projectRoundProvablyFairSnapshot(
    round: Round,
    strategy: ProvablyFairStrategyDefinition,
  ) {
    const snapshotResult = round.projectProvablyFairPublicSnapshot(strategy);

    if (!snapshotResult.success) {
      throw new InternalServerErrorException(snapshotResult.error.message);
    }

    return snapshotResult.data!;
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

  private async resolveRoundCrashMultiplier(roundId: string): Promise<number | null> {
    const roundResult = await this.roundRepository.findById(roundId);

    if (!roundResult.success) {
      throw new InternalServerErrorException(
        getRepositoryErrorMessage(roundResult.error),
      );
    }

    const round = roundResult.data;

    if (
      !round ||
      (round.status !== RoundStatus.CRASHED && round.status !== RoundStatus.SETTLED)
    ) {
      return null;
    }

    return round.crashMultiplier ?? round.crashPoint;
  }

  mapBet(
    bet: Bet,
    options: { roundCrashMultiplier?: number | null } = {},
  ): GameBetView {
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
      roundCrashMultiplier: options.roundCrashMultiplier ?? null,
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

function shouldShowRoundCrashMultiplier(status: Bet["status"]): boolean {
  return status === "CASHED_OUT" || status === "LOST" || status === "SETTLED";
}

function getRepositoryErrorMessage(
  error: Error | RoundRepositoryError | BetRepositoryError | { name: string },
): string {
  if (error instanceof Error) {
    return error.message;
  }

  return error.name;
}
