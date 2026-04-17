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
  BET_DEBIT_REQUESTED,
  BET_REFUND_REQUESTED,
  CASHOUT_CREDIT_REQUESTED,
  type BetDebitRequestedData,
  type BetRefundRequestedData,
  type BrokerEnvelope,
  type CashoutCreditRequestedData,
} from "@crash/messaging";
import { WalletMoneyFlowService } from "@wallets/application/wallet-money-flow.service";

const GAMES_DOMAIN_EXCHANGE = "games.domain";
const GAMES_MONEY_FLOW_QUEUE = "wallets.money-flow";

@Injectable()
export class GamesMoneyFlowConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GamesMoneyFlowConsumer.name);
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;

  constructor(private readonly walletMoneyFlowService: WalletMoneyFlowService) {}

  async onModuleInit(): Promise<void> {
    const rabbitMqUrl = process.env.RABBITMQ_URL;

    if (!rabbitMqUrl) {
      this.logger.warn(
        "RABBITMQ_URL is missing; games money-flow consumer was not started",
      );
      return;
    }

    this.connection = await connect(rabbitMqUrl);
    this.channel = await this.connection.createChannel();
    await this.channel.assertExchange(GAMES_DOMAIN_EXCHANGE, "topic", {
      durable: true,
    });

    const { queue } = await this.channel.assertQueue(GAMES_MONEY_FLOW_QUEUE, {
      durable: true,
    });

    for (const routingKey of [
      BET_DEBIT_REQUESTED,
      BET_REFUND_REQUESTED,
      CASHOUT_CREDIT_REQUESTED,
    ]) {
      await this.channel.bindQueue(queue, GAMES_DOMAIN_EXCHANGE, routingKey);
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
      const envelope = JSON.parse(message.content.toString()) as BrokerEnvelope;

      switch (envelope.eventType) {
        case BET_DEBIT_REQUESTED:
          await this.walletMoneyFlowService.handleBetDebitRequested(
            envelope as BrokerEnvelope<BetDebitRequestedData>,
          );
          break;
        case BET_REFUND_REQUESTED:
          await this.walletMoneyFlowService.handleBetRefundRequested(
            envelope as BrokerEnvelope<BetRefundRequestedData>,
          );
          break;
        case CASHOUT_CREDIT_REQUESTED:
          await this.walletMoneyFlowService.handleCashoutCreditRequested(
            envelope as BrokerEnvelope<CashoutCreditRequestedData>,
          );
          break;
        default:
          this.logger.warn(`Ignoring unsupported money-flow event ${envelope.eventType}`);
      }

      this.channel.ack(message);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(`Money-flow handling failed: ${reason}`);
      this.channel.nack(message, false, true);
    }
  }
}
