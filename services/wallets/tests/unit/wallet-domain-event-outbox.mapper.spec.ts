/// <reference types="bun-types" />

import { describe, expect, it } from "bun:test";
import { WalletCreatedDomainEvent } from "../../src/domain/wallet/wallet.events";
import { WalletDomainEventOutboxMapper } from "../../src/application/outbox/wallet-domain-event-outbox.mapper";

describe("WalletDomainEventOutboxMapper", () => {
  it("maps wallet domain events to the shared outbox envelope", () => {
    const mapper = new WalletDomainEventOutboxMapper();
    const occurredAt = new Date("2026-04-16T02:30:00.000Z");
    const persistedAt = new Date("2026-04-16T02:30:01.000Z");

    const message = mapper.map({
      outboxId: "outbox-1",
      persistedAt,
      event: new WalletCreatedDomainEvent({
        type: "wallet.created",
        walletId: "wallet-1",
        playerId: "player-1",
        occurredAt,
        idempotencyKey: "wallet-1",
        amountInCents: 0n,
        currency: "BRL",
        balanceAfterInCents: 0n,
      }),
    });

    expect(message).toMatchObject({
      id: "outbox-1",
      aggregateType: "wallet",
      aggregateId: "wallet-1",
      eventType: "wallet.created",
      exchangeName: "wallets.domain",
      routingKey: "wallet.created",
      idempotencyKey: "wallet-1",
      createdAt: persistedAt,
      availableAt: persistedAt,
    });
    expect(message.payload.metadata).toMatchObject({
      producer: "wallets",
      outboxId: "outbox-1",
      aggregateId: "wallet-1",
    });
    expect(message.payload.data).toMatchObject({
      walletId: "wallet-1",
      playerId: "player-1",
      amountInCents: "0",
    });
  });
});
