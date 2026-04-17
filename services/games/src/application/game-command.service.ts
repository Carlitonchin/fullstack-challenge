import { UniqueConstraintViolationException } from "@mikro-orm/core";
import { EntityManager } from "@mikro-orm/postgresql";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import type {
  BrokerEnvelope,
  BrokerEnvelopeMetadata,
  BetDebitFailedData,
  BetDebitSucceededData,
  BetRefundFailedData,
  BetRefundSucceededData,
  CashoutCreditFailedData,
  CashoutCreditSucceededData,
} from "@crash/messaging";
import { Bet, BetStatus } from "@games/domain/bet/bet";
import { BetAmount } from "@games/domain/bet/bet-amount";
import type { Round } from "@games/domain/round/round";
import { RoundStatus } from "@games/domain/round/round";
import {
  BETTING_WINDOW_IN_SECONDS,
  ROUND_CRASH_REVEAL_IN_MS,
  ROUND_START_DELAY_IN_MS,
  type RoundTimingStrategy,
} from "@games/domain/round/round-timing.strategy";
import { ROUND_TIMING_STRATEGY } from "@games/domain/round/round.tokens";
import { GameOutboxService } from "@games/application/game-outbox.service";
import { GameQueryService } from "@games/application/game-query.service";
import type { GameBetView, GameCashOutResponseView } from "@games/application/game-view.types";
import { parseAmountInCents } from "@games/application/amount-in-cents.parser";
import { GameRealtimePublisher } from "@games/application/game-realtime.publisher";
import {
  BET_REPOSITORY,
  type BetRepositoryError,
  BetVersionConflictError,
  type IBetRepository,
} from "@games/port/bet.repository";
import {
  ROUND_REPOSITORY,
  type RoundRepositoryError,
  RoundVersionConflictError,
  type IRoundRepository,
} from "@games/port/round.repository";

@Injectable()
export class GameCommandService {
  private readonly logger = new Logger(GameCommandService.name);

  constructor(
    @Inject(ROUND_REPOSITORY)
    private readonly roundRepository: IRoundRepository,
    @Inject(BET_REPOSITORY)
    private readonly betRepository: IBetRepository,
    @Inject(ROUND_TIMING_STRATEGY)
    private readonly roundTimingStrategy: RoundTimingStrategy,
    private readonly gameOutboxService: GameOutboxService,
    private readonly gameQueryService: GameQueryService,
    private readonly gameRealtimePublisher: GameRealtimePublisher,
    private readonly em: EntityManager,
  ) {}

  async placeBet(params: {
    playerId: string;
    playerUsername: string;
    amount: string;
  }): Promise<GameBetView> {
    const placedAt = new Date();
    const playerId = params.playerId.trim();
    const playerUsername = params.playerUsername.trim();

    if (!playerId) {
      throw new InternalServerErrorException("Authenticated player id is missing");
    }

    if (!playerUsername) {
      throw new InternalServerErrorException(
        "Authenticated player username is missing",
      );
    }

    const amountInCents = parseAmountInCents(params.amount);
    const amountResult = BetAmount.create({
      amountInCents,
      currency: "BRL",
    });

    if (!amountResult.success) {
      throw new BadRequestException(amountResult.error.message);
    }

    const round = await this.getActiveRound(placedAt);
    const existingBetResult = await this.betRepository.findByPlayerIdAndRoundId(
      playerId,
      round.id,
    );

    if (!existingBetResult.success) {
      throw new InternalServerErrorException(
        getRepositoryErrorMessage(existingBetResult.error),
      );
    }

    if (existingBetResult.data) {
      throw new ConflictException(
        "The player already has a bet for the current round",
      );
    }

    const betResult = Bet.new({
      id: crypto.randomUUID(),
      roundId: round.id,
      playerId,
      playerUsername,
      amount: amountResult.data!,
      createdAt: placedAt,
    });

    if (!betResult.success) {
      throw new BadRequestException(betResult.error.message);
    }

    const bet = betResult.data!;
    const betEvents = bet.pullDomainEvents();
    const persistedBetResult = await this.betRepository.persist(bet);

    if (!persistedBetResult.success) {
      throw new InternalServerErrorException(
        getRepositoryErrorMessage(persistedBetResult.error),
      );
    }

    await this.gameOutboxService.insertBetEvents({
      events: betEvents,
      persistedAt: placedAt,
    });
    await this.gameOutboxService.insertBetDebitRequested({
      persistedAt: placedAt,
      data: {
        playerId: bet.playerId,
        roundId: bet.roundId,
        betId: bet.id,
        amountInCents: bet.amountInCents.toString(),
        currency: bet.currency,
        idempotencyKey: createBetDebitOperationId(bet.id),
      },
      correlationId: bet.id,
      causationId: bet.id,
    });

    await this.flushOrReset({
      duplicateBetMessage: "The player already has a bet for the current round",
    });

    return this.gameQueryService.mapBet(persistedBetResult.data!);
  }

