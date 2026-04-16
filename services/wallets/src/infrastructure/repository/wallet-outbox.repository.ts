import { Injectable } from "@nestjs/common";
import { EntityManager } from "@mikro-orm/postgresql";
import type { IWalletOutboxRepository } from "@wallets/port/wallet-outbox.repository";
import {
  createWalletOutboxMessageRecord,
  WalletOutboxMessageRecord,
  WalletOutboxMessageSchema,
  type CreateWalletOutboxMessageProps,
} from "../schema/wallet-outbox-message";

@Injectable()
export class WalletOutboxRepository implements IWalletOutboxRepository {
  constructor(private readonly em: EntityManager) {}

  async insert(message: CreateWalletOutboxMessageProps): Promise<WalletOutboxMessageRecord> {
    const record = createWalletOutboxMessageRecord(message);

    const entity = this.em.create(WalletOutboxMessageSchema, {
      id: record.id,
      aggregateType: record.aggregateType,
      aggregateId: record.aggregateId,
      eventType: record.eventType,
      topic: record.topic,
      routingKey: record.routingKey,
      payload: record.payload,
      headers: record.headers,
      correlationId: record.correlationId,
      causationId: record.causationId,
      idempotencyKey: record.idempotencyKey,
      partitionKey: record.partitionKey,
      status: record.status,
      attempts: record.attempts,
      availableAt: record.availableAt,
      lockedAt: record.lockedAt,
      lockedBy: record.lockedBy,
      publishedAt: record.publishedAt,
      lastError: record.lastError,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });

    this.em.persist(entity);

    return record;
  }
}
