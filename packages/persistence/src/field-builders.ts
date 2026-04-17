import { p } from "@mikro-orm/core";

export enum OutboxStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  UNROUTABLE = "UNROUTABLE",
  PUBLISHED = "PUBLISHED",
  FAILED = "FAILED",
}

export function timestampTz(fieldName: string) {
  return p.datetime().fieldName(fieldName).columnType("timestamptz");
}

export function versionField(fieldName: string) {
  return p.integer().fieldName(fieldName).default(1).check(`${fieldName} > 0`).version();
}

export function createOutboxStatusProperty(nativeEnumName: string) {
  return p.enum(() => OutboxStatus).nativeEnumName(nativeEnumName);
}

export function createOutboxIndexes(prefix: string) {
  return [
    {
      name: `${prefix}_status_available_at_created_at_index`,
      properties: ["status", "availableAt", "createdAt"],
    },
    {
      name: `${prefix}_aggregate_type_aggregate_id_created_at_index`,
      properties: ["aggregateType", "aggregateId", "createdAt"],
    },
    {
      name: `${prefix}_correlation_id_index`,
      properties: ["correlationId"],
    },
  ];
}

export function createOutboxUniques(prefix: string) {
  return [
    {
      name: `${prefix}_event_type_idempotency_key_unique`,
      properties: ["eventType", "idempotencyKey"],
    },
  ];
}
