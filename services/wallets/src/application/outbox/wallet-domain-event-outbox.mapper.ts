import { Injectable } from "@nestjs/common";
import {
  buildBrokerEnvelope,
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
}