  async cashOut(params: {
    playerId: string;
  }): Promise<GameCashOutResponseView> {
    const cashedOutAt = new Date();
    const playerId = params.playerId.trim();

    if (!playerId) {
      throw new InternalServerErrorException("Authenticated player id is missing");
    }

    const round = await this.getCurrentRoundOrThrow();
    const bet = await this.getRoundBetOrThrow(playerId, round.id);

    if (bet.isCashedOut || bet.isSettled) {
      if (
        bet.cashoutMultiplier !== null &&
        bet.payoutAmountInCents !== null
      ) {
        return {
          multiplier: bet.cashoutMultiplier,
          payoutAmountInCents: bet.payoutAmountInCents,
        };
      }

      throw new ConflictException("Cashout has already been processed");
    }

    if (
      round.status !== RoundStatus.IN_PROGRESS ||
      round.startedAt === null ||
      round.scheduledCrashAt === null
    ) {
      throw new ConflictException("The round is not accepting cashouts");
    }

    if (cashedOutAt.getTime() >= round.scheduledCrashAt.getTime()) {
      throw new ConflictException("Cashout is no longer available");
    }

    if (!bet.isAccepted) {
      throw new ConflictException("The current bet cannot be cashed out");
    }

    const multiplier = this.roundTimingStrategy.multiplierAt({
      crashPoint: round.crashPoint,
      startedAt: round.startedAt,
      scheduledCrashAt: round.scheduledCrashAt,
      at: cashedOutAt,
    });
    const cashOutResult = bet.cashOut({
      multiplier,
      cashedOutAt,
    });

    if (!cashOutResult.success) {
      throw new ConflictException(cashOutResult.error.message);
    }

    const betEvents = bet.pullDomainEvents();
    const updatedBetResult = await this.betRepository.update(bet);

    if (!updatedBetResult.success) {
      throw this.mapBetRepositoryError(updatedBetResult.error);
    }

    const updatedBet = updatedBetResult.data!;

    await this.gameOutboxService.insertBetEvents({
      events: betEvents,
      persistedAt: cashedOutAt,
    });
    await this.gameOutboxService.insertCashoutCreditRequested({
      persistedAt: cashedOutAt,
      data: {
        playerId: updatedBet.playerId,
        roundId: updatedBet.roundId,
        betId: updatedBet.id,
        payoutAmountInCents: updatedBet.payoutAmountInCents!.toString(),
        currency: updatedBet.currency,
        idempotencyKey: createCashoutCreditOperationId(updatedBet.id),
      },
      correlationId: updatedBet.id,
      causationId: updatedBet.id,
    });

    await this.flushOrReset();
    await this.gameRealtimePublisher.publishBetUpdated(updatedBet.id);
    await this.gameRealtimePublisher.publishSnapshot();

    return {
      multiplier: updatedBet.cashoutMultiplier!,
      payoutAmountInCents: updatedBet.payoutAmountInCents!,
    };
  }

  async handleBetDebitSucceeded(
    envelope: BrokerEnvelope<BetDebitSucceededData>,
  ): Promise<void> {
    const bet = await this.getBetById(envelope.data.betId);

    if (!bet || !bet.isPending) {
      return;
    }

    const round = await this.getRoundById(bet.roundId);

    if (!round) {
      return;
    }

    const occurredAt = new Date(envelope.occurredAt);
    const activeRound = await this.openBettingIfFirstDebitSucceeded({
      round,
      occurredAt,
    });

    if (
      activeRound.startsAt !== null &&
      occurredAt.getTime() < activeRound.startsAt.getTime()
    ) {
      const acceptResult = bet.accept(occurredAt);

      if (!acceptResult.success) {
        throw new ConflictException(acceptResult.error.message);
      }

      await this.persistBetMutation({
        bet,
        occurredAt,
        publishSnapshot: true,
        publishBetUpdated: true,
      });
      return;
    }

    const rejectResult = bet.reject(
      "Debit confirmation arrived after the round start time",
      occurredAt,
    );

    if (!rejectResult.success) {
      throw new ConflictException(rejectResult.error.message);
    }

    await this.persistBetMutation({
      bet,
      occurredAt,
      extraOutboxMessages: async () => {
        await this.gameOutboxService.insertBetRefundRequested({
          persistedAt: occurredAt,
          data: {
            playerId: bet.playerId,
            roundId: bet.roundId,
            betId: bet.id,
            amountInCents: envelope.data.amountInCents,
            currency: envelope.data.currency,
            idempotencyKey: createBetRefundOperationId(bet.id),
          },
          correlationId: this.resolveCorrelationId(envelope.metadata, bet.id),
          causationId: envelope.eventType,
        });
      },
    });
  }

