/// <reference types="bun-types" />

import { describe, expect, it } from "bun:test";
import {
  BET_DEBIT_REQUESTED,
  CASHOUT_CREDIT_REQUESTED,
} from "@crash/messaging";
import { GameDomainEventOutboxMapper } from "../../src/application/outbox/game-domain-event-outbox.mapper";

describe("GameDomainEventOutboxMapper", () => {
  it("maps round domain events to the shared outbox envelope", () => {
    const mapper = new GameDomainEventOutboxMapper();
    const occurredAt = new Date("2026-04-16T02:30:00.000Z");
    const persistedAt = new Date("2026-04-16T02:30:01.000Z");

    const message = mapper.mapRoundEvent({
      outboxId: "outbox-1",
      persistedAt,
      event: {
        type: "round.created",
        roundId: "round-1",
        occurredAt,
        crashPoint: 2.45,
        bettingClosesAt: new Date("2026-04-16T02:30:10.000Z"),
        startsAt: new Date("2026-04-16T02:30:10.500Z"),
        scheduledCrashAt: new Date("2026-04-16T02:30:12.500Z"),
        settlesAt: new Date("2026-04-16T02:30:14.500Z"),
        provablyFairStrategyId: "strategy-1",
        nonce: "nonce-1",
        serverSeedHash: "hash-1",
      },
    });

    expect(message).toMatchObject({
      aggregateType: "round",
      aggregateId: "round-1",
      eventType: "round.created",
      routingKey: "round.created",
      idempotencyKey: "round.created:round-1",
    });
    expect(message.payload.data).toMatchObject({
      roundId: "round-1",
      serverSeedHash: "hash-1",
    });
  });

  it("uses the shared money-flow contracts for debit and credit requests", () => {
    const mapper = new GameDomainEventOutboxMapper();
    const persistedAt = new Date("2026-04-16T02:30:01.000Z");

    const debitMessage = mapper.mapBetDebitRequested({
      outboxId: "outbox-2",
      persistedAt,
      data: {
        playerId: "player-1",
        roundId: "round-1",
        betId: "bet-1",
        amountInCents: "1000",
        currency: "BRL",
        idempotencyKey: "bet-1",
      },
    });
    const creditMessage = mapper.mapCashoutCreditRequested({
      outboxId: "outbox-3",
      persistedAt,
      data: {
        playerId: "player-1",
        roundId: "round-1",
        betId: "bet-1",
        payoutAmountInCents: "2500",
        currency: "BRL",
        idempotencyKey: "cashout-1",
      },
    });

    expect(debitMessage.eventType).toBe(BET_DEBIT_REQUESTED);
    expect(debitMessage.payload.data).toMatchObject({
      amountInCents: "1000",
      betId: "bet-1",
    });
    expect(creditMessage.eventType).toBe(CASHOUT_CREDIT_REQUESTED);
    expect(creditMessage.payload.data).toMatchObject({
      payoutAmountInCents: "2500",
      betId: "bet-1",
    });
  });
});
