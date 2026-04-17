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
  BET_DEBIT_FAILED,
  BET_DEBIT_SUCCEEDED,
  BET_REFUND_FAILED,
  BET_REFUND_SUCCEEDED,
  CASHOUT_CREDIT_FAILED,
  CASHOUT_CREDIT_SUCCEEDED,
  type BetDebitFailedData,
  type BetDebitSucceededData,
  type BetRefundFailedData,
  type BetRefundSucceededData,
  type BrokerEnvelope,
  type CashoutCreditFailedData,
  type CashoutCreditSucceededData,
} from "@crash/messaging";
import { GameCommandService } from "@games/application/game-command.service";

const WALLETS_DOMAIN_EXCHANGE = "wallets.domain";
const WALLETS_EVENTS_QUEUE = "games.wallet-events";

@Injectable()
export class WalletEventsConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WalletEventsConsumer.name);
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;

  constructor(
    private readonly orm: MikroORM,
    private readonly gameCommandService: GameCommandService,
  ) {}

  async onModuleInit(): Promise<void> {
    const rabbitMqUrl = process.env.RABBITMQ_URL;

    if (!rabbitMqUrl) {
      this.logger.warn(
        "RABBITMQ_URL is missing; wallet-events consumer was not started",
      );
      return;
    }

    this.connection = await connect(rabbitMqUrl);
    this.channel = await this.connection.createChannel();
    await this.channel.assertExchange(WALLETS_DOMAIN_EXCHANGE, "topic", {
      durable: true,
    });

    const { queue } = await this.channel.assertQueue(WALLETS_EVENTS_QUEUE, {
      durable: true,
    });

    for (const routingKey of [
      BET_DEBIT_SUCCEEDED,
      BET_DEBIT_FAILED,
      BET_REFUND_SUCCEEDED,
      BET_REFUND_FAILED,
      CASHOUT_CREDIT_SUCCEEDED,
      CASHOUT_CREDIT_FAILED,
    ]) {
      await this.channel.bindQueue(queue, WALLETS_DOMAIN_EXCHANGE, routingKey);
    }

    await this.channel.consume(queue, (message) => {
      void this.handleMessage(message);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
  }

  private async handleMessage(message: ConsumeMessage | null): Promise<void> {
    if (!message || !this.channel) {
      return;
    }

    try {
      await RequestContext.create(this.orm.em, async () => {
        const envelope = JSON.parse(message.content.toString()) as BrokerEnvelope;

        switch (envelope.eventType) {
          case BET_DEBIT_SUCCEEDED:
            await this.gameCommandService.handleBetDebitSucceeded(
              envelope as BrokerEnvelope<BetDebitSucceededData>,
            );
            break;
          case BET_DEBIT_FAILED:
            await this.gameCommandService.handleBetDebitFailed(
              envelope as BrokerEnvelope<BetDebitFailedData>,
            );
            break;
          case BET_REFUND_SUCCEEDED:
            await this.gameCommandService.handleBetRefundSucceeded(
              envelope as BrokerEnvelope<BetRefundSucceededData>,
            );
            break;
          case BET_REFUND_FAILED:
            await this.gameCommandService.handleBetRefundFailed(
              envelope as BrokerEnvelope<BetRefundFailedData>,
            );
            break;
          case CASHOUT_CREDIT_SUCCEEDED:
            await this.gameCommandService.handleCashoutCreditSucceeded(
              envelope as BrokerEnvelope<CashoutCreditSucceededData>,
            );
            break;
          case CASHOUT_CREDIT_FAILED:
            await this.gameCommandService.handleCashoutCreditFailed(
              envelope as BrokerEnvelope<CashoutCreditFailedData>,
            );
            break;
          default:
            this.logger.warn(
              `Ignoring unsupported wallet event ${envelope.eventType}`,
            );
        }
      });

      this.channel.ack(message);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(`Wallet event handling failed: ${reason}`);
      this.channel.nack(message, false, true);
    }
  }
}
