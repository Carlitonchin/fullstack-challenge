/// <reference types="bun-types" />

import { describe, expect, it } from "bun:test";

import { GameCommandService } from "../../src/application/game-command.service";
import { Bet, BetStatus } from "../../src/domain/bet/bet";
import { BetAmount } from "../../src/domain/bet/bet-amount";
import { Round, RoundStatus } from "../../src/domain/round/round";
import { LogarithmicRoundTimingStrategy } from "../../src/domain/round/round-timing.strategy";
import type { IBetRepository } from "../../src/port/bet.repository";
import type { IRoundRepository } from "../../src/port/round.repository";

const CREATED_AT = new Date("2026-04-17T12:00:00.000Z");
const DEBIT_CONFIRMED_AT = new Date("2026-04-17T12:00:05.000Z");
const DEBIT_FAILED_AT = new Date("2026-04-17T12:00:06.000Z");

function assertSuccess<T>(result: { success: boolean; data?: T; error?: Error }): T {
  expect(result.success).toBe(true);

  if (!result.success) {
    throw result.error;
  }

  return result.data!;
}

function createRound(): Round {
  const round = assertSuccess(
    Round.new({
      id: "round-1",
      crashPoint: 2.5,
      provablyFairStrategyId: "casino-crash-v1",
      nonce: "round-1",
      serverSeedHash: "seed-hash",
      serverSeed: "seed",
      createdAt: CREATED_AT,
      bettingWindowInSeconds: 10,
      startDelayInMs: 30_000,
      roundDurationInMs: 3_000,
      crashRevealInMs: 2_000,
    }),
  );

  round.pullDomainEvents();

  return round;
}

function createPendingBet(): Bet {
  const amount = assertSuccess(
    BetAmount.create({
      amountInCents: 1_000,
      currency: "BRL",
    }),
  );

  const bet = assertSuccess(
    Bet.new({
      id: "bet-1",
      roundId: "round-1",
      playerId: "player-1",
      playerUsername: "player",
      amount,
      createdAt: CREATED_AT,
    }),
  );

  bet.pullDomainEvents();

  return bet;
}

function createService(params: {
  round: Round;
  bet: Bet;
  outbox: {
    roundEventTypes: string[];
    betEventTypes: string[];
    refundRequests: unknown[];
  };
  realtime: {
    snapshots: number;
    betUpdates: string[];
  };
}) {
  const roundRepository: IRoundRepository = {
    findCurrentRound: async () => ({ success: true, data: params.round }),
    findById: async (id: string) => ({
      success: true,
      data: id === params.round.id ? params.round : undefined,
    }),
    findRecentSettledRounds: async () => ({ success: true, data: [] }),
    persist: async (round: Round) => ({ success: true, data: round }),
    update: async (round: Round) => {
      params.round = round.withVersion(round.version + 1);
      return { success: true, data: params.round };
    },
  };
  const betRepository: IBetRepository = {
    findByPlayerIdAndRoundId: async () => ({ success: true, data: params.bet }),
    findByRoundId: async () => ({ success: true, data: [params.bet] }),
    findByPlayerId: async () => ({ success: true, data: [params.bet] }),
    findById: async (id: string) => ({
      success: true,
      data: id === params.bet.id ? params.bet : undefined,
    }),
    persist: async (bet: Bet) => ({ success: true, data: bet }),
    update: async (bet: Bet) => {
      params.bet = bet;
      return { success: true, data: params.bet };
    },
  };
  const gameOutboxService = {
    insertRoundEvents: async ({ events }: { events: { type: string }[] }) => {
      params.outbox.roundEventTypes.push(...events.map((event) => event.type));
    },
    insertBetEvents: async ({ events }: { events: { type: string }[] }) => {
      params.outbox.betEventTypes.push(...events.map((event) => event.type));
    },
    insertBetDebitRequested: async () => undefined,
    insertBetRefundRequested: async (request: unknown) => {
      params.outbox.refundRequests.push(request);
    },
    insertCashoutCreditRequested: async () => undefined,
  };
  const realtimePublisher = {
    publishSnapshot: async () => {
      params.realtime.snapshots += 1;
    },
    publishBetUpdated: async (betId: string) => {
      params.realtime.betUpdates.push(betId);
    },
    publishHistoryUpdated: async () => undefined,
  };

  const service = new GameCommandService(
    roundRepository,
    betRepository,
    new LogarithmicRoundTimingStrategy(),
    gameOutboxService as never,
    {} as never,
    realtimePublisher as never,
    { flush: async () => undefined, clear: () => undefined } as never,
  );

  return {
    service,
    getRound: () => params.round,
    getBet: () => params.bet,
  };
}

describe("GameCommandService money-flow handlers", () => {
  it("opens betting and accepts the first pending bet when debit succeeds", async () => {
    const outbox = {
      roundEventTypes: [] as string[],
      betEventTypes: [] as string[],
      refundRequests: [] as unknown[],
    };
    const realtime = { snapshots: 0, betUpdates: [] as string[] };
    const { service, getRound, getBet } = createService({
      round: createRound(),
      bet: createPendingBet(),
      outbox,
      realtime,
    });

    await service.handleBetDebitSucceeded({
      eventType: "wallet.bet-debit-succeeded",
      occurredAt: DEBIT_CONFIRMED_AT.toISOString(),
      data: {
        betId: "bet-1",
        roundId: "round-1",
        playerId: "player-1",
        amountInCents: "1000",
        currency: "BRL",
      },
      metadata: {},
    } as never);

    expect(getRound().status).toBe(RoundStatus.BETTING_OPEN);
    expect(getRound().bettingClosesAt).toEqual(
      new Date(DEBIT_CONFIRMED_AT.getTime() + 10_000),
    );
    expect(getBet().status).toBe(BetStatus.ACCEPTED);
    expect(outbox.roundEventTypes).toEqual(["round.betting-opened"]);
    expect(outbox.betEventTypes).toEqual(["bet.accepted"]);
    expect(outbox.refundRequests).toHaveLength(0);
    expect(realtime.snapshots).toBe(2);
    expect(realtime.betUpdates).toEqual(["bet-1"]);
  });

  it("rejects a failed first debit without opening the waiting round", async () => {
    const outbox = {
      roundEventTypes: [] as string[],
      betEventTypes: [] as string[],
      refundRequests: [] as unknown[],
    };
    const realtime = { snapshots: 0, betUpdates: [] as string[] };
    const { service, getRound, getBet } = createService({
      round: createRound(),
      bet: createPendingBet(),
      outbox,
      realtime,
    });

    await service.handleBetDebitFailed({
      eventType: "wallet.bet-debit-failed",
      occurredAt: DEBIT_FAILED_AT.toISOString(),
      data: {
        betId: "bet-1",
        reason: "Insufficient balance",
      },
      metadata: {},
    } as never);

    expect(getRound().status).toBe(RoundStatus.WAITING_FOR_FIRST_BET);
    expect(getRound().bettingClosesAt).toBeNull();
    expect(getBet().status).toBe(BetStatus.REJECTED);
    expect(outbox.roundEventTypes).toEqual([]);
    expect(outbox.betEventTypes).toEqual(["bet.rejected"]);
    expect(realtime.snapshots).toBe(0);
    expect(realtime.betUpdates).toEqual([]);
  });
});
