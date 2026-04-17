import { Injectable } from "@nestjs/common";
import {
  BET_DEBIT_REQUESTED,
  BET_REFUND_REQUESTED,
  CASHOUT_CREDIT_REQUESTED,
  buildBrokerEnvelope,
  type BetDebitRequestedData,
  type BetRefundRequestedData,
  type CashoutCreditRequestedData,
  type CreateOutboxMessageProps,
} from "@crash/messaging";
import type { BetDomainEvent } from "@games/domain/bet/bet.events";
import type { RoundDomainEvent } from "@games/domain/round/round.events";

const OUTBOX_EXCHANGE_NAME = "games.domain";
const PRODUCER_NAME = "games";

@Injectable()
export class GameDomainEventOutboxMapper {
  mapRoundEvent(params: {
    event: RoundDomainEvent;
    outboxId: string;
    persistedAt: Date;
  }): CreateOutboxMessageProps {
    const { event, outboxId, persistedAt } = params;

    return this.createMessage({
      outboxId,
      persistedAt,
      aggregateType: "round",
      aggregateId: event.roundId,
      eventType: event.type,
      idempotencyKey: `${event.type}:${event.roundId}`,
      occurredAt: event.occurredAt,
      data: this.serializeRoundEvent(event),
    });
  }

  mapBetEvent(params: {
    event: BetDomainEvent;
    outboxId: string;
    persistedAt: Date;
  }): CreateOutboxMessageProps {
    const { event, outboxId, persistedAt } = params;

    return this.createMessage({
      outboxId,
      persistedAt,
      aggregateType: "bet",
      aggregateId: event.betId,
      eventType: event.type,
      idempotencyKey: `${event.type}:${event.betId}`,
      occurredAt: event.occurredAt,
      data: this.serializeBetEvent(event),
    });
  }

  mapBetDebitRequested(params: {
    data: BetDebitRequestedData;
    outboxId: string;
    persistedAt: Date;
    correlationId?: string | null;
    causationId?: string | null;
  }): CreateOutboxMessageProps {
    const { data, outboxId, persistedAt, correlationId, causationId } = params;

    return this.createMessage({
      outboxId,
      persistedAt,
      aggregateType: "bet",
      aggregateId: data.betId,
      eventType: BET_DEBIT_REQUESTED,
      idempotencyKey: data.idempotencyKey,
      occurredAt: persistedAt,
      correlationId,
      causationId,
      data,
    });
  }

  mapCashoutCreditRequested(params: {
    data: CashoutCreditRequestedData;
    outboxId: string;
    persistedAt: Date;
    correlationId?: string | null;
    causationId?: string | null;
  }): CreateOutboxMessageProps {
    const { data, outboxId, persistedAt, correlationId, causationId } = params;

    return this.createMessage({
      outboxId,
      persistedAt,
      aggregateType: "bet",
      aggregateId: data.betId,
      eventType: CASHOUT_CREDIT_REQUESTED,
      idempotencyKey: data.idempotencyKey,
      occurredAt: persistedAt,
      correlationId,
      causationId,
      data,
    });
  }

  mapBetRefundRequested(params: {
    data: BetRefundRequestedData;
    outboxId: string;
    persistedAt: Date;
    correlationId?: string | null;
    causationId?: string | null;
  }): CreateOutboxMessageProps {
    const { data, outboxId, persistedAt, correlationId, causationId } = params;

    return this.createMessage({
      outboxId,
      persistedAt,
      aggregateType: "bet",
      aggregateId: data.betId,
      eventType: BET_REFUND_REQUESTED,
      idempotencyKey: data.idempotencyKey,
      occurredAt: persistedAt,
      correlationId,
      causationId,
      data,
    });
  }

  private createMessage(params: {
    outboxId: string;
    persistedAt: Date;
    aggregateType: string;
    aggregateId: string;
    eventType: string;
    idempotencyKey: string;
    occurredAt: Date;
    data: Record<string, unknown>;
    correlationId?: string | null;
    causationId?: string | null;
  }): CreateOutboxMessageProps {
    return {
      id: params.outboxId,
      aggregateType: params.aggregateType,
      aggregateId: params.aggregateId,
      eventType: params.eventType,
      exchangeName: OUTBOX_EXCHANGE_NAME,
      routingKey: params.eventType,
      correlationId: params.correlationId,
      causationId: params.causationId,
      idempotencyKey: params.idempotencyKey,
      payload: buildBrokerEnvelope({
        eventType: params.eventType,
        occurredAt: params.occurredAt,
        aggregateType: params.aggregateType,
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

  private serializeRoundEvent(event: RoundDomainEvent): Record<string, unknown> {
    switch (event.type) {
      case "round.created":
        return {
          roundId: event.roundId,
          crashPoint: event.crashPoint,
          provablyFairStrategyId: event.provablyFairStrategyId,
          nonce: event.nonce,
          serverSeedHash: event.serverSeedHash,
        };
      case "round.betting-opened":
        return {
          roundId: event.roundId,
          bettingOpenedAt: event.bettingOpenedAt.toISOString(),
          bettingClosesAt: event.bettingClosesAt.toISOString(),
          startsAt: event.startsAt.toISOString(),
          scheduledCrashAt: event.scheduledCrashAt.toISOString(),
          settlesAt: event.settlesAt.toISOString(),
        };
      case "round.crashed":
        return {
          roundId: event.roundId,
          crashMultiplier: event.crashMultiplier,
        };
      case "round.failed":
        return {
          roundId: event.roundId,
          errorReason: event.errorReason,
          refundRequired: event.refundRequired,
        };
      default:
        return {
          roundId: event.roundId,
        };
    }
  }

  private serializeBetEvent(event: BetDomainEvent): Record<string, unknown> {
    switch (event.type) {
      case "bet.created":
        return {
          betId: event.betId,
          roundId: event.roundId,
          playerId: event.playerId,
          playerUsername: event.playerUsername,
          amountInCents: event.amountInCents,
          currency: event.currency,
        };
      case "bet.rejected":
        return {
          betId: event.betId,
          roundId: event.roundId,
          playerId: event.playerId,
          playerUsername: event.playerUsername,
          rejectionReason: event.rejectionReason,
        };
      case "bet.cashed-out":
        return {
          betId: event.betId,
          roundId: event.roundId,
          playerId: event.playerId,
          playerUsername: event.playerUsername,
          cashoutMultiplier: event.cashoutMultiplier,
          payoutAmountInCents: event.payoutAmountInCents,
          currency: event.currency,
        };
      default:
        return {
          betId: event.betId,
          roundId: event.roundId,
          playerId: event.playerId,
          playerUsername: event.playerUsername,
        };
    }
  }
}
