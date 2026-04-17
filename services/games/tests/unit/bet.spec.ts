import { describe, expect, it } from "bun:test";

import { Bet, BetStatus } from "../../src/domain/bet/bet";
import { BetAmount } from "../../src/domain/bet/bet-amount";
import { PayoutAmount } from "../../src/domain/bet/payout-amount";

const BET_ID = "bet-1";
const REHYDRATED_BET_ID = "bet-2";
const ROUND_ID = "round-1";
const PLAYER_ID = "player-1";
const REJECTION_REASON = "betting window closed";
const CREATED_AT = new Date("2026-04-15T12:00:00.000Z");
const BET_AMOUNT_IN_CENTS = 1_500;
const CASHOUT_MULTIPLIER = 2;
const CASHOUT_PAYOUT_AMOUNT_IN_CENTS =
  BET_AMOUNT_IN_CENTS * CASHOUT_MULTIPLIER;
const ACCEPT_OFFSET_SECONDS = 1;
const REJECT_OFFSET_SECONDS = 2;
const CASHOUT_OFFSET_SECONDS = 3;
const LOSS_OFFSET_SECONDS = 4;
const SETTLE_OFFSET_SECONDS = 5;
const PRE_CREATION_OFFSET_MS = -1;
const BEFORE_ACCEPT_OFFSET_MS = ACCEPT_OFFSET_SECONDS * 1000 - 1;

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

function createBetAmount(amountInCents: number = BET_AMOUNT_IN_CENTS) {
  return assertSuccess(
    BetAmount.create({
      amountInCents,
      currency: "BRL",
    }),
  );
}

function createPayoutAmount(amountInCents: number) {
  return assertSuccess(
    PayoutAmount.create({
      amountInCents,
      currency: "BRL",
    }),
  );
}

function createBet() {
  return assertSuccess(
    Bet.new({
      id: BET_ID,
      roundId: ROUND_ID,
      playerId: PLAYER_ID,
      amount: createBetAmount(),
      createdAt: CREATED_AT,
    }),
  );
}

