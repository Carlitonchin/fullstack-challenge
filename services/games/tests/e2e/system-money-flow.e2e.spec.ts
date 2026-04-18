/// <reference types="bun-types" />

import { describe, expect, it } from "bun:test";
import {
  balanceDelta,
  E2eSystemClient,
  type GameBetView,
  roundHasComfortableBetWindow,
  roundIsAcceptingBets,
} from "./support";

const STAKE_AMOUNT = "1.00";
const LARGE_STAKE_AMOUNT = "2.00";

describe("games backend e2e coverage", () => {
  it(
    "covers cashout, loss, and required validation failures against the docker stack",
    async () => {
      const client = new E2eSystemClient();

      console.log("[e2e] checking stack health");
      await assertStackHealth(client);
      const initialWallet = await client.ensureWallet();
      const initialBalance = BigInt(initialWallet.balanceInCents);
      let expectedBalanceDelta = 0n;

      console.log("[e2e] cashout happy path");
      expectedBalanceDelta += await coverCashoutHappyPath(client);
      console.log("[e2e] loss happy path");
      expectedBalanceDelta += await coverLossHappyPath(client);
      console.log("[e2e] insufficient balance validation");
      expectedBalanceDelta += await coverInsufficientBalanceValidation(client);
      console.log("[e2e] duplicate bet validation");
      expectedBalanceDelta += await coverDuplicateBetValidation(client);
      console.log("[e2e] late bet validation");
      expectedBalanceDelta += await coverLateBetValidation(client);

      const finalWallet = await client.ensureWallet();
      const finalBalance = BigInt(finalWallet.balanceInCents);
      expect(finalBalance).toBeGreaterThanOrEqual(0n);
      expect(finalBalance).toBe(initialBalance + expectedBalanceDelta);
      expect(initialWallet.currency).toBe("BRL");
      console.log("[e2e] completed");
    },
    clientTimeout(),
  );
});

async function coverCashoutHappyPath(client: E2eSystemClient): Promise<bigint> {
  let lastCashoutFailure: string | null = null;

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const balanceBeforeAttempt = BigInt((await client.ensureWallet()).balanceInCents);
    const roundSnapshot = await client.waitForRound(
      roundHasComfortableBetWindow,
      "a round with enough time left to place a cashout bet",
    );
    const roundId = roundSnapshot.round!.id;

    const placedBetResponse = await client.placeBet(LARGE_STAKE_AMOUNT);
    expect(placedBetResponse.status).toBe(202);
    const placedBet = placedBetResponse.body as { id: string; roundId: string };
    expect(placedBet.roundId).toBe(roundId);

    const acceptedBet = await client.waitForBet(
      placedBet.id,
      (bet) => bet.status === "ACCEPTED",
      `bet ${placedBet.id} to be accepted`,
    );
    expect(acceptedBet.acceptedAt).not.toBeNull();

    await client.waitForRound(
      (snapshot) =>
        snapshot.round?.id === roundId && snapshot.round.status === "IN_PROGRESS",
      `round ${roundId} to enter progress`,
    );

    const cashoutResponse = await tryCashoutBeforeRoundEnds(client, roundId);
    if (cashoutResponse.status === 200) {
      const cashout = cashoutResponse.body as {
        multiplier: number;
        payoutAmountInCents: number;
      };
      expect(cashout.multiplier).toBeGreaterThan(1);
      expect(cashout.payoutAmountInCents).toBeGreaterThan(200);

      const settledBet = await client.waitForBet(
        placedBet.id,
        (bet) => bet.status === "SETTLED",
        `cashed out bet ${placedBet.id} to settle`,
      );
      expect(settledBet.cashoutMultiplier).toBeGreaterThan(1);
      expect(settledBet.payoutAmountInCents).toBe(cashout.payoutAmountInCents);

      const balanceAfter = await client.waitForWalletBalance(
        (balanceInCents) =>
          balanceDelta(balanceBeforeAttempt, balanceInCents) >=
          BigInt(cashout.payoutAmountInCents - acceptedBet.amountInCents),
        "wallet payout to be credited after cashout",
      );

      const actualDelta = balanceDelta(balanceBeforeAttempt, balanceAfter);
      expect(actualDelta).toBe(BigInt(cashout.payoutAmountInCents - acceptedBet.amountInCents));
      return actualDelta;
    }

    expect(cashoutResponse.status).toBe(409);
    lastCashoutFailure = readMessage(cashoutResponse.body);

    await client.waitForBet(
      placedBet.id,
      (bet) => bet.status === "LOST" || bet.status === "SETTLED",
      `failed cashout attempt ${placedBet.id} to resolve`,
    );
    await client.waitForRound(
      (snapshot) => snapshot.round?.id !== roundId,
      `a new round after failed cashout attempt ${attempt}`,
    );
  }

  throw new Error(
    `Unable to complete a successful cashout after 5 attempts. Last failure: ${lastCashoutFailure ?? "unknown"}`,
  );
}

