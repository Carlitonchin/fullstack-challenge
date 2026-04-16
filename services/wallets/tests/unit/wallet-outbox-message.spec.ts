/// <reference types="bun-types" />

import { describe, expect, it } from "bun:test";

import {
  createWalletOutboxMessageRecord,
  WalletOutboxStatus,
} from "../../src/infrastructure/schema/wallet-outbox-message";

describe("Wallet outbox message", () => {
  it("defaults the generic outbox record fields needed by a publisher", () => {
    const message = createWalletOutboxMessageRecord({
      id: "outbox-1",
      aggregateType: "wallet",
      aggregateId: "wallet-1",
      eventType: "wallet.credited",
      exchangeName: "wallets.events",
      routingKey: "wallet.credited",
      idempotencyKey: "credit-1",
      payload: {
        eventType: "wallet.credited",
        occurredAt: "2026-04-16T02:30:00.000Z",
        version: 1,
        aggregate: {
          type: "wallet",
          id: "wallet-1",
        },
        metadata: {
          idempotencyKey: "credit-1",
          producer: "wallets",
          aggregateType: "wallet",
          aggregateId: "wallet-1",
        },
        data: {
          amountInCents: "1000",
        },
      },
    });

    expect(message.status).toBe(WalletOutboxStatus.PENDING);
    expect(message.attempts).toBe(0);
    expect(message.headers).toEqual({});
    expect(message.availableAt).toBeInstanceOf(Date);
    expect(message.createdAt).toBeInstanceOf(Date);
    expect(message.updatedAt).toBeInstanceOf(Date);
  });

  it("rejects blank idempotency keys", () => {
    expect(() =>
      createWalletOutboxMessageRecord({
        id: "outbox-2",
        aggregateType: "wallet",
        aggregateId: "wallet-1",
        eventType: "bet.debit.succeeded",
        exchangeName: "wallets.events",
        routingKey: "bet.debit.succeeded",
        idempotencyKey: "   ",
        payload: {
          eventType: "bet.debit.succeeded",
          occurredAt: "2026-04-16T02:30:00.000Z",
          version: 1,
          aggregate: {
            type: "wallet",
            id: "wallet-1",
          },
          metadata: {
            idempotencyKey: "credit-1",
            producer: "wallets",
            aggregateType: "wallet",
            aggregateId: "wallet-1",
          },
          data: {},
        },
      }),
    ).toThrow("idempotencyKey is required");
  });

  it("accepts arbitrary event types without schema-specific branching", () => {
    const message = createWalletOutboxMessageRecord({
      id: "outbox-3",
      aggregateType: "wallet",
      aggregateId: "wallet-1",
      eventType: "cashout.credit.succeeded.v2",
      exchangeName: "wallets.events",
      routingKey: "cashout.credit.succeeded.v2",
      idempotencyKey: "cashout-1",
      payload: {
        eventType: "cashout.credit.succeeded.v2",
        occurredAt: "2026-04-16T02:30:00.000Z",
        version: 2,
        aggregate: {
          type: "wallet",
          id: "wallet-1",
        },
        metadata: {
          idempotencyKey: "cashout-1",
          producer: "wallets",
          aggregateType: "wallet",
          aggregateId: "wallet-1",
        },
        data: {
          payoutInCents: "2500",
        },
      },
    });

    expect(message.eventType).toBe("cashout.credit.succeeded.v2");
    expect(message.routingKey).toBe("cashout.credit.succeeded.v2");
  });
});
