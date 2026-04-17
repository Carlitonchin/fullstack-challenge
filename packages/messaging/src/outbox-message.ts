import { OutboxStatus } from "@crash/persistence";
import type {
  BrokerEnvelope,
  BrokerEnvelopeMetadata,
  BuildBrokerEnvelopeParams,
  CreateOutboxMessageProps,
  OutboxMessageRecord,
  RawOutboxRow,
} from "./types";

export function createOutboxMessageRecord(
  props: CreateOutboxMessageProps,
): OutboxMessageRecord {
  const id = normalizeRequiredString(props.id, "id");
  const aggregateType = normalizeRequiredString(
    props.aggregateType,
    "aggregateType",
  );
  const aggregateId = normalizeRequiredString(props.aggregateId, "aggregateId");
  const eventType = normalizeRequiredString(props.eventType, "eventType");
  const exchangeName = normalizeRequiredString(
    props.exchangeName,
    "exchangeName",
  );
  const routingKey = normalizeRequiredString(props.routingKey, "routingKey");
  const idempotencyKey = normalizeRequiredString(
    props.idempotencyKey,
    "idempotencyKey",
  );
  const attempts = props.attempts ?? 0;

  if (!Number.isInteger(attempts) || attempts < 0) {
    throw new Error("attempts must be a non-negative integer");
  }

  return {
    id,
    aggregateType,
    aggregateId,
    eventType,
    exchangeName,
    routingKey,
    payload: structuredClone(props.payload),
    headers: { ...(props.headers ?? {}) },
    correlationId: normalizeOptionalString(props.correlationId),
    causationId: normalizeOptionalString(props.causationId),
    idempotencyKey,
    partitionKey: normalizeOptionalString(props.partitionKey),
    status: props.status ?? OutboxStatus.PENDING,
    attempts,
    availableAt: cloneDate(props.availableAt ?? new Date()),
    lockedAt: cloneNullableDate(props.lockedAt),
    lockedBy: normalizeOptionalString(props.lockedBy),
    publishedAt: cloneNullableDate(props.publishedAt),
    lastError: props.lastError ?? null,
    createdAt: cloneDate(props.createdAt ?? new Date()),
    updatedAt: cloneDate(props.updatedAt ?? new Date()),
  };
}

export function buildBrokerEnvelope<
  TData extends Record<string, unknown>,
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
>(
  params: BuildBrokerEnvelopeParams<TData, TMetadata>,
): BrokerEnvelope<TData, BrokerEnvelopeMetadata & TMetadata> {
  const occurredAt =
    typeof params.occurredAt === "string"
      ? params.occurredAt
      : params.occurredAt.toISOString();
  const metadata: BrokerEnvelopeMetadata & TMetadata = {
    idempotencyKey: normalizeRequiredString(
      params.idempotencyKey,
      "idempotencyKey",
    ),
    producer: normalizeRequiredString(params.producer, "producer"),
    aggregateType: normalizeRequiredString(
      params.aggregateType,
      "aggregateType",
    ),
    aggregateId: normalizeRequiredString(params.aggregateId, "aggregateId"),
    ...(params.metadata
      ? (structuredClone(params.metadata) as TMetadata)
      : ({} as TMetadata)),
  };

  const correlationId = normalizeOptionalString(params.correlationId);
  const causationId = normalizeOptionalString(params.causationId);

  if (correlationId) {
    metadata.correlationId = correlationId;
  }

  if (causationId) {
    metadata.causationId = causationId;
  }

  return {
    eventType: normalizeRequiredString(params.eventType, "eventType"),
    occurredAt,
    version: params.version ?? 1,
    aggregate: {
      type: metadata.aggregateType,
      id: metadata.aggregateId,
    },
    metadata,
    data: structuredClone(params.data),
  };
}

export function calculateNextAttemptAt(
  attemptNumber: number,
  now: Date,
  maxBackoffMs: number,
): Date {
  const baseDelayMs = Math.min(1000 * 2 ** (attemptNumber - 1), maxBackoffMs);
  const jitterMs = Math.floor(Math.random() * Math.max(250, baseDelayMs / 4));

  return new Date(now.getTime() + Math.min(baseDelayMs + jitterMs, maxBackoffMs));
}

export function mapRawOutboxRowToRecord(row: RawOutboxRow): OutboxMessageRecord {
  return createOutboxMessageRecord({
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

function normalizeRequiredString(value: string, fieldName: string): string {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    throw new Error(`${fieldName} is required`);
  }

  return normalizedValue;
}

function normalizeOptionalString(value?: string | null): string | null {
  const normalizedValue = value?.trim();
  return normalizedValue ? normalizedValue : null;
}

function cloneDate(value: Date): Date {
  return new Date(value);
}

function cloneNullableDate(value?: Date | null): Date | null {
  return value ? cloneDate(value) : null;
}
