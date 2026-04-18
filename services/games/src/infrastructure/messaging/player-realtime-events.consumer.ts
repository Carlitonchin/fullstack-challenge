import { MikroORM, RequestContext } from "@mikro-orm/core";
import {
  type Channel,
  type ChannelModel,
  type ConsumeMessage,
  connect,
} from "amqplib";
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

@Injectable()
export class PlayerRealtimeEventsConsumer
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PlayerRealtimeEventsConsumer.name);
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;

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

    this.connection = await connect(rabbitMqUrl);
    this.channel = await this.connection.createChannel();

    await this.bindWalletEventsQueue();
    await this.bindBetEventsQueue();
  }

  async onModuleDestroy(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
  }

  private async bindWalletEventsQueue(): Promise<void> {
    if (!this.channel) {
      return;
    }

    await this.channel.assertExchange(WALLETS_DOMAIN_EXCHANGE, "topic", {
      durable: true,
    });

    const { queue } = await this.channel.assertQueue(
      PLAYER_REALTIME_WALLET_EVENTS_QUEUE,
      { durable: true },
    );

    for (const routingKey of [WALLET_CREDITED, WALLET_DEBITED]) {
      await this.channel.bindQueue(queue, WALLETS_DOMAIN_EXCHANGE, routingKey);
    }

    await this.channel.consume(queue, (message) => {
      void this.handleWalletMessage(message);
    });
  }

  private async bindBetEventsQueue(): Promise<void> {
    if (!this.channel) {
      return;
    }

    await this.channel.assertExchange(GAMES_DOMAIN_EXCHANGE, "topic", {
      durable: true,
    });

    const { queue } = await this.channel.assertQueue(
      PLAYER_REALTIME_BET_EVENTS_QUEUE,
      { durable: true },
    );

    await this.channel.bindQueue(queue, GAMES_DOMAIN_EXCHANGE, BET_REJECTED);

    await this.channel.consume(queue, (message) => {
      void this.handleBetMessage(message);
    });
  }

  private async handleWalletMessage(
    message: ConsumeMessage | null,
  ): Promise<void> {
    if (!message || !this.channel) {
      return;
    }

    try {
      const envelope = JSON.parse(message.content.toString()) as BrokerEnvelope;

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
        default:
          this.logger.warn(
            `Ignoring unsupported player realtime wallet event ${envelope.eventType}`,
          );
      }

      this.channel.ack(message);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(`Player realtime wallet event failed: ${reason}`);
      this.channel.nack(message, false, true);
    }
  }

  private async handleBetMessage(message: ConsumeMessage | null): Promise<void> {
    if (!message || !this.channel) {
      return;
    }

    try {
      await RequestContext.create(this.orm.em, async () => {
        const envelope = JSON.parse(message.content.toString()) as BrokerEnvelope;

        switch (envelope.eventType) {
          case BET_REJECTED:
            await this.enqueueRejectedBetUpdated(
              envelope as BrokerEnvelope<BetRejectedData>,
            );
            break;
          default:
            this.logger.warn(
              `Ignoring unsupported player realtime bet event ${envelope.eventType}`,
            );
        }
      });

      this.channel.ack(message);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(`Player realtime bet event failed: ${reason}`);
      this.channel.nack(message, false, true);
    }
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