  async handleBetDebitFailed(
    envelope: BrokerEnvelope<BetDebitFailedData>,
  ): Promise<void> {
    const bet = await this.getBetById(envelope.data.betId);

    if (!bet || !bet.isPending) {
      return;
    }

    const rejectedAt = new Date(envelope.occurredAt);
    const rejectResult = bet.reject(
      normalizeFailureReason(envelope.data.reason, "Wallet debit failed"),
      rejectedAt,
    );

    if (!rejectResult.success) {
      throw new ConflictException(rejectResult.error.message);
    }

    await this.persistBetMutation({
      bet,
      occurredAt: rejectedAt,
    });
  }

  async handleBetRefundSucceeded(
    _envelope: BrokerEnvelope<BetRefundSucceededData>,
  ): Promise<void> {
    return;
  }

  async handleBetRefundFailed(
    envelope: BrokerEnvelope<BetRefundFailedData>,
  ): Promise<void> {
    const round = await this.getRoundById(envelope.data.roundId);

    if (!round || round.isError || round.isSettled) {
      return;
    }

    const failedAt = new Date(envelope.occurredAt);
    const failResult = round.fail(
      normalizeFailureReason(
        envelope.data.reason,
        "Bet refund failed and requires manual correction",
      ),
      failedAt,
    );

    if (!failResult.success) {
      this.logger.warn(
        `Ignoring refund failure for round ${round.id}: ${failResult.error.message}`,
      );
      return;
    }

    await this.persistRoundMutation({
      round,
      occurredAt: failedAt,
      publishSnapshot: true,
    });
  }

  async handleCashoutCreditSucceeded(
    envelope: BrokerEnvelope<CashoutCreditSucceededData>,
  ): Promise<void> {
    const bet = await this.getBetById(envelope.data.betId);

    if (!bet || bet.isSettled) {
      return;
    }

    if (!bet.isCashedOut) {
      return;
    }

    const settledAt = new Date(envelope.occurredAt);
    const settleResult = bet.settle(settledAt);

    if (!settleResult.success) {
      throw new ConflictException(settleResult.error.message);
    }

    await this.persistBetMutation({
      bet,
      occurredAt: settledAt,
      publishBetUpdated: true,
    });
  }

  async handleCashoutCreditFailed(
    envelope: BrokerEnvelope<CashoutCreditFailedData>,
  ): Promise<void> {
    const round = await this.getRoundById(envelope.data.roundId);

    if (!round || round.isError || round.isSettled) {
      return;
    }

    const failedAt = new Date(envelope.occurredAt);
    const failResult = round.fail(
      normalizeFailureReason(
        envelope.data.reason,
        "Cashout payout failed and requires manual correction",
      ),
      failedAt,
    );

    if (!failResult.success) {
      throw new ConflictException(failResult.error.message);
    }

    await this.persistRoundMutation({
      round,
      occurredAt: failedAt,
      publishSnapshot: true,
    });
  }

  private async persistBetMutation(params: {
    bet: Bet;
    occurredAt: Date;
    publishSnapshot?: boolean;
    publishBetUpdated?: boolean;
    extraOutboxMessages?: () => Promise<void>;
  }): Promise<void> {
    const betEvents = params.bet.pullDomainEvents();
    const updatedBetResult = await this.betRepository.update(params.bet);

    if (!updatedBetResult.success) {
      throw this.mapBetRepositoryError(updatedBetResult.error);
    }

    await this.gameOutboxService.insertBetEvents({
      events: betEvents,
      persistedAt: params.occurredAt,
    });

    if (params.extraOutboxMessages) {
      await params.extraOutboxMessages();
    }

    await this.flushOrReset();

    if (params.publishBetUpdated) {
      await this.gameRealtimePublisher.publishBetUpdated(updatedBetResult.data!.id);
    }

    if (params.publishSnapshot) {
      await this.gameRealtimePublisher.publishSnapshot();
    }
  }

  private async persistRoundMutation(params: {
    round: Round;
    occurredAt: Date;
    publishSnapshot?: boolean;
    publishHistory?: boolean;
  }): Promise<Round> {
    const roundEvents = params.round.pullDomainEvents();
    const updatedRoundResult = await this.roundRepository.update(params.round);

    if (!updatedRoundResult.success) {
      throw this.mapRoundRepositoryError(updatedRoundResult.error);
    }

    await this.gameOutboxService.insertRoundEvents({
      events: roundEvents,
      persistedAt: params.occurredAt,
    });
    await this.flushOrReset();

    if (params.publishSnapshot) {
      await this.gameRealtimePublisher.publishSnapshot();
    }

    if (params.publishHistory) {
      await this.gameRealtimePublisher.publishHistoryUpdated();
    }

    return updatedRoundResult.data!;
  }

