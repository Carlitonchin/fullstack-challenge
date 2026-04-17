import type { OutboxStatus } from "@crash/persistence";

export type OutboxMessageHeaders = Record<string, string>;

export type BrokerEnvelopeMetadata = {
  correlationId?: string | null;
  causationId?: string | null;
  idempotencyKey: string;
  producer: string;
  aggregateType: string;
  aggregateId: string;
  [key: string]: unknown;
};

export type BrokerEnvelope<
  TData extends Record<string, unknown> = Record<string, unknown>,
  TMetadata extends BrokerEnvelopeMetadata = BrokerEnvelopeMetadata,
> = {
  eventType: string;
  occurredAt: string;
  version: number;
  aggregate: {
    type: string;
    id: string;
  };
  metadata: TMetadata;
  data: TData;
};

export type CreateOutboxMessageProps = {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  exchangeName: string;
  routingKey: string;
  payload: BrokerEnvelope<Record<string, unknown>>;
  headers?: OutboxMessageHeaders;
  correlationId?: string | null;
  causationId?: string | null;
  idempotencyKey: string;
  partitionKey?: string | null;
  status?: OutboxStatus;
  attempts?: number;
  availableAt?: Date;
  lockedAt?: Date | null;
  lockedBy?: string | null;
  publishedAt?: Date | null;
  lastError?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
};

export type OutboxMessageRecord = {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  exchangeName: string;
  routingKey: string;
  payload: BrokerEnvelope<Record<string, unknown>>;
  headers: OutboxMessageHeaders;
  correlationId: string | null;
  causationId: string | null;
  idempotencyKey: string;
  partitionKey: string | null;
  status: OutboxStatus;
  attempts: number;
  availableAt: Date;
  lockedAt: Date | null;
  lockedBy: string | null;
  publishedAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PublishBrokerMessageCommand = {
  exchangeName: string;
  routingKey: string;
  messageId: string;
  eventType: string;
  payload: Record<string, unknown>;
  headers: Record<string, string>;
  correlationId?: string | null;
  causationId?: string | null;
};

export interface BrokerPublisher {
  publish(command: PublishBrokerMessageCommand): Promise<void>;
  close(): Promise<void>;
}

export interface Clock {
  now(): Date;
}

export type ClaimOutboxBatchParams = {
  batchSize: number;
  claimedAt: Date;
  expiredLockAt: Date;
  workerId: string;
};

export type MarkOutboxPublishedParams = {
  messageId: string;
  publishedAt: Date;
  workerId: string;
};

export type MarkOutboxRetryParams = {
  messageId: string;
  availableAt: Date;
  failedAt: Date;
  error: string;
  workerId: string;
};

export type MarkOutboxUnroutableParams = {
  messageId: string;
  availableAt: Date;
  failedAt: Date;
  error: string;
  workerId: string;
};

export type MarkOutboxFailedParams = {
  messageId: string;
  failedAt: Date;
  error: string;
  workerId: string;
};

export type ReleaseExpiredOutboxLocksParams = {
  expiredLockAt: Date;
  releasedAt: Date;
};

export interface OutboxRepository {
  insert(message: CreateOutboxMessageProps): Promise<OutboxMessageRecord>;
  claimBatch(params: ClaimOutboxBatchParams): Promise<OutboxMessageRecord[]>;
  markPublished(params: MarkOutboxPublishedParams): Promise<void>;
  markRetry(params: MarkOutboxRetryParams): Promise<void>;
  markUnroutable(params: MarkOutboxUnroutableParams): Promise<void>;
  markFailed(params: MarkOutboxFailedParams): Promise<void>;
  releaseExpiredLocks(params: ReleaseExpiredOutboxLocksParams): Promise<number>;
}

export type OutboxRuntimeConfig = {
  rabbitMqUrl: string;
  exchangeType: "topic";
  batchSize: number;
  pollingIntervalMs: number;
  maxAttempts: number;
  lockTimeoutMs: number;
  maxBackoffMs: number;
};

export type BuildBrokerEnvelopeParams<
  TData extends Record<string, unknown>,
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
> = {
  eventType: string;
  occurredAt: Date | string;
  version?: number;
  aggregateType: string;
  aggregateId: string;
  producer: string;
  idempotencyKey: string;
  correlationId?: string | null;
  causationId?: string | null;
  metadata?: TMetadata;
  data: TData;
};

export type RawOutboxRow = {
  id: string;
  aggregate_type: string;
  aggregate_id: string;
  event_type: string;
  exchange_name: string;
  routing_key: string;
  payload: OutboxMessageRecord["payload"];
  headers: OutboxMessageRecord["headers"];
  correlation_id: string | null;
  causation_id: string | null;
  idempotency_key: string;
  partition_key: string | null;
  status: OutboxStatus;
  attempts: number;
  available_at: string | Date;
  locked_at: string | Date | null;
  locked_by: string | null;
  published_at: string | Date | null;
  last_error: string | null;
  created_at: string | Date;
  updated_at: string | Date;
};
