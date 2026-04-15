/// <reference types="bun-types" />

import { describe, expect, it } from "bun:test";

import { Round, RoundStatus } from "../../src/domain/round";

const ROUND_ID = "round-1";
const REHYDRATED_ROUND_ID = "round-2";
const INVALID_REHYDRATED_ROUND_ID = "round-3";
const SERVER_SEED = "seed";
const SERVER_SEED_HASH = "seed-hash";
const ERROR_REASON = "wallet debit timed out";
const POST_SETTLEMENT_ERROR_REASON = "cannot compensate after settlement";
const CREATED_AT = new Date("2026-04-15T12:00:00.000Z");
const BETTING_WINDOW_IN_SECONDS = 10;
const CRASH_POINT = 2.37;
const REHYDRATED_CRASH_POINT = 3.14;

const BETTING_CLOSE_OFFSET_SECONDS = BETTING_WINDOW_IN_SECONDS;
const START_OFFSET_SECONDS = BETTING_CLOSE_OFFSET_SECONDS + 1;
const CRASH_OFFSET_SECONDS = START_OFFSET_SECONDS + 3;
const FAILURE_OFFSET_SECONDS = 6;
const PRE_CREATION_OFFSET_MS = -1;
const AFTER_BETTING_CLOSE_OFFSET_MS = BETTING_WINDOW_IN_SECONDS * 1000 + 1;
const BEFORE_START_OFFSET_MS = START_OFFSET_SECONDS * 1000 - 500;
const EARLY_START_ATTEMPT_OFFSET_SECONDS = 5;
const SECOND_START_OFFSET_SECONDS = START_OFFSET_SECONDS + 1;
const FAIL_AFTER_SETTLEMENT_OFFSET_SECONDS = CRASH_OFFSET_SECONDS + 1;

function atOffsetSeconds(offsetSeconds: number): Date {
  return new Date(CREATED_AT.getTime() + offsetSeconds * 1000);
}

function atOffsetMs(offsetMs: number): Date {
  return new Date(CREATED_AT.getTime() + offsetMs);
}

function assertSuccess<T>(result: { success: boolean; data?: T; error?: Error }): T {
  expect(result.success).toBe(true);

  if (!result.success) {
    throw result.error;
  }

  return result.data!;
}

function createRound() {
  return assertSuccess(
    Round.new({
      id: ROUND_ID,
      crashPoint: CRASH_POINT,
      serverSeedHash: SERVER_SEED_HASH,
      serverSeed: SERVER_SEED,
      createdAt: CREATED_AT,
      bettingWindowInSeconds: BETTING_WINDOW_IN_SECONDS,
    }),
  );
}