describe("Bet", () => {
  it("creates a pending bet and records the creation event", () => {
    const bet = createBet();

    expect(bet.status).toBe(BetStatus.PENDING);
    expect(bet.isPending).toBe(true);
    expect(bet.isTerminal).toBe(false);
    expect(bet.amountInCents).toBe(BET_AMOUNT_IN_CENTS);
    expect(bet.currency).toBe("BRL");
    expect(bet.placedAt).toEqual(CREATED_AT);

    const events = bet.pullDomainEvents();

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "bet.created",
      betId: BET_ID,
      roundId: ROUND_ID,
      playerId: PLAYER_ID,
      amountInCents: BET_AMOUNT_IN_CENTS,
      currency: "BRL",
    });
    expect(events[0]?.occurredAt).toEqual(CREATED_AT);
    expect(bet.pullDomainEvents()).toHaveLength(0);
  });

  it("rehydrates a settled cashed-out bet when persisted invariants are valid", () => {
    const acceptedAt = atOffsetSeconds(ACCEPT_OFFSET_SECONDS);
    const cashedOutAt = atOffsetSeconds(CASHOUT_OFFSET_SECONDS);
    const settledAt = atOffsetSeconds(SETTLE_OFFSET_SECONDS);
    const result = Bet.rehydrate({
      id: REHYDRATED_BET_ID,
      roundId: ROUND_ID,
      playerId: PLAYER_ID,
      amount: createBetAmount(),
      status: BetStatus.SETTLED,
      placedAt: CREATED_AT,
      acceptedAt,
      rejectedAt: null,
      rejectionReason: null,
      cashedOutAt,
      cashoutMultiplier: CASHOUT_MULTIPLIER,
      payoutAmount: createPayoutAmount(CASHOUT_PAYOUT_AMOUNT_IN_CENTS),
      lostAt: null,
      settledAt,
      createdAt: CREATED_AT,
    });

    const bet = assertSuccess(result);

    expect(bet.status).toBe(BetStatus.SETTLED);
    expect(bet.acceptedAt).toEqual(acceptedAt);
    expect(bet.cashedOutAt).toEqual(cashedOutAt);
    expect(bet.payoutAmountInCents).toBe(CASHOUT_PAYOUT_AMOUNT_IN_CENTS);
    expect(bet.isTerminal).toBe(true);
    expect(bet.pullDomainEvents()).toHaveLength(0);
  });

  it("transitions through accept, cash out, and settle with events", () => {
    const bet = createBet();
    const acceptedAt = atOffsetSeconds(ACCEPT_OFFSET_SECONDS);
    const cashedOutAt = atOffsetSeconds(CASHOUT_OFFSET_SECONDS);
    const settledAt = atOffsetSeconds(SETTLE_OFFSET_SECONDS);

    bet.pullDomainEvents();

    expect(bet.accept(acceptedAt).success).toBe(true);
    expect(bet.status).toBe(BetStatus.ACCEPTED);
    expect(bet.acceptedAt).toEqual(acceptedAt);

    expect(
      bet.cashOut({
        multiplier: CASHOUT_MULTIPLIER,
        cashedOutAt,
      }).success,
    ).toBe(true);
    expect(bet.status).toBe(BetStatus.CASHED_OUT);
    expect(bet.cashedOutAt).toEqual(cashedOutAt);
    expect(bet.cashoutMultiplier).toBe(CASHOUT_MULTIPLIER);
    expect(bet.payoutAmountInCents).toBe(CASHOUT_PAYOUT_AMOUNT_IN_CENTS);

    expect(bet.settle(settledAt).success).toBe(true);
    expect(bet.status).toBe(BetStatus.SETTLED);
    expect(bet.settledAt).toEqual(settledAt);
    expect(bet.isTerminal).toBe(true);

    expect(bet.pullDomainEvents().map((event) => event.type)).toEqual([
      "bet.accepted",
      "bet.cashed-out",
      "bet.settled",
    ]);
  });

  it("rejects a pending bet and records the rejection event", () => {
    const bet = createBet();
    const rejectedAt = atOffsetSeconds(REJECT_OFFSET_SECONDS);

    bet.pullDomainEvents();

    expect(bet.reject(REJECTION_REASON, rejectedAt).success).toBe(true);
    expect(bet.status).toBe(BetStatus.REJECTED);
    expect(bet.rejectedAt).toEqual(rejectedAt);
    expect(bet.rejectionReason).toBe(REJECTION_REASON);
    expect(bet.isRejected).toBe(true);
    expect(bet.isTerminal).toBe(true);
    expect(bet.pullDomainEvents()).toEqual([
      {
        type: "bet.rejected",
        betId: BET_ID,
        roundId: ROUND_ID,
        playerId: PLAYER_ID,
        occurredAt: rejectedAt,
        rejectionReason: REJECTION_REASON,
      },
    ]);
  });

  it("transitions through accept, lose, and settle with events", () => {
    const bet = createBet();
    const acceptedAt = atOffsetSeconds(ACCEPT_OFFSET_SECONDS);
    const lostAt = atOffsetSeconds(LOSS_OFFSET_SECONDS);
    const settledAt = atOffsetSeconds(SETTLE_OFFSET_SECONDS);

    bet.pullDomainEvents();

    expect(bet.accept(acceptedAt).success).toBe(true);
    expect(bet.lose(lostAt).success).toBe(true);
    expect(bet.settle(settledAt).success).toBe(true);

    expect(bet.status).toBe(BetStatus.SETTLED);
    expect(bet.lostAt).toEqual(lostAt);
    expect(bet.settledAt).toEqual(settledAt);
    expect(bet.pullDomainEvents().map((event) => event.type)).toEqual([
      "bet.accepted",
      "bet.lost",
      "bet.settled",
    ]);
  });

  it("rejects invalid lifecycle transitions", () => {
    const bet = createBet();

    const cashOutWhilePending = bet.cashOut({
      multiplier: CASHOUT_MULTIPLIER,
      cashedOutAt: atOffsetSeconds(CASHOUT_OFFSET_SECONDS),
    });
    expect(cashOutWhilePending.success).toBe(false);
    if (cashOutWhilePending.success) {
      throw new Error("expected failure");
    }
    expect(cashOutWhilePending.error.name).toBe(
      "BET_CAN_ONLY_CASH_OUT_FROM_ACCEPTED_STATUS",
    );

    expect(bet.accept(atOffsetSeconds(ACCEPT_OFFSET_SECONDS)).success).toBe(true);

    const acceptTwice = bet.accept(atOffsetSeconds(REJECT_OFFSET_SECONDS));
    expect(acceptTwice.success).toBe(false);
    if (acceptTwice.success) {
      throw new Error("expected failure");
    }
    expect(acceptTwice.error.name).toBe(
      "BET_CAN_ONLY_BE_ACCEPTED_FROM_PENDING_STATUS",
    );

    expect(bet.lose(atOffsetSeconds(LOSS_OFFSET_SECONDS)).success).toBe(true);

    const settleTwice = bet.settle(atOffsetSeconds(SETTLE_OFFSET_SECONDS));
    expect(settleTwice.success).toBe(true);

    const rejectAfterSettlement = bet.reject(
      REJECTION_REASON,
      atOffsetSeconds(SETTLE_OFFSET_SECONDS + 1),
    );
    expect(rejectAfterSettlement.success).toBe(false);
    if (rejectAfterSettlement.success) {
      throw new Error("expected failure");
    }
    expect(rejectAfterSettlement.error.name).toBe(
      "BET_CAN_ONLY_BE_REJECTED_FROM_PENDING_STATUS",
    );
  });

  it("rejects temporal violations in lifecycle operations", () => {
    const bet = createBet();

    const acceptBeforeCreation = bet.accept(atOffsetMs(PRE_CREATION_OFFSET_MS));
    expect(acceptBeforeCreation.success).toBe(false);
    if (acceptBeforeCreation.success) {
      throw new Error("expected failure");
    }
    expect(acceptBeforeCreation.error.name).toBe(
      "BET_CANNOT_BE_ACCEPTED_BEFORE_CREATION",
    );

    expect(bet.accept(atOffsetSeconds(ACCEPT_OFFSET_SECONDS)).success).toBe(true);

    const loseBeforeAccepted = bet.lose(atOffsetMs(BEFORE_ACCEPT_OFFSET_MS));
    expect(loseBeforeAccepted.success).toBe(false);
    if (loseBeforeAccepted.success) {
      throw new Error("expected failure");
    }
    expect(loseBeforeAccepted.error.name).toBe(
      "BET_CANNOT_LOSE_BEFORE_IT_IS_ACCEPTED",
    );

    const settleBeforeResolved = bet.settle(atOffsetSeconds(CASHOUT_OFFSET_SECONDS));
    expect(settleBeforeResolved.success).toBe(false);
    if (settleBeforeResolved.success) {
      throw new Error("expected failure");
    }
    expect(settleBeforeResolved.error.name).toBe(
      "BET_CAN_ONLY_SETTLE_FROM_RESOLVED_STATUS",
    );
  });
});
