import { EntityManager } from "@mikro-orm/postgresql";
import { OutboxStatus } from "@crash/persistence";
import {
  createOutboxMessageRecord,
  mapRawOutboxRowToRecord,
} from "./outbox-message";
import type {
  ClaimOutboxBatchParams,
  CreateOutboxMessageProps,
  MarkOutboxFailedParams,
  MarkOutboxPublishedParams,
  MarkOutboxRetryParams,
  MarkOutboxUnroutableParams,
  OutboxMessageRecord,
  OutboxRepository,
  RawOutboxRow,
  ReleaseExpiredOutboxLocksParams,
} from "./types";

export type PostgresOutboxRepositoryOptions = {
  schema: unknown;
  tableName: string;
};

export class PostgresOutboxRepository implements OutboxRepository {
  constructor(
    private readonly em: EntityManager,
    private readonly options: PostgresOutboxRepositoryOptions,
  ) {}

  async insert(message: CreateOutboxMessageProps): Promise<OutboxMessageRecord> {
    const record = createOutboxMessageRecord(message);

    const entity = this.em.create(this.options.schema as never, {
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
    } as never);

    this.em.persist(entity);

    return record;
  }

  async claimBatch(params: ClaimOutboxBatchParams): Promise<OutboxMessageRecord[]> {
    const rows = await this.em.getConnection().execute<RawOutboxRow[]>(
      `
        with candidates as (
          select id
          from ${this.options.tableName}
          where available_at <= ?
            and (
              status = ?
              or (status = ? and locked_at is not null and locked_at <= ?)
            )
          order by created_at asc
          limit ?
          for update skip locked
        )
        update ${this.options.tableName} as messages
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
        OutboxStatus.PENDING,
        OutboxStatus.PROCESSING,
        params.expiredLockAt,
        params.batchSize,
        OutboxStatus.PROCESSING,
        params.claimedAt,
        params.workerId,
        params.claimedAt,
      ],
    );

    return rows.map((row) => mapRawOutboxRowToRecord(row));
  }

  async markPublished(params: MarkOutboxPublishedParams): Promise<void> {
    await this.em.getConnection().execute(
      `
        update ${this.options.tableName}
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
        OutboxStatus.PUBLISHED,
        params.publishedAt,
        params.publishedAt,
        params.messageId,
        OutboxStatus.PROCESSING,
        params.workerId,
      ],
    );
  }

  async markRetry(params: MarkOutboxRetryParams): Promise<void> {
    await this.em.getConnection().execute(
      `
        update ${this.options.tableName}
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
        OutboxStatus.PENDING,
        params.availableAt,
        params.error,
        params.failedAt,
        params.messageId,
        OutboxStatus.PROCESSING,
        params.workerId,
      ],
    );
  }

  async markUnroutable(params: MarkOutboxUnroutableParams): Promise<void> {
    await this.em.getConnection().execute(
      `
        update ${this.options.tableName}
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
        OutboxStatus.UNROUTABLE,
        params.availableAt,
        params.error,
        params.failedAt,
        params.messageId,
        OutboxStatus.PROCESSING,
        params.workerId,
      ],
    );
  }

  async markFailed(params: MarkOutboxFailedParams): Promise<void> {
    await this.em.getConnection().execute(
      `
        update ${this.options.tableName}
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
        OutboxStatus.FAILED,
        params.error,
        params.failedAt,
        params.messageId,
        OutboxStatus.PROCESSING,
        params.workerId,
      ],
    );
  }

  async releaseExpiredLocks(
    params: ReleaseExpiredOutboxLocksParams,
  ): Promise<number> {
    const result = await this.em.getConnection().execute(
      `
        update ${this.options.tableName}
        set status = ?,
            locked_at = null,
            locked_by = null,
            updated_at = ?
        where status = ?
          and locked_at is not null
          and locked_at <= ?
      `,
      [
        OutboxStatus.PENDING,
        params.releasedAt,
        OutboxStatus.PROCESSING,
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
}
