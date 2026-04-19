import { MikroORM, RequestContext } from "@mikro-orm/core";
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
  ResilientAmqpConsumer,
} from "@crash/messaging";
import { WalletMoneyFlowService } from "@wallets/application/wallet-money-flow.service";

const GAMES_DOMAIN_EXCHANGE = "games.domain";
const GAMES_MONEY_FLOW_QUEUE = "wallets.money-flow";
const MONEY_FLOW_PREFETCH = 4;
const SUPPORTED_MONEY_FLOW_EVENTS = [
  BET_DEBIT_REQUESTED,
  BET_REFUND_REQUESTED,
  CASHOUT_CREDIT_REQUESTED,
] as const;

@Injectable()
export class GamesMoneyFlowConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GamesMoneyFlowConsumer.name);
  private consumer: ResilientAmqpConsumer | null = null;

  constructor(
    private readonly orm: MikroORM,
    private readonly walletMoneyFlowService: WalletMoneyFlowService,
  ) {}

  async onModuleInit(): Promise<void> {
    const rabbitMqUrl = process.env.RABBITMQ_URL;

    if (!rabbitMqUrl) {
      this.logger.warn(
        "RABBITMQ_URL is missing; games money-flow consumer was not started",
      );
      return;
    }

    this.consumer = new ResilientAmqpConsumer({
      name: GAMES_MONEY_FLOW_QUEUE,
      rabbitMqUrl,
      queueName: GAMES_MONEY_FLOW_QUEUE,
      prefetch: MONEY_FLOW_PREFETCH,
      supportedEventTypes: SUPPORTED_MONEY_FLOW_EVENTS,
      logger: this.logger,
      bindings: [
        {
          exchangeName: GAMES_DOMAIN_EXCHANGE,
          routingKeys: [...SUPPORTED_MONEY_FLOW_EVENTS],
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
      }
    });
  }
}