describe("Round", () => {
  it("creates a betting-open round and records the creation event", () => {
    const round = createRound();
    const bettingClosesAt = atOffsetSeconds(BETTING_CLOSE_OFFSET_SECONDS);

    expect(round.status).toBe(RoundStatus.BETTING_OPEN);
    expect(round.isBettingOpen).toBe(true);
    expect(round.bettingClosesAt).toEqual(bettingClosesAt);
    expect(round.canAcceptBets(CREATED_AT)).toBe(true);
    expect(round.canAcceptBets(bettingClosesAt)).toBe(true);
    expect(round.canAcceptBets(atOffsetMs(AFTER_BETTING_CLOSE_OFFSET_MS))).toBe(
      false,
    );

    const events = round.pullDomainEvents();

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "round.created",
      roundId: ROUND_ID,
      crashPoint: CRASH_POINT,
      serverSeedHash: SERVER_SEED_HASH,
      bettingClosesAt,
    });
    expect(events[0]?.occurredAt).toEqual(CREATED_AT);
    expect(round.pullDomainEvents()).toHaveLength(0);
  });

  it("rejects creation when the betting window is not positive", () => {
    const result = Round.new({
      id: ROUND_ID,
      crashPoint: CRASH_POINT,
      serverSeedHash: SERVER_SEED_HASH,
      serverSeed: SERVER_SEED,
      createdAt: CREATED_AT,
      bettingWindowInSeconds: 0,
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error("expected failure");
    }

    expect(result.error.name).toBe(
      "BETTING_WINDOW_MUST_BE_GREATER_THAN_ZERO",
    );
  });

  it("rehydrates a crashed round when persisted invariants are valid", () => {
    const result = Round.rehydrate({
      id: REHYDRATED_ROUND_ID,
      status: RoundStatus.CRASHED,
      crashPoint: REHYDRATED_CRASH_POINT,
      serverSeedHash: SERVER_SEED_HASH,
      serverSeed: SERVER_SEED,
      startedAt: atOffsetSeconds(START_OFFSET_SECONDS),
      bettingClosesAt: atOffsetSeconds(BETTING_CLOSE_OFFSET_SECONDS),
      crashedAt: atOffsetSeconds(CRASH_OFFSET_SECONDS),
      crashMultiplier: REHYDRATED_CRASH_POINT,
      failedAt: null,
      errorReason: null,
      refundRequired: false,
      createdAt: CREATED_AT,
    });

    const round = assertSuccess(result);

    expect(round.status).toBe(RoundStatus.CRASHED);
    expect(round.crashMultiplier).toBe(REHYDRATED_CRASH_POINT);
    expect(round.pullDomainEvents()).toHaveLength(0);
  });

  it("transitions through close betting, start, crash, and settle with events", () => {
    const round = createRound();
    const closedAt = atOffsetSeconds(BETTING_CLOSE_OFFSET_SECONDS);
    const startedAt = atOffsetSeconds(START_OFFSET_SECONDS);
    const crashedAt = atOffsetSeconds(CRASH_OFFSET_SECONDS);

    round.pullDomainEvents();

    expect(round.closeBetting(closedAt).success).toBe(true);
    expect(round.status).toBe(RoundStatus.BETTING_CLOSED);
    expect(round.canAcceptBets(closedAt)).toBe(false);

    expect(round.start(startedAt).success).toBe(true);
    expect(round.status).toBe(RoundStatus.IN_PROGRESS);
    expect(round.startedAt).toEqual(startedAt);

    expect(round.crash(crashedAt).success).toBe(true);
    expect(round.status).toBe(RoundStatus.CRASHED);
    expect(round.crashedAt).toEqual(crashedAt);
    expect(round.crashMultiplier).toBe(CRASH_POINT);

    expect(round.settle().success).toBe(true);
    expect(round.status).toBe(RoundStatus.SETTLED);

    expect(round.pullDomainEvents().map((event) => event.type)).toEqual([
      "round.betting-closed",
      "round.started",
      "round.crashed",
      "round.settled",
    ]);
  });

  it("rejects invalid lifecycle transitions", () => {
    const round = createRound();

    const startWhileOpen = round.start(
      atOffsetSeconds(EARLY_START_ATTEMPT_OFFSET_SECONDS),
    );
    expect(startWhileOpen.success).toBe(false);
    if (startWhileOpen.success) {
      throw new Error("expected failure");
    }
    expect(startWhileOpen.error.name).toBe(
      "ROUND_CAN_ONLY_START_FROM_BETTING_CLOSED",
    );

    expect(round.closeBetting(atOffsetSeconds(BETTING_CLOSE_OFFSET_SECONDS)).success).toBe(
      true,
    );
    const closeTwice = round.closeBetting(
      atOffsetSeconds(START_OFFSET_SECONDS),
    );
    expect(closeTwice.success).toBe(false);
    if (closeTwice.success) {
      throw new Error("expected failure");
    }
    expect(closeTwice.error.name).toBe(
      "ROUND_CAN_ONLY_CLOSE_BETTING_FROM_BETTING_OPEN",
    );

    expect(round.start(atOffsetSeconds(SECOND_START_OFFSET_SECONDS)).success).toBe(
      true,
    );
    const settleBeforeCrash = round.settle();
    expect(settleBeforeCrash.success).toBe(false);
    if (settleBeforeCrash.success) {
      throw new Error("expected failure");
    }
    expect(settleBeforeCrash.error.name).toBe(
      "ROUND_CAN_ONLY_SETTLE_FROM_CRASHED_STATUS",
    );
  });

  it("rejects temporal violations in lifecycle operations", () => {
    const round = createRound();

    const closeBeforeCreation = round.closeBetting(
      atOffsetMs(PRE_CREATION_OFFSET_MS),
    );
    expect(closeBeforeCreation.success).toBe(false);
    if (closeBeforeCreation.success) {
      throw new Error("expected failure");
    }
    expect(closeBeforeCreation.error.name).toBe(
      "BETTING_CANNOT_CLOSE_BEFORE_ROUND_CREATION",
    );

    expect(round.closeBetting(atOffsetSeconds(BETTING_CLOSE_OFFSET_SECONDS)).success).toBe(
      true,
    );

    const startBeforeCreation = round.start(atOffsetMs(PRE_CREATION_OFFSET_MS));
    expect(startBeforeCreation.success).toBe(false);
    if (startBeforeCreation.success) {
      throw new Error("expected failure");
    }
    expect(startBeforeCreation.error.name).toBe(
      "ROUND_CANNOT_START_BEFORE_CREATION",
    );

    expect(round.start(atOffsetSeconds(START_OFFSET_SECONDS)).success).toBe(
      true,
    );

    const crashBeforeStart = round.crash(atOffsetMs(BEFORE_START_OFFSET_MS));
    expect(crashBeforeStart.success).toBe(false);
    if (crashBeforeStart.success) {
      throw new Error("expected failure");
    }
    expect(crashBeforeStart.error.name).toBe(
      "ROUND_CANNOT_CRASH_BEFORE_IT_STARTS",
    );
  });

  it("fails a round from a non-terminal state and marks refund as required", () => {
    const round = createRound();
    const failedAt = atOffsetSeconds(FAILURE_OFFSET_SECONDS);

    round.pullDomainEvents();

    const result = round.fail(ERROR_REASON, failedAt);

    expect(result.success).toBe(true);
    expect(round.status).toBe(RoundStatus.ERROR);
    expect(round.failedAt).toEqual(failedAt);
    expect(round.errorReason).toBe(ERROR_REASON);
    expect(round.refundRequired).toBe(true);
    expect(round.pullDomainEvents()).toEqual([
      {
        type: "round.failed",
        roundId: ROUND_ID,
        occurredAt: failedAt,
        errorReason: ERROR_REASON,
        refundRequired: true,
      },
    ]);
  });

  it("rejects invalid failure attempts", () => {
    const round = createRound();

    const blankReason = round.fail("   ", atOffsetSeconds(EARLY_START_ATTEMPT_OFFSET_SECONDS));
    expect(blankReason.success).toBe(false);
    if (blankReason.success) {
      throw new Error("expected failure");
    }
    expect(blankReason.error.name).toBe("ERROR_REASON_IS_REQUIRED");

    expect(round.closeBetting(atOffsetSeconds(BETTING_CLOSE_OFFSET_SECONDS)).success).toBe(
      true,
    );
    expect(round.start(atOffsetSeconds(START_OFFSET_SECONDS)).success).toBe(
      true,
    );
    expect(round.crash(atOffsetSeconds(CRASH_OFFSET_SECONDS)).success).toBe(
      true,
    );
    expect(round.settle().success).toBe(true);

    const failAfterSettle = round.fail(
      POST_SETTLEMENT_ERROR_REASON,
      atOffsetSeconds(FAIL_AFTER_SETTLEMENT_OFFSET_SECONDS),
    );
    expect(failAfterSettle.success).toBe(false);
    if (failAfterSettle.success) {
      throw new Error("expected failure");
    }
    expect(failAfterSettle.error.name).toBe(
      "ROUND_CAN_ONLY_FAIL_FROM_A_NON_TERMINAL_STATUS",
    );
  });
});
