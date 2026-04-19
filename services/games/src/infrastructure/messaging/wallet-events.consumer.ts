import { MikroORM, RequestContext } from "@mikro-orm/core";
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
  ResilientAmqpConsumer,
} from "@crash/messaging";
import { GameCommandService } from "@games/application/game-command.service";

const WALLETS_DOMAIN_EXCHANGE = "wallets.domain";
const WALLETS_EVENTS_QUEUE = "games.wallet-events";
const WALLET_EVENTS_PREFETCH = 8;
const SUPPORTED_WALLET_EVENTS = [
  BET_DEBIT_SUCCEEDED,
  BET_DEBIT_FAILED,
  BET_REFUND_SUCCEEDED,
  BET_REFUND_FAILED,
  CASHOUT_CREDIT_SUCCEEDED,
  CASHOUT_CREDIT_FAILED,
] as const;

@Injectable()
export class WalletEventsConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WalletEventsConsumer.name);
  private consumer: ResilientAmqpConsumer | null = null;

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

    this.consumer = new ResilientAmqpConsumer({
      name: WALLETS_EVENTS_QUEUE,
      rabbitMqUrl,
      queueName: WALLETS_EVENTS_QUEUE,
      prefetch: WALLET_EVENTS_PREFETCH,
      supportedEventTypes: SUPPORTED_WALLET_EVENTS,
      logger: this.logger,
      bindings: [
        {
          exchangeName: WALLETS_DOMAIN_EXCHANGE,
          routingKeys: [...SUPPORTED_WALLET_EVENTS],
        },
      ],
      handleMessage: (envelope) => this.handleEnvelope(envelope),
    });

    await this.consumer.start();
  }

  async onModuleDestroy(): Promise<void> {
    await this.consumer?.stop();
  }

  private async handleEnvelope(envelope: BrokerEnvelope): Promise<void> {
    await RequestContext.create(this.orm.em, async () => {
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
      }
    });
  }
}