async function coverLossHappyPath(client: E2eSystemClient): Promise<bigint> {
  const balanceBefore = BigInt((await client.ensureWallet()).balanceInCents);
  const roundSnapshot = await client.waitForRound(
    roundHasComfortableBetWindow,
    "a round to validate crash loss behavior",
  );
  const roundId = roundSnapshot.round!.id;

  const placedBetResponse = await client.placeBet(STAKE_AMOUNT);
  expect(placedBetResponse.status).toBe(202);
  const placedBet = placedBetResponse.body as { id: string; roundId: string };
  expect(placedBet.roundId).toBe(roundId);

  const acceptedBet = await client.waitForBet(
    placedBet.id,
    (bet) => bet.status === "ACCEPTED",
    `loss bet ${placedBet.id} to be accepted`,
  );
  expect(acceptedBet.amountInCents).toBe(100);

  const lostBet = await client.waitForBet(
    placedBet.id,
    (bet) => bet.status === "LOST" || bet.status === "SETTLED",
    `loss bet ${placedBet.id} to be marked as lost`,
  );
  expect(lostBet.roundCrashMultiplier).toBeGreaterThanOrEqual(1);
  expect(lostBet.payoutAmountInCents).toBeNull();

  await client.waitForRound(
    (snapshot) => snapshot.round?.id !== roundId,
    `the next round after crash loss round ${roundId}`,
  );

  const balanceAfter = await client.waitForWalletBalance(
    (balanceInCents) =>
      balanceDelta(balanceBefore, balanceInCents) ===
      BigInt(-acceptedBet.amountInCents),
    "wallet stake debit without payout after losing bet",
  );

  const actualDelta = balanceDelta(balanceBefore, balanceAfter);
  expect(actualDelta).toBe(-100n);
  return actualDelta;
}

async function coverInsufficientBalanceValidation(
  client: E2eSystemClient,
): Promise<bigint> {
  const walletBefore = await client.ensureWallet();
  const balanceBefore = BigInt(walletBefore.balanceInCents);
  const impossibleAmount = formatCents(balanceBefore + 100n);

  await client.waitForRound(
    roundHasComfortableBetWindow,
    "a round to validate insufficient balance handling",
  );

  const placedBetResponse = await client.placeBet(impossibleAmount);
  expect(placedBetResponse.status).toBe(202);
  const placedBet = placedBetResponse.body as { id: string };

  const rejectedBet = await client.waitForBet(
    placedBet.id,
    (bet) => bet.status === "REJECTED",
    `oversized bet ${placedBet.id} to be rejected`,
  );

  expect(rejectedBet.rejectionReason).toBe("INSUFFICIENT_BALANCE");

  const balanceAfter = BigInt((await client.ensureWallet()).balanceInCents);
  expect(balanceAfter).toBe(balanceBefore);
  return 0n;
}

async function coverDuplicateBetValidation(client: E2eSystemClient): Promise<bigint> {
  const balanceBefore = BigInt((await client.ensureWallet()).balanceInCents);
  const roundSnapshot = await client.waitForRound(
    roundHasComfortableBetWindow,
    "a round to validate duplicate bet protection",
  );
  const roundId = roundSnapshot.round!.id;

  const firstBetResponse = await client.placeBet(STAKE_AMOUNT);
  expect(firstBetResponse.status).toBe(202);
  const firstBet = firstBetResponse.body as { id: string; roundId: string };
  expect(firstBet.roundId).toBe(roundId);

  const duplicateResponse = await client.placeBet(STAKE_AMOUNT);
  expect(duplicateResponse.status).toBe(409);
  expect(readMessage(duplicateResponse.body)).toBe(
    "The player already has a bet for the current round",
  );

  const acceptedBet = await client.waitForBet(
    firstBet.id,
    (bet) => bet.status === "ACCEPTED",
    `first bet ${firstBet.id} to be accepted before cleanup`,
  );
  expect(acceptedBet.amountInCents).toBe(100);

  const resolvedBet = await settleOpenBetBestEffort(client, roundId, firstBet.id);
  const balanceAfter = BigInt((await client.ensureWallet()).balanceInCents);
  const actualDelta = balanceDelta(balanceBefore, balanceAfter);

  if (resolvedBet.status === "SETTLED" && resolvedBet.payoutAmountInCents !== null) {
    expect(actualDelta).toBe(
      BigInt(resolvedBet.payoutAmountInCents - resolvedBet.amountInCents),
    );
    return actualDelta;
  }

  expect(actualDelta).toBe(BigInt(-resolvedBet.amountInCents));
  return actualDelta;
}

