import { Injectable } from "@nestjs/common";
import {
  BET_DEBIT_FAILED,
  BET_DEBIT_SUCCEEDED,
  BET_REFUND_FAILED,
  BET_REFUND_SUCCEEDED,
  CASHOUT_CREDIT_FAILED,
  CASHOUT_CREDIT_SUCCEEDED,
  buildBrokerEnvelope,
  type BetDebitFailedData,
  type BetDebitSucceededData,
  type BetRefundFailedData,
  type BetRefundSucceededData,
  type CashoutCreditFailedData,
  type CashoutCreditSucceededData,
  type CreateOutboxMessageProps,
} from "@crash/messaging";
import type { WalletDomainEvent } from "@wallets/domain/wallet/wallet.events";

const OUTBOX_EXCHANGE_NAME = "wallets.domain";
const AGGREGATE_TYPE = "wallet";
const PRODUCER_NAME = "wallets";

@Injectable()
export class WalletDomainEventOutboxMapper {
  map(params: {
    event: WalletDomainEvent;
    outboxId: string;
    persistedAt: Date;
  }): CreateOutboxMessageProps {
    const { event, outboxId, persistedAt } = params;

    return {
      id: outboxId,
      aggregateType: AGGREGATE_TYPE,
      aggregateId: event.walletId,
      eventType: event.type,
      exchangeName: OUTBOX_EXCHANGE_NAME,
      routingKey: event.type,
      idempotencyKey: event.idempotencyKey,
      payload: buildBrokerEnvelope({
        eventType: event.type,
        occurredAt: event.occurredAt,
        aggregateType: AGGREGATE_TYPE,
        aggregateId: event.walletId,
        producer: PRODUCER_NAME,
        idempotencyKey: event.idempotencyKey,
        metadata: {
          outboxId,
        },
        data: event.serialize(),
      }),
      createdAt: persistedAt,
      updatedAt: persistedAt,
      availableAt: persistedAt,
    };
  }

  mapBetDebitSucceeded(params: {
    outboxId: string;
    persistedAt: Date;
    data: BetDebitSucceededData;
    correlationId?: string | null;
    causationId?: string | null;
  }): CreateOutboxMessageProps {
    return this.createMoneyFlowMessage({
      outboxId: params.outboxId,
      persistedAt: params.persistedAt,
      eventType: BET_DEBIT_SUCCEEDED,
      aggregateId: params.data.betId,
      data: params.data,
      correlationId: params.correlationId,
      causationId: params.causationId,
      idempotencyKey: params.data.idempotencyKey,
    });
  }

  mapBetDebitFailed(params: {
    outboxId: string;
    persistedAt: Date;
    data: BetDebitFailedData;
    correlationId?: string | null;
    causationId?: string | null;
  }): CreateOutboxMessageProps {
    return this.createMoneyFlowMessage({
      outboxId: params.outboxId,
      persistedAt: params.persistedAt,
      eventType: BET_DEBIT_FAILED,
      aggregateId: params.data.betId,
      data: params.data,
      correlationId: params.correlationId,
      causationId: params.causationId,
      idempotencyKey: params.data.idempotencyKey,
    });
  }

  mapBetRefundSucceeded(params: {
    outboxId: string;
    persistedAt: Date;
    data: BetRefundSucceededData;
    correlationId?: string | null;
    causationId?: string | null;
  }): CreateOutboxMessageProps {
    return this.createMoneyFlowMessage({
      outboxId: params.outboxId,
      persistedAt: params.persistedAt,
      eventType: BET_REFUND_SUCCEEDED,
      aggregateId: params.data.betId,
      data: params.data,
      correlationId: params.correlationId,
      causationId: params.causationId,
      idempotencyKey: params.data.idempotencyKey,
    });
  }

  mapBetRefundFailed(params: {
    outboxId: string;
    persistedAt: Date;
    data: BetRefundFailedData;
    correlationId?: string | null;
    causationId?: string | null;
  }): CreateOutboxMessageProps {
    return this.createMoneyFlowMessage({
      outboxId: params.outboxId,
      persistedAt: params.persistedAt,
      eventType: BET_REFUND_FAILED,
      aggregateId: params.data.betId,
      data: params.data,
      correlationId: params.correlationId,
      causationId: params.causationId,
      idempotencyKey: params.data.idempotencyKey,
    });
  }

  mapCashoutCreditSucceeded(params: {
    outboxId: string;
    persistedAt: Date;
    data: CashoutCreditSucceededData;
    correlationId?: string | null;
    causationId?: string | null;
  }): CreateOutboxMessageProps {
    return this.createMoneyFlowMessage({
      outboxId: params.outboxId,
      persistedAt: params.persistedAt,
      eventType: CASHOUT_CREDIT_SUCCEEDED,
      aggregateId: params.data.betId,
      data: params.data,
      correlationId: params.correlationId,
      causationId: params.causationId,
      idempotencyKey: params.data.idempotencyKey,
    });
  }

  mapCashoutCreditFailed(params: {
    outboxId: string;
    persistedAt: Date;
    data: CashoutCreditFailedData;
    correlationId?: string | null;
    causationId?: string | null;
  }): CreateOutboxMessageProps {
    return this.createMoneyFlowMessage({
      outboxId: params.outboxId,
      persistedAt: params.persistedAt,
      eventType: CASHOUT_CREDIT_FAILED,
      aggregateId: params.data.betId,
      data: params.data,
      correlationId: params.correlationId,
      causationId: params.causationId,
      idempotencyKey: params.data.idempotencyKey,
    });
  }

  private createMoneyFlowMessage(params: {
    outboxId: string;
    persistedAt: Date;
    eventType: string;
    aggregateId: string;
    data: Record<string, unknown>;
    correlationId?: string | null;
    causationId?: string | null;
    idempotencyKey: string;
  }): CreateOutboxMessageProps {
    return {
      id: params.outboxId,
      aggregateType: "wallet-money-flow",
      aggregateId: params.aggregateId,
      eventType: params.eventType,
      exchangeName: OUTBOX_EXCHANGE_NAME,
      routingKey: params.eventType,
      correlationId: params.correlationId,
      causationId: params.causationId,
      idempotencyKey: params.idempotencyKey,
      payload: buildBrokerEnvelope({
        eventType: params.eventType,
        occurredAt: params.persistedAt,
        aggregateType: "wallet-money-flow",
        aggregateId: params.aggregateId,
        producer: PRODUCER_NAME,
        idempotencyKey: params.idempotencyKey,
        correlationId: params.correlationId,
        causationId: params.causationId,
        metadata: {
          outboxId: params.outboxId,
        },
        data: params.data,
      }),
      createdAt: params.persistedAt,
      updatedAt: params.persistedAt,
      availableAt: params.persistedAt,
    };
  }
}
