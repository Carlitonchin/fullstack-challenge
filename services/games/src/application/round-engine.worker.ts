import { EntityManager } from "@mikro-orm/postgresql";
import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import { PostgresOutboxRepository } from "@crash/messaging";
import { GameOutboxService } from "@games/application/game-outbox.service";
import { GameRealtimePublisher } from "@games/application/game-realtime.publisher";
import { RoundFactoryService } from "@games/application/round-factory.service";
import { Round } from "@games/domain/round/round";
import { BetRepository } from "@games/infrastructure/repository/bet.repository";
import { RoundRepository } from "@games/infrastructure/repository/round.repository";
import { GameOutboxMessageSchema } from "@games/infrastructure/schema/game-outbox-message";

const ENGINE_ADVISORY_LOCK_KEY = 40_417_001;
const ENGINE_RETRY_DELAY_IN_MS = 500;
const ENGINE_FAILURE_DELAY_IN_MS = 1_000;
const MAX_RECONCILE_STEPS = 32;

type ReconcileResult = {
  nextAt: Date | null;
  publishSnapshot: boolean;
  publishHistory: boolean;
};

type TransactionalEntityManager = EntityManager & {
  getTransactionContext(): unknown;
};

@Injectable()
export class RoundEngineWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RoundEngineWorker.name);
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  constructor(
    private readonly em: EntityManager,
    private readonly roundFactoryService: RoundFactoryService,
    private readonly gameOutboxService: GameOutboxService,
    private readonly gameRealtimePublisher: GameRealtimePublisher,
  ) {}

  onModuleInit(): void {
    void this.run();
  }

  onModuleDestroy(): void {
    this.stopped = true;

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private async run(): Promise<void> {
    if (this.stopped) {
      return;
    }

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    try {
      const result = await this.reconcile(new Date());

      if (result.publishSnapshot) {
        await this.gameRealtimePublisher.publishSnapshot();
      }

      if (result.publishHistory) {
        await this.gameRealtimePublisher.publishHistoryUpdated();
      }

      this.schedule(result.nextAt);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(`Round engine reconcile failed: ${reason}`);
      this.schedule(new Date(Date.now() + ENGINE_FAILURE_DELAY_IN_MS));
    }
  }

  private schedule(nextAt: Date | null): void {
    if (this.stopped) {
      return;
    }

    if (!nextAt) {
      this.logger.warn("Round engine is halted because the current round is in ERROR");
      return;
    }

    const delay = Math.max(0, nextAt.getTime() - Date.now());
    this.timer = setTimeout(() => {
      void this.run();
    }, delay);
  }

  private async reconcile(now: Date): Promise<ReconcileResult> {
    return this.em.fork().transactional(
      async (txEm) => {
        const lockAcquired = await this.tryAcquireLock(txEm);

        if (!lockAcquired) {
          return {
            nextAt: new Date(now.getTime() + ENGINE_RETRY_DELAY_IN_MS),
            publishSnapshot: false,
            publishHistory: false,
          };
        }

        const roundRepository = new RoundRepository(txEm);
        const betRepository = new BetRepository(txEm);
        const outboxRepository = new PostgresOutboxRepository(txEm, {
          schema: GameOutboxMessageSchema,
          tableName: "game_outbox_messages",
        });

        let publishSnapshot = false;
        let publishHistory = false;
        let currentRoundResult = await roundRepository.findCurrentRound();

        if (!currentRoundResult.success) {
          throw new Error(getRepositoryErrorMessage(currentRoundResult.error));
        }

        let currentRound = currentRoundResult.data;

        for (let iteration = 0; iteration < MAX_RECONCILE_STEPS; iteration += 1) {
          if (!currentRound || currentRound.isSettled) {
            currentRound = await this.roundFactoryService.createRound({
              createdAt: now,
              entityManager: txEm,
            });

            await this.gameOutboxService.insertRoundEvents({
              events: currentRound.pullDomainEvents(),
              persistedAt: currentRound.createdAt,
              outboxRepository,
            });
            publishSnapshot = true;
            continue;
          }

          if (currentRound.isError) {
            await txEm.flush();
            return {
              nextAt: null,
              publishSnapshot,
              publishHistory,
            };
          }

          if (currentRound.shouldCloseBetting(now)) {
            const closedAt = new Date(
              Math.max(now.getTime(), currentRound.bettingClosesAt.getTime()),
            );
            const closeResult = currentRound.closeBetting(closedAt);

            if (!closeResult.success) {
              throw new Error(closeResult.error.message);
            }

            currentRound = await this.persistRoundUpdate({
              roundRepository,
              outboxRepository,
              round: currentRound,
              occurredAt: closedAt,
            });
            publishSnapshot = true;
            continue;
          }

          if (currentRound.shouldStart(now)) {
            const startedAt = new Date(
              Math.max(now.getTime(), currentRound.startsAt.getTime()),
            );
            const startResult = currentRound.start(startedAt);

            if (!startResult.success) {
              throw new Error(startResult.error.message);
            }

            currentRound = await this.persistRoundUpdate({
              roundRepository,
              outboxRepository,
              round: currentRound,
              occurredAt: startedAt,
            });
            publishSnapshot = true;
            continue;
          }

          if (currentRound.shouldCrash(now)) {
            const crashedAt = new Date(
              Math.max(now.getTime(), currentRound.scheduledCrashAt.getTime()),
            );
            const crashResult = currentRound.crash(crashedAt);

            if (!crashResult.success) {
              throw new Error(crashResult.error.message);
            }

            currentRound = await this.persistRoundUpdate({
              roundRepository,
              outboxRepository,
              round: currentRound,
              occurredAt: crashedAt,
            });
            await this.markRoundAcceptedBetsAsLost({
              roundId: currentRound.id,
              lostAt: crashedAt,
              betRepository,
              outboxRepository,
            });
            publishSnapshot = true;
            continue;
          }

          if (currentRound.shouldSettle(now)) {
            const settledAt = new Date(
              Math.max(now.getTime(), currentRound.settlesAt.getTime()),
            );
            await this.resolveRoundBetsForSettlement({
              roundId: currentRound.id,
              crashOccurredAt: currentRound.crashedAt ?? currentRound.scheduledCrashAt,
              settledAt,
              betRepository,
              outboxRepository,
            });

            const settleResult = currentRound.settle(settledAt);

            if (!settleResult.success) {
              throw new Error(settleResult.error.message);
            }

            await this.persistRoundUpdate({
              roundRepository,
              outboxRepository,
              round: currentRound,
              occurredAt: settledAt,
            });
            publishSnapshot = true;
            publishHistory = true;
            currentRound = undefined;
            continue;
          }

          break;
        }

        await txEm.flush();

        return {
          nextAt: this.resolveNextWakeUp(currentRound, now),
          publishSnapshot,
          publishHistory,
        };
      },
      { clear: true },
    );
  }

  private async tryAcquireLock(txEm: EntityManager): Promise<boolean> {
    const transactionalEntityManager = txEm as TransactionalEntityManager;
    const row = await txEm.getConnection().execute<{ acquired?: boolean }>(
      "select pg_try_advisory_xact_lock(?) as acquired",
      [ENGINE_ADVISORY_LOCK_KEY],
      "get",
      transactionalEntityManager.getTransactionContext() as never,
    );

    return Boolean(row?.acquired);
  }

  private async persistRoundUpdate(params: {
    roundRepository: RoundRepository;
    outboxRepository: PostgresOutboxRepository;
    round: Round;
    occurredAt: Date;
  }): Promise<Round> {
    const roundEvents = params.round.pullDomainEvents();
    const updatedRoundResult = await params.roundRepository.update(params.round);

    if (!updatedRoundResult.success) {
      throw new Error(getRepositoryErrorMessage(updatedRoundResult.error));
    }

    await this.gameOutboxService.insertRoundEvents({
      events: roundEvents,
      persistedAt: params.occurredAt,
      outboxRepository: params.outboxRepository,
    });

    return updatedRoundResult.data!;
  }

  private async markRoundAcceptedBetsAsLost(params: {
    roundId: string;
    lostAt: Date;
    betRepository: BetRepository;
    outboxRepository: PostgresOutboxRepository;
  }): Promise<void> {
    const betsResult = await params.betRepository.findByRoundId(params.roundId);

    if (!betsResult.success) {
      throw new Error(getRepositoryErrorMessage(betsResult.error));
    }

    for (const bet of betsResult.data) {
      if (!bet.isAccepted) {
        continue;
      }

      const loseResult = bet.lose(params.lostAt);

      if (!loseResult.success) {
        throw new Error(loseResult.error.message);
      }

      const betEvents = bet.pullDomainEvents();
      const updatedBetResult = await params.betRepository.update(bet);

      if (!updatedBetResult.success) {
        throw new Error(getRepositoryErrorMessage(updatedBetResult.error));
      }

      await this.gameOutboxService.insertBetEvents({
        events: betEvents,
        persistedAt: params.lostAt,
        outboxRepository: params.outboxRepository,
      });
    }
  }

  private async resolveRoundBetsForSettlement(params: {
    roundId: string;
    crashOccurredAt: Date;
    settledAt: Date;
    betRepository: BetRepository;
    outboxRepository: PostgresOutboxRepository;
  }): Promise<void> {
    const betsResult = await params.betRepository.findByRoundId(params.roundId);

    if (!betsResult.success) {
      throw new Error(getRepositoryErrorMessage(betsResult.error));
    }

    for (const bet of betsResult.data) {
      if (bet.isAccepted) {
        const loseResult = bet.lose(params.crashOccurredAt);

        if (!loseResult.success) {
          throw new Error(loseResult.error.message);
        }
      }

      if (!bet.isLost) {
        continue;
      }

      const settleResult = bet.settle(params.settledAt);

      if (!settleResult.success) {
        throw new Error(settleResult.error.message);
      }

      const betEvents = bet.pullDomainEvents();
      const updatedBetResult = await params.betRepository.update(bet);

      if (!updatedBetResult.success) {
        throw new Error(getRepositoryErrorMessage(updatedBetResult.error));
      }

      await this.gameOutboxService.insertBetEvents({
        events: betEvents,
        persistedAt: params.settledAt,
        outboxRepository: params.outboxRepository,
      });
    }
  }

  private resolveNextWakeUp(currentRound: Round | null | undefined, now: Date): Date | null {
    if (!currentRound) {
      return new Date(now.getTime() + ENGINE_RETRY_DELAY_IN_MS);
    }

    if (currentRound.status === "BETTING_OPEN") {
      return currentRound.bettingClosesAt;
    }

    if (currentRound.status === "BETTING_CLOSED") {
      return currentRound.startsAt;
    }

    if (currentRound.status === "IN_PROGRESS") {
      return currentRound.scheduledCrashAt;
    }

    if (currentRound.status === "CRASHED") {
      return currentRound.settlesAt;
    }

    if (currentRound.status === "ERROR") {
      return null;
    }

    return new Date(now.getTime() + ENGINE_RETRY_DELAY_IN_MS);
  }
}

function getRepositoryErrorMessage(error: Error | { name: string }): string {
  if (error instanceof Error) {
    return error.message;
  }

  return error.name;
}