async function coverLateBetValidation(client: E2eSystemClient): Promise<bigint> {
  const closedRound = await client.waitForRound(
    (snapshot) =>
      snapshot.round !== null && !roundIsAcceptingBets(snapshot.round),
    "a round outside the betting window",
  );
  expect(closedRound.round).not.toBeNull();

  const lateBetResponse = await client.placeBet(STAKE_AMOUNT);
  expect(lateBetResponse.status).toBe(409);
  expect(readMessage(lateBetResponse.body)).toBe("The betting window is closed");
  return 0n;
}

async function settleOpenBetBestEffort(
  client: E2eSystemClient,
  roundId: string,
  betId: string,
): Promise<GameBetView> {
  const currentBet = await client.getBetById(betId);
  if (!currentBet) {
    throw new Error(`Expected bet ${betId} to exist while cleaning duplicate bet scenario`);
  }

  if (currentBet.status === "SETTLED" || currentBet.status === "REJECTED") {
    return currentBet;
  }

  await client.waitForRound(
    (snapshot) =>
      snapshot.round?.id === roundId && snapshot.round.status === "IN_PROGRESS",
    `duplicate bet round ${roundId} to start`,
    30_000,
  );

  const cashoutResponse = await client.cashout();
  if (cashoutResponse.status === 200) {
    return client.waitForBet(
      currentBet.id,
      (bet) => bet.status === "SETTLED",
      `duplicate cleanup bet ${currentBet.id} to settle after cashout`,
    );
  }

  return client.waitForBet(
    currentBet.id,
    (bet) => bet.status === "LOST" || bet.status === "SETTLED",
    `duplicate cleanup bet ${currentBet.id} to resolve after crash`,
    45_000,
  );
}

async function tryCashoutBeforeRoundEnds(
  client: E2eSystemClient,
  roundId: string,
): Promise<Awaited<ReturnType<E2eSystemClient["cashout"]>>> {
  const deadline = Date.now() + 20_000;
  let lastResponse: Awaited<ReturnType<E2eSystemClient["cashout"]>> | null = null;

  while (Date.now() < deadline) {
    const snapshot = await client.getCurrentSnapshot();
    if (snapshot.round?.id !== roundId || snapshot.round.status !== "IN_PROGRESS") {
      break;
    }

    if (snapshot.round.currentMultiplier > 1) {
      const cashoutResponse = await client.cashout();
      lastResponse = cashoutResponse;

      if (cashoutResponse.status === 200) {
        return cashoutResponse;
      }
    }

    await Bun.sleep(client.pollIntervalMs);
  }

  return (
    lastResponse ?? {
      status: 409,
      body: {
        message: "Cashout is no longer available",
      },
    }
  );
}

async function assertStackHealth(client: E2eSystemClient): Promise<void> {
  const snapshot = await client.getCurrentSnapshot();
  expect(typeof snapshot.serverTime).toBe("string");
  const wallet = await client.ensureWallet();
  expect(wallet.playerId).toBe("00000000-0000-4000-8000-000000000001");
  expect(BigInt(wallet.balanceInCents)).toBeGreaterThanOrEqual(1_500n);
}

function formatCents(amountInCents: bigint): string {
  const integerPart = amountInCents / 100n;
  const fractionPart = (amountInCents % 100n).toString().padStart(2, "0");
  return `${integerPart.toString()}.${fractionPart}`;
}

function readMessage(body: unknown): string {
  if (typeof body === "object" && body !== null && "message" in body) {
    const value = (body as { message?: unknown }).message;
    return typeof value === "string" ? value : JSON.stringify(value);
  }

  return JSON.stringify(body);
}

function clientTimeout(): number {
  const defaultTimeout = 180_000;
  const fromEnv = process.env.E2E_TEST_TIMEOUT_MS?.trim();

  return fromEnv ? Number.parseInt(fromEnv, 10) : defaultTimeout;
}
