/// <reference types="bun-types" />

import { describe, expect, it } from "bun:test";

import { RoundEngineWorker } from "../../src/application/round-engine.worker";
import { Round } from "../../src/domain/round/round";
import { NEXT_ROUND_DELAY_IN_MS } from "../../src/domain/round/round-timing.strategy";

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

  expect(round.closeBetting(round.bettingClosesAt).success).toBe(true);
  expect(round.start(round.startsAt).success).toBe(true);
  expect(round.crash(round.scheduledCrashAt).success).toBe(true);
  expect(round.settle(round.settlesAt).success).toBe(true);

  return round;
}

describe("RoundEngineWorker", () => {
  it("waits 60 seconds after settlement before opening the next round", () => {
    const worker = new RoundEngineWorker(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const settledRound = createSettledRound();
    const nextAt = (worker as any).resolveNextWakeUp(
      settledRound,
      new Date(settledRound.settlesAt.getTime() + 1_000),
    ) as Date | null;

    expect(nextAt).toEqual(
      new Date(settledRound.settlesAt.getTime() + NEXT_ROUND_DELAY_IN_MS),
    );
  });
});
