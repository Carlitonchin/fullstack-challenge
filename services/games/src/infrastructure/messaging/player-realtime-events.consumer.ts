import { MikroORM, RequestContext } from "@mikro-orm/core";
import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import {
  BET_REJECTED,
  WALLET_CREDITED,
  WALLET_DEBITED,
  type BetRejectedData,
  type BrokerEnvelope,
  ResilientAmqpConsumer,
  type WalletCreditedData,
  type WalletDebitedData,
} from "@crash/messaging";
import { GameQueryService } from "@games/application/game-query.service";
import { PlayerRealtimeNotificationQueue } from "@games/application/player-realtime-notification.queue";

const GAMES_DOMAIN_EXCHANGE = "games.domain";
const WALLETS_DOMAIN_EXCHANGE = "wallets.domain";
const PLAYER_REALTIME_WALLET_EVENTS_QUEUE =
  "games.player-realtime.wallet-events";
const PLAYER_REALTIME_BET_EVENTS_QUEUE = "games.player-realtime.bet-events";
const PLAYER_REALTIME_PREFETCH = 16;
const SUPPORTED_PLAYER_REALTIME_WALLET_EVENTS = [
  WALLET_CREDITED,
  WALLET_DEBITED,
] as const;
const SUPPORTED_PLAYER_REALTIME_BET_EVENTS = [BET_REJECTED] as const;

@Injectable()
export class PlayerRealtimeEventsConsumer
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PlayerRealtimeEventsConsumer.name);
  private walletEventsConsumer: ResilientAmqpConsumer | null = null;
  private betEventsConsumer: ResilientAmqpConsumer | null = null;

  constructor(
    private readonly orm: MikroORM,
    private readonly gameQueryService: GameQueryService,
    private readonly notificationQueue: PlayerRealtimeNotificationQueue,
  ) {}

  async onModuleInit(): Promise<void> {
    const rabbitMqUrl = process.env.RABBITMQ_URL;

    if (!rabbitMqUrl) {
      this.logger.warn(
        "RABBITMQ_URL is missing; player realtime consumer was not started",
      );
      return;
    }

    this.walletEventsConsumer = new ResilientAmqpConsumer({
      name: PLAYER_REALTIME_WALLET_EVENTS_QUEUE,
      rabbitMqUrl,
      queueName: PLAYER_REALTIME_WALLET_EVENTS_QUEUE,
      prefetch: PLAYER_REALTIME_PREFETCH,
      supportedEventTypes: SUPPORTED_PLAYER_REALTIME_WALLET_EVENTS,
      logger: this.logger,
      bindings: [
        {
          exchangeName: WALLETS_DOMAIN_EXCHANGE,
          routingKeys: [...SUPPORTED_PLAYER_REALTIME_WALLET_EVENTS],
        },
      ],
      handleMessage: (envelope) => this.handleWalletEnvelope(envelope),
    });

    this.betEventsConsumer = new ResilientAmqpConsumer({
      name: PLAYER_REALTIME_BET_EVENTS_QUEUE,
      rabbitMqUrl,
      queueName: PLAYER_REALTIME_BET_EVENTS_QUEUE,
      prefetch: PLAYER_REALTIME_PREFETCH,
      supportedEventTypes: SUPPORTED_PLAYER_REALTIME_BET_EVENTS,
      logger: this.logger,
      bindings: [
        {
          exchangeName: GAMES_DOMAIN_EXCHANGE,
          routingKeys: [...SUPPORTED_PLAYER_REALTIME_BET_EVENTS],
        },
      ],
      handleMessage: (envelope) => this.handleBetEnvelope(envelope),
    });

    await Promise.all([
      this.walletEventsConsumer.start(),
      this.betEventsConsumer.start(),
    ]);
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([
      this.walletEventsConsumer?.stop(),
      this.betEventsConsumer?.stop(),
    ]);
  }

  private async handleWalletEnvelope(envelope: BrokerEnvelope): Promise<void> {
    switch (envelope.eventType) {
      case WALLET_CREDITED:
        await this.enqueueWalletBalanceUpdated(
          envelope as BrokerEnvelope<WalletCreditedData>,
          "credit",
        );
        break;
      case WALLET_DEBITED:
        await this.enqueueWalletBalanceUpdated(
          envelope as BrokerEnvelope<WalletDebitedData>,
          "debit",
        );
        break;
    }
  }

  private async handleBetEnvelope(envelope: BrokerEnvelope): Promise<void> {
    await RequestContext.create(this.orm.em, async () => {
      switch (envelope.eventType) {
        case BET_REJECTED:
          await this.enqueueRejectedBetUpdated(
            envelope as BrokerEnvelope<BetRejectedData>,
          );
          break;
      }
    });
  }

  private async enqueueWalletBalanceUpdated(
    envelope: BrokerEnvelope<WalletCreditedData | WalletDebitedData>,
    direction: "credit" | "debit",
  ): Promise<void> {
    const playerId = envelope.data.playerId.trim();

    if (!playerId) {
      this.logger.warn(
        `Skipping wallet realtime event ${envelope.eventType} without player id`,
      );
      return;
    }

    await this.notificationQueue.enqueue({
      type: "wallet.balance-updated",
      playerId,
      payload: {
        walletId: envelope.data.walletId,
        playerId,
        currency: envelope.data.currency,
        balanceInCents: envelope.data.balanceAfterInCents,
        amountInCents: envelope.data.amountInCents,
        direction,
        operationId: envelope.data.operationId ?? null,
        occurredAt: envelope.occurredAt,
      },
    });
  }

  private async enqueueRejectedBetUpdated(
    envelope: BrokerEnvelope<BetRejectedData>,
  ): Promise<void> {
    const bet = await this.gameQueryService.getBetById(envelope.data.betId);

    if (!bet) {
      this.logger.debug(
        `Skipping rejected bet realtime event for missing bet ${envelope.data.betId}`,
      );
      return;
    }

    await this.notificationQueue.enqueue({
      type: "player.bet.updated",
      playerId: bet.playerId,
      payload: bet,
    });
  }
}
