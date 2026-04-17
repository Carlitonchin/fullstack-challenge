/// <reference types="bun-types" />

import { describe, expect, it } from "bun:test";
import { OutboxStatus } from "@crash/persistence";
import {
  buildBrokerEnvelope,
  createOutboxMessageRecord,
} from "../../src";

describe("createOutboxMessageRecord", () => {
  it("defaults the generic outbox record fields needed by a publisher", () => {
    const message = createOutboxMessageRecord({
      id: "outbox-1",
      aggregateType: "wallet",
      aggregateId: "wallet-1",
      eventType: "wallet.credited",
      exchangeName: "wallets.events",
      routingKey: "wallet.credited",
      idempotencyKey: "credit-1",
      payload: buildBrokerEnvelope({
        eventType: "wallet.credited",
        occurredAt: "2026-04-16T02:30:00.000Z",
        aggregateType: "wallet",
        aggregateId: "wallet-1",
        producer: "wallets",
        idempotencyKey: "credit-1",
        data: {
          amountInCents: "1000",
        },
      }),
    });

    expect(message.status).toBe(OutboxStatus.PENDING);
    expect(message.attempts).toBe(0);
    expect(message.headers).toEqual({});
    expect(message.availableAt).toBeInstanceOf(Date);
    expect(message.createdAt).toBeInstanceOf(Date);
    expect(message.updatedAt).toBeInstanceOf(Date);
  });

  it("rejects blank idempotency keys", () => {
    expect(() =>
      createOutboxMessageRecord({
        id: "outbox-2",
        aggregateType: "wallet",
        aggregateId: "wallet-1",
        eventType: "bet.debit.succeeded",
        exchangeName: "wallets.events",
        routingKey: "bet.debit.succeeded",
        idempotencyKey: "   ",
        payload: buildBrokerEnvelope({
          eventType: "bet.debit.succeeded",
          occurredAt: "2026-04-16T02:30:00.000Z",
          aggregateType: "wallet",
          aggregateId: "wallet-1",
          producer: "wallets",
          idempotencyKey: "credit-1",
          data: {},
        }),
      }),
    ).toThrow("idempotencyKey is required");
  });

  it("accepts arbitrary event types without schema-specific branching", () => {
    const message = createOutboxMessageRecord({
      id: "outbox-3",
      aggregateType: "wallet",
      aggregateId: "wallet-1",
      eventType: "cashout.credit.succeeded.v2",
      exchangeName: "wallets.events",
      routingKey: "cashout.credit.succeeded.v2",
      idempotencyKey: "cashout-1",
      payload: buildBrokerEnvelope({
        eventType: "cashout.credit.succeeded.v2",
        occurredAt: "2026-04-16T02:30:00.000Z",
        version: 2,
        aggregateType: "wallet",
        aggregateId: "wallet-1",
        producer: "wallets",
        idempotencyKey: "cashout-1",
        data: {
          payoutInCents: "2500",
        },
      }),
    });

    expect(message.eventType).toBe("cashout.credit.succeeded.v2");
    expect(message.routingKey).toBe("cashout.credit.succeeded.v2");
  });
});