  private async openBettingIfFirstDebitSucceeded(params: {
    round: Round;
    occurredAt: Date;
  }): Promise<Round> {
    if (!params.round.isWaitingForFirstBet) {
      return params.round;
    }

    const openResult = params.round.openBettingFromFirstAcceptedBet({
      openedAt: params.occurredAt,
      bettingWindowInSeconds: BETTING_WINDOW_IN_SECONDS,
      startDelayInMs: ROUND_START_DELAY_IN_MS,
      roundDurationInMs: this.roundTimingStrategy.calculateDurationInMs(
        params.round.crashPoint,
      ),
      crashRevealInMs: ROUND_CRASH_REVEAL_IN_MS,
    });

    if (!openResult.success) {
      throw new ConflictException(openResult.error.message);
    }

    return this.persistRoundMutation({
      round: params.round,
      occurredAt: params.occurredAt,
      publishSnapshot: true,
    });
  }

  private async getActiveRound(at: Date): Promise<Round> {
    const round = await this.getCurrentRoundOrThrow();

    if (!round.canAcceptBets(at)) {
      throw new ConflictException("The betting window is closed");
    }

    if (round.isError) {
      throw new ConflictException("The game is paused for manual correction");
    }

    return round;
  }

  private async getCurrentRoundOrThrow(): Promise<Round> {
    const roundResult = await this.roundRepository.findCurrentRound();

    if (!roundResult.success) {
      throw new InternalServerErrorException(
        getRepositoryErrorMessage(roundResult.error),
      );
    }

    if (!roundResult.data) {
      throw new ConflictException("There is no active round available");
    }

    return roundResult.data;
  }

  private async getRoundById(id: string): Promise<Round | undefined> {
    const roundResult = await this.roundRepository.findById(id);

    if (!roundResult.success) {
      throw new InternalServerErrorException(
        getRepositoryErrorMessage(roundResult.error),
      );
    }

    return roundResult.data;
  }

  private async getRoundBetOrThrow(
    playerId: string,
    roundId: string,
  ): Promise<Bet> {
    const betResult = await this.betRepository.findByPlayerIdAndRoundId(
      playerId,
      roundId,
    );

    if (!betResult.success) {
      throw new InternalServerErrorException(
        getRepositoryErrorMessage(betResult.error),
      );
    }

    if (!betResult.data) {
      throw new NotFoundException("No current-round bet was found for the player");
    }

    return betResult.data;
  }

  private async getBetById(id: string): Promise<Bet | undefined> {
    const betResult = await this.betRepository.findById(id);

    if (!betResult.success) {
      throw new InternalServerErrorException(
        getRepositoryErrorMessage(betResult.error),
      );
    }

    return betResult.data;
  }

  private async flushOrReset(params?: {
    duplicateBetMessage?: string;
  }): Promise<void> {
    try {
      await this.em.flush();
    } catch (error) {
      this.em.clear();

      if (
        params?.duplicateBetMessage &&
        error instanceof UniqueConstraintViolationException &&
        typeof error.message === "string" &&
        error.message.includes("bets_round_id_player_id_unique")
      ) {
        throw new ConflictException(params.duplicateBetMessage);
      }

      throw error;
    }
  }

  private mapBetRepositoryError(error: BetRepositoryError): Error {
    if (error instanceof BetVersionConflictError) {
      return new ConflictException("The bet changed concurrently");
    }

    return new InternalServerErrorException(getRepositoryErrorMessage(error));
  }

  private mapRoundRepositoryError(error: RoundRepositoryError): Error {
    if (error instanceof RoundVersionConflictError) {
      return new ConflictException("The round changed concurrently");
    }

    return new InternalServerErrorException(getRepositoryErrorMessage(error));
  }

  private resolveCorrelationId(
    metadata: BrokerEnvelopeMetadata,
    fallback: string,
  ): string {
    const value = metadata.correlationId ?? fallback;
    return typeof value === "string" && value.trim() ? value : fallback;
  }
}

function normalizeFailureReason(reason: string, fallback: string): string {
  return typeof reason === "string" && reason.trim() ? reason.trim() : fallback;
}

function getRepositoryErrorMessage(
  error: Error | { name: string },
): string {
  if (error instanceof Error) {
    return error.message;
  }

  return error.name;
}

function createBetDebitOperationId(betId: string): string {
  return `bet-debit:${betId}`;
}

function createBetRefundOperationId(betId: string): string {
  return `bet-refund:${betId}`;
}

function createCashoutCreditOperationId(betId: string): string {
  return `cashout-credit:${betId}`;
}
