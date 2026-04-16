import { Injectable } from "@nestjs/common";
import { EntityManager } from "@mikro-orm/postgresql";
import type {
  ClaimWalletOutboxBatchParams,
  IWalletOutboxRepository,
  MarkWalletOutboxFailedParams,
  MarkWalletOutboxPublishedParams,
  MarkWalletOutboxRetryParams,
  ReleaseExpiredWalletOutboxLocksParams,
} from "@wallets/port/wallet-outbox.repository";
import {
  createWalletOutboxMessageRecord,
  WalletOutboxStatus,
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
      exchangeName: record.exchangeName,
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

  async claimBatch(
    params: ClaimWalletOutboxBatchParams,
  ): Promise<WalletOutboxMessageRecord[]> {
    const rows = await this.em.getConnection().execute<RawWalletOutboxRow[]>(
      `
        with candidates as (
          select id
          from wallet_outbox_messages
          where available_at <= ?
            and (
              status = ?
              or (status = ? and locked_at is not null and locked_at <= ?)
            )
          order by created_at asc
          limit ?
          for update skip locked
        )
        update wallet_outbox_messages as messages
        set status = ?,
            locked_at = ?,
            locked_by = ?,
            updated_at = ?
        from candidates
        where messages.id = candidates.id
        returning
          messages.id,
          messages.aggregate_type,
          messages.aggregate_id,
          messages.event_type,
          messages.exchange_name,
          messages.routing_key,
          messages.payload,
          messages.headers,
          messages.correlation_id,
          messages.causation_id,
          messages.idempotency_key,
          messages.partition_key,
          messages.status,
          messages.attempts,
          messages.available_at,
          messages.locked_at,
          messages.locked_by,
          messages.published_at,
          messages.last_error,
          messages.created_at,
          messages.updated_at
      `,
      [
        params.claimedAt,
        WalletOutboxStatus.PENDING,
        WalletOutboxStatus.PROCESSING,
        params.expiredLockAt,
        params.batchSize,
        WalletOutboxStatus.PROCESSING,
        params.claimedAt,
        params.workerId,
        params.claimedAt,
      ],
    );

    return rows.map((row) => this.mapRow(row));
  }

  async markPublished(params: MarkWalletOutboxPublishedParams): Promise<void> {
    await this.em.getConnection().execute(
      `
        update wallet_outbox_messages
        set status = ?,
            published_at = ?,
            locked_at = null,
            locked_by = null,
            last_error = null,
            updated_at = ?
        where id = ?
          and status = ?
          and locked_by = ?
      `,
      [
        WalletOutboxStatus.PUBLISHED,
        params.publishedAt,
        params.publishedAt,
        params.messageId,
        WalletOutboxStatus.PROCESSING,
        params.workerId,
      ],
    );
  }

  async markRetry(params: MarkWalletOutboxRetryParams): Promise<void> {
    await this.em.getConnection().execute(
      `
        update wallet_outbox_messages
        set status = ?,
            attempts = attempts + 1,
            available_at = ?,
            locked_at = null,
            locked_by = null,
            last_error = ?,
            updated_at = ?
        where id = ?
          and status = ?
          and locked_by = ?
      `,
      [
        WalletOutboxStatus.PENDING,
        params.availableAt,
        params.error,
        params.failedAt,
        params.messageId,
        WalletOutboxStatus.PROCESSING,
        params.workerId,
      ],
    );
  }

  async markFailed(params: MarkWalletOutboxFailedParams): Promise<void> {
    await this.em.getConnection().execute(
      `
        update wallet_outbox_messages
        set status = ?,
            attempts = attempts + 1,
            locked_at = null,
            locked_by = null,
            last_error = ?,
            updated_at = ?
        where id = ?
          and status = ?
          and locked_by = ?
      `,
      [
        WalletOutboxStatus.FAILED,
        params.error,
        params.failedAt,
        params.messageId,
        WalletOutboxStatus.PROCESSING,
        params.workerId,
      ],
    );
  }

  async releaseExpiredLocks(
    params: ReleaseExpiredWalletOutboxLocksParams,
  ): Promise<number> {
    const result = await this.em.getConnection().execute(
      `
        update wallet_outbox_messages
        set status = ?,
            locked_at = null,
            locked_by = null,
            updated_at = ?
        where status = ?
          and locked_at is not null
          and locked_at <= ?
      `,
      [
        WalletOutboxStatus.PENDING,
        params.releasedAt,
        WalletOutboxStatus.PROCESSING,
        params.expiredLockAt,
      ],
    );

    if (
      result &&
      typeof result === "object" &&
      "affectedRows" in result &&
      typeof result.affectedRows === "number"
    ) {
      return result.affectedRows;
    }

    return 0;
  }

  private mapRow(row: RawWalletOutboxRow): WalletOutboxMessageRecord {
    return createWalletOutboxMessageRecord({
      id: row.id,
      aggregateType: row.aggregate_type,
      aggregateId: row.aggregate_id,
      eventType: row.event_type,
      exchangeName: row.exchange_name,
      routingKey: row.routing_key,
      payload: row.payload,
      headers: row.headers,
      correlationId: row.correlation_id,
      causationId: row.causation_id,
      idempotencyKey: row.idempotency_key,
      partitionKey: row.partition_key,
      status: row.status,
      attempts: row.attempts,
      availableAt: new Date(row.available_at),
      lockedAt: row.locked_at ? new Date(row.locked_at) : null,
      lockedBy: row.locked_by,
      publishedAt: row.published_at ? new Date(row.published_at) : null,
      lastError: row.last_error,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }
}

type RawWalletOutboxRow = {
  id: string;
  aggregate_type: string;
  aggregate_id: string;
  event_type: string;
  exchange_name: string;
  routing_key: string;
  payload: WalletOutboxMessageRecord["payload"];
  headers: WalletOutboxMessageRecord["headers"];
  correlation_id: string | null;
  causation_id: string | null;
  idempotency_key: string;
  partition_key: string | null;
  status: WalletOutboxStatus;
  attempts: number;
  available_at: string | Date;
  locked_at: string | Date | null;
  locked_by: string | null;
  published_at: string | Date | null;
  last_error: string | null;
  created_at: string | Date;
  updated_at: string | Date;
};
