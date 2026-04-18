/// <reference types="bun-types" />

import { describe, expect, it } from "bun:test";

import { RoundEngineWorker } from "../../src/application/round-engine.worker";
import { Round, RoundStatus } from "../../src/domain/round/round";

const CREATED_AT = new Date("2026-04-17T12:00:00.000Z");

function assertSuccess<T>(result: { success: boolean; data?: T; error?: Error }): T {
  expect(result.success).toBe(true);

  if (!result.success) {
    throw result.error;
  }

  return result.data!;
}

function createSettledRound(): Round {
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

  expect(
    round.openBettingFromFirstAcceptedBet({
      openedAt: CREATED_AT,
      bettingWindowInSeconds: 10,
      startDelayInMs: 30_000,
      roundDurationInMs: 3_000,
      crashRevealInMs: 2_000,
    }).success,
  ).toBe(true);
  expect(round.closeBetting(round.bettingClosesAt!).success).toBe(true);
  expect(round.start(round.startsAt!).success).toBe(true);
  expect(round.crash(round.scheduledCrashAt!).success).toBe(true);
  expect(round.settle(round.settlesAt!).success).toBe(true);

  return round;
}

describe("RoundEngineWorker", () => {
  it("does not advance a round that is waiting for the first bet", () => {
    const worker = new RoundEngineWorker(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const waitingRound = assertSuccess(
      Round.new({
        id: "round-2",
        crashPoint: 2.5,
        provablyFairStrategyId: "casino-crash-v1",
        nonce: "round-2",
        serverSeedHash: "seed-hash",
        serverSeed: "seed",
        createdAt: CREATED_AT,
        bettingWindowInSeconds: 10,
        startDelayInMs: 30_000,
        roundDurationInMs: 3_000,
        crashRevealInMs: 2_000,
      }),
    );
    const nextAt = (worker as any).resolveNextWakeUp(
      waitingRound,
      CREATED_AT,
    ) as Date | null;

    expect(waitingRound.status).toBe(RoundStatus.WAITING_FOR_FIRST_BET);
    expect(waitingRound.shouldCloseBetting(new Date(CREATED_AT.getTime() + 60_000))).toBe(
      false,
    );
    expect(nextAt?.getTime()).toBeGreaterThan(CREATED_AT.getTime());
  });

  it("does not keep a settled round parked behind an artificial next-round delay", () => {
    const worker = new RoundEngineWorker(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const settledRound = createSettledRound();
    const nextAt = (worker as any).resolveNextWakeUp(
      settledRound,
      new Date(settledRound.settlesAt!.getTime() + 1_000),
    ) as Date | null;

    expect(nextAt).not.toBeNull();
    expect(nextAt!.getTime()).toBe(
      settledRound.settlesAt!.getTime() + 1_000 + 500,
    );
  });
});
