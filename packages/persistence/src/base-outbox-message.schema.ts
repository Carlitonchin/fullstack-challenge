import { defineEntity, p } from "@mikro-orm/core";
import { BaseCreatedAtSchema } from "./base-created-at.schema";
import { timestampTz } from "./field-builders";

export const BaseOutboxMessageSchema = defineEntity({
  name: "BaseOutboxMessage",
  abstract: true,
  extends: BaseCreatedAtSchema,
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
    attempts: p.integer().check("attempts >= 0"),
    availableAt: timestampTz("available_at"),
    lockedAt: timestampTz("locked_at").nullable(),
    lockedBy: p.text().fieldName("locked_by").nullable(),
    publishedAt: timestampTz("published_at").nullable(),
    lastError: p.text().fieldName("last_error").nullable(),
    updatedAt: timestampTz("updated_at")
      .onCreate(() => new Date())
      .onUpdate(() => new Date()),
  },
});
