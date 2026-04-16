import { defineEntity, type InferEntity, p } from "@mikro-orm/core";

export enum WalletOutboxStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  UNROUTABLE = "UNROUTABLE",
  PUBLISHED = "PUBLISHED",
  FAILED = "FAILED",
}

export type OutboxMessageHeaders = Record<string, string>;

export type OutboxMessagePayload = {
  eventType: string;
  occurredAt: string;
  version: number;
  aggregate: {
    type: string;
    id: string;
  };
  metadata: {
    correlationId?: string | null;
    causationId?: string | null;
    idempotencyKey: string;
    producer: string;
    aggregateType: string;
    aggregateId: string;
    [key: string]: unknown;
  };
  data: Record<string, unknown>;
};

export type CreateWalletOutboxMessageProps = {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  exchangeName: string;
  routingKey: string;
  payload: OutboxMessagePayload;
  headers?: OutboxMessageHeaders;
  correlationId?: string | null;
  causationId?: string | null;
  idempotencyKey: string;
  partitionKey?: string | null;
  status?: WalletOutboxStatus;
  attempts?: number;
  availableAt?: Date;
  lockedAt?: Date | null;
  lockedBy?: string | null;
  publishedAt?: Date | null;
  lastError?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
};

export type WalletOutboxMessageRecord = {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  exchangeName: string;
  routingKey: string;
  payload: OutboxMessagePayload;
  headers: OutboxMessageHeaders;
  correlationId: string | null;
  causationId: string | null;
  idempotencyKey: string;
  partitionKey: string | null;
  status: WalletOutboxStatus;
  attempts: number;
  availableAt: Date;
  lockedAt: Date | null;
  lockedBy: string | null;
  publishedAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export function createWalletOutboxMessageRecord(
  props: CreateWalletOutboxMessageProps,
): WalletOutboxMessageRecord {
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
    status: props.status ?? WalletOutboxStatus.PENDING,
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

export const WalletOutboxMessageSchema = defineEntity({
  name: "WalletOutboxMessage",
  tableName: "wallet_outbox_messages",
  indexes: [
    {
      name: "wallet_outbox_messages_status_available_at_created_at_index",
      properties: ["status", "availableAt", "createdAt"],
    },
    {
      name: "wallet_outbox_messages_aggregate_type_aggregate_id_created_at_index",
      properties: ["aggregateType", "aggregateId", "createdAt"],
    },
    {
      name: "wallet_outbox_messages_correlation_id_index",
      properties: ["correlationId"],
    },
  ],
  uniques: [
    {
      name: "wallet_outbox_messages_event_type_idempotency_key_unique",
      properties: ["eventType", "idempotencyKey"],
    },
  ],
  properties: {
    id: p.text().primary(),
    aggregateType: p.text().fieldName("aggregate_type"),
    aggregateId: p.text().fieldName("aggregate_id"),
    eventType: p.text().fieldName("event_type"),
    exchangeName: p.text().fieldName("exchange_name"),
    routingKey: p.text().fieldName("routing_key"),
    payload: p.json().columnType("jsonb"),
    headers: p.json().columnType("jsonb"),
    correlationId: p.text().fieldName("correlation_id").nullable(),
    causationId: p.text().fieldName("causation_id").nullable(),
    idempotencyKey: p.text().fieldName("idempotency_key"),
    partitionKey: p.text().fieldName("partition_key").nullable(),
    status: p
      .enum(() => WalletOutboxStatus)
      .nativeEnumName("wallet_outbox_status"),
    attempts: p.integer().check("attempts >= 0"),
    availableAt: p
      .datetime()
      .fieldName("available_at")
      .columnType("timestamptz"),
    lockedAt: p
      .datetime()
      .fieldName("locked_at")
      .columnType("timestamptz")
      .nullable(),
    lockedBy: p.text().fieldName("locked_by").nullable(),
    publishedAt: p
      .datetime()
      .fieldName("published_at")
      .columnType("timestamptz")
      .nullable(),
    lastError: p.text().fieldName("last_error").nullable(),
    createdAt: p
      .datetime()
      .fieldName("created_at")
      .columnType("timestamptz")
      .onCreate(() => new Date()),
    updatedAt: p
      .datetime()
      .fieldName("updated_at")
      .columnType("timestamptz")
      .onCreate(() => new Date())
      .onUpdate(() => new Date()),
  },
});

export type IWalletOutboxMessage = InferEntity<typeof WalletOutboxMessageSchema>;

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
  return value ? new Date(value) : null;
}
