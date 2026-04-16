/// <reference types="bun-types" />

import { describe, expect, it } from "bun:test";

import { WalletBalance } from "../../src/domain/wallet/wallet-balance";
import { Wallet } from "../../src/domain/wallet/wallet";
import {
  WalletCreatedDomainEvent,
  WalletCreditedDomainEvent,
  WalletDebitedDomainEvent,
} from "../../src/domain/wallet/wallet.events";

const WALLET_ID = "wallet-1";
const REHYDRATED_WALLET_ID = "wallet-2";
const PLAYER_ID = "player-1";
const CURRENCY = "BRL";
const CREATED_AT = new Date("2026-04-15T12:00:00.000Z");
const CREDIT_OPERATION_ID = "credit-1";
const DEBIT_OPERATION_ID = "debit-1";
const REHYDRATED_CREDIT_OPERATION_ID = "rehydrated-credit-1";
const REHYDRATED_DEBIT_OPERATION_ID = "rehydrated-debit-1";
const CREDIT_AMOUNT_IN_CENTS = 5_000n;
const DEBIT_AMOUNT_IN_CENTS = 1_250n;
const REHYDRATED_CREDIT_AMOUNT_IN_CENTS = 7_500n;
const REHYDRATED_DEBIT_AMOUNT_IN_CENTS = 2_000n;
const REHYDRATED_BALANCE_IN_CENTS =
  REHYDRATED_CREDIT_AMOUNT_IN_CENTS - REHYDRATED_DEBIT_AMOUNT_IN_CENTS;
const BALANCE_AFTER_CREDIT_IN_CENTS = CREDIT_AMOUNT_IN_CENTS;
const BALANCE_AFTER_DEBIT_IN_CENTS =
  BALANCE_AFTER_CREDIT_IN_CENTS - DEBIT_AMOUNT_IN_CENTS;
const ZERO_AMOUNT_IN_CENTS = 0n;
const NEGATIVE_AMOUNT_IN_CENTS = -1n;
const CREDIT_OFFSET_SECONDS = 1;
const DEBIT_OFFSET_SECONDS = 2;
const REHYDRATED_CREDIT_OFFSET_SECONDS = 3;
const REHYDRATED_DEBIT_OFFSET_SECONDS = 4;
const PRE_CREATION_OFFSET_MS = -1;
const FIRST_LEDGER_SEQUENCE = 1n;
const SECOND_LEDGER_SEQUENCE = FIRST_LEDGER_SEQUENCE + 1n;
const DUPLICATE_LEDGER_SEQUENCE = FIRST_LEDGER_SEQUENCE;
const INVALID_LEDGER_SEQUENCE = 0n;

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

function createAmount(amountInCents: bigint = CREDIT_AMOUNT_IN_CENTS) {
  return assertSuccess(
    WalletBalance.create({
      amountInCents,
      currency: CURRENCY,
    }),
  );
}

function createWallet() {
  return assertSuccess(
    Wallet.new({
      id: WALLET_ID,
      playerId: PLAYER_ID,
      createdAt: CREATED_AT,
    }),
  );
}

describe("WalletBalance", () => {
  it("rejects negative amounts", () => {
    const result = WalletBalance.create({
      amountInCents: NEGATIVE_AMOUNT_IN_CENTS,
      currency: CURRENCY,
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error("expected failure");
    }

    expect(result.error.name).toBe("AMOUNT_IN_CENTS_CANNOT_BE_NEGATIVE");
  });

  it("rejects unsupported currencies", () => {
    const result = WalletBalance.create({
      amountInCents: CREDIT_AMOUNT_IN_CENTS,
      currency: "USD" as "BRL",
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error("expected failure");
    }

    expect(result.error.name).toBe("UNSUPPORTED_CURRENCY");
  });
});

describe("Wallet", () => {
  it("creates a wallet with zero balance and records the creation event", () => {
    const wallet = createWallet();

    expect(wallet.id).toBe(WALLET_ID);
    expect(wallet.playerId).toBe(PLAYER_ID);
    expect(wallet.balanceInCents).toBe(ZERO_AMOUNT_IN_CENTS);
    expect(wallet.currency).toBe(CURRENCY);
    expect(wallet.createdAt).toEqual(CREATED_AT);
    expect(wallet.updatedAt).toEqual(CREATED_AT);

    const events = wallet.pullDomainEvents();

    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(WalletCreatedDomainEvent);
    expect(events[0]?.serialize()).toEqual({
      walletId: WALLET_ID,
      playerId: PLAYER_ID,
      operationId: null,
      amountInCents: ZERO_AMOUNT_IN_CENTS.toString(),
      currency: CURRENCY,
      balanceAfterInCents: ZERO_AMOUNT_IN_CENTS.toString(),
    });
    expect(events[0]?.idempotencyKey).toBe(WALLET_ID);
    expect(events[0]?.occurredAt).toEqual(CREATED_AT);
    expect(wallet.pullDomainEvents()).toHaveLength(0);
    expect(wallet.pullNewOperations()).toHaveLength(0);
  });

  it("rehydrates a wallet from persisted credit and debit operations", () => {
    const rehydratedCreditAt = atOffsetSeconds(REHYDRATED_CREDIT_OFFSET_SECONDS);
    const rehydratedDebitAt = atOffsetSeconds(REHYDRATED_DEBIT_OFFSET_SECONDS);
    const result = Wallet.rehydrate({
      id: REHYDRATED_WALLET_ID,
      playerId: PLAYER_ID,
      createdAt: CREATED_AT,
      operations: [
        {
          id: REHYDRATED_DEBIT_OPERATION_ID,
          amount: createAmount(REHYDRATED_DEBIT_AMOUNT_IN_CENTS),
          occurredAt: rehydratedDebitAt,
          type: "debit",
          operationType: "BET_STAKE_LOCK",
          ledgerSequence: SECOND_LEDGER_SEQUENCE,
        },
        {
          id: REHYDRATED_CREDIT_OPERATION_ID,
          amount: createAmount(REHYDRATED_CREDIT_AMOUNT_IN_CENTS),
          occurredAt: rehydratedCreditAt,
          operationType: "BET_PAYOUT",
          type: "credit",
          ledgerSequence: FIRST_LEDGER_SEQUENCE,
        },
      ],
    });

    const wallet = assertSuccess(result);

    expect(wallet.id).toBe(REHYDRATED_WALLET_ID);
    expect(wallet.balanceInCents).toBe(REHYDRATED_BALANCE_IN_CENTS);
    expect(wallet.updatedAt).toEqual(rehydratedDebitAt);
    expect(wallet.pullDomainEvents()).toHaveLength(0);
    expect(wallet.pullNewOperations()).toHaveLength(0);
  });

  it("credits and debits the wallet while recording events and new operations", () => {
    const wallet = createWallet();
    const creditedAt = atOffsetSeconds(CREDIT_OFFSET_SECONDS);
    const debitedAt = atOffsetSeconds(DEBIT_OFFSET_SECONDS);

    wallet.pullDomainEvents();

    expect(
      wallet.credit({
        operationId: CREDIT_OPERATION_ID,
        amount: createAmount(CREDIT_AMOUNT_IN_CENTS),
        operationType: "ACCOUNT_FUNDING",
        occurredAt: creditedAt,
      }).success,
    ).toBe(true);
    expect(wallet.balanceInCents).toBe(BALANCE_AFTER_CREDIT_IN_CENTS);
    expect(wallet.updatedAt).toEqual(creditedAt);

    expect(
      wallet.debit({
        operationId: DEBIT_OPERATION_ID,
        amount: createAmount(DEBIT_AMOUNT_IN_CENTS),
        operationType: "BET_STAKE_LOCK",
        occurredAt: debitedAt,
      }).success,
    ).toBe(true);
    expect(wallet.balanceInCents).toBe(BALANCE_AFTER_DEBIT_IN_CENTS);
    expect(wallet.updatedAt).toEqual(debitedAt);

    const domainEvents = wallet.pullDomainEvents();
    expect(domainEvents).toHaveLength(2);
    expect(domainEvents[0]).toBeInstanceOf(WalletCreditedDomainEvent);
    expect(domainEvents[1]).toBeInstanceOf(WalletDebitedDomainEvent);
    expect(domainEvents[0]?.serialize()).toEqual({
      walletId: WALLET_ID,
      playerId: PLAYER_ID,
      operationId: CREDIT_OPERATION_ID,
      amountInCents: CREDIT_AMOUNT_IN_CENTS.toString(),
      currency: CURRENCY,
      balanceAfterInCents: BALANCE_AFTER_CREDIT_IN_CENTS.toString(),
    });
    expect(domainEvents[0]?.occurredAt).toEqual(creditedAt);
    expect(domainEvents[0]?.idempotencyKey).toBe(CREDIT_OPERATION_ID);
    expect(domainEvents[1]?.serialize()).toEqual({
      walletId: WALLET_ID,
      playerId: PLAYER_ID,
      operationId: DEBIT_OPERATION_ID,
      amountInCents: DEBIT_AMOUNT_IN_CENTS.toString(),
      currency: CURRENCY,
      balanceAfterInCents: BALANCE_AFTER_DEBIT_IN_CENTS.toString(),
    });
    expect(domainEvents[1]?.occurredAt).toEqual(debitedAt);
    expect(domainEvents[1]?.idempotencyKey).toBe(DEBIT_OPERATION_ID);

    expect(wallet.pullNewOperations()).toEqual([
      {
        id: CREDIT_OPERATION_ID,
        amount: createAmount(CREDIT_AMOUNT_IN_CENTS),
        occurredAt: creditedAt,
        operationType: "ACCOUNT_FUNDING",
        type: "credit",
      },
      {
        id: DEBIT_OPERATION_ID,
        amount: createAmount(DEBIT_AMOUNT_IN_CENTS),
        occurredAt: debitedAt,
        operationType: "BET_STAKE_LOCK",
        type: "debit",
      },
    ]);
    expect(wallet.pullNewOperations()).toHaveLength(0);
  });

  it("rejects invalid wallet mutations", () => {
    const wallet = createWallet();

    const blankOperationIdCredit = wallet.credit({
      operationId: "   ",
      amount: createAmount(CREDIT_AMOUNT_IN_CENTS),
      operationType: "ACCOUNT_FUNDING",
      occurredAt: atOffsetSeconds(CREDIT_OFFSET_SECONDS),
    });
    expect(blankOperationIdCredit.success).toBe(false);
    if (blankOperationIdCredit.success) {
      throw new Error("expected failure");
    }
    expect(blankOperationIdCredit.error.name).toBe(
      "WALLET_OPERATION_ID_IS_REQUIRED",
    );

    const zeroAmountCredit = wallet.credit({
      operationId: CREDIT_OPERATION_ID,
      amount: createAmount(ZERO_AMOUNT_IN_CENTS),
      operationType: "ACCOUNT_FUNDING",
      occurredAt: atOffsetSeconds(CREDIT_OFFSET_SECONDS),
    });
    expect(zeroAmountCredit.success).toBe(false);
    if (zeroAmountCredit.success) {
      throw new Error("expected failure");
    }
    expect(zeroAmountCredit.error.name).toBe(
      "AMOUNT_IN_CENTS_MUST_BE_GREATER_THAN_ZERO",
    );

    const debitBeforeCreation = wallet.debit({
      operationId: DEBIT_OPERATION_ID,
      amount: createAmount(DEBIT_AMOUNT_IN_CENTS),
      operationType: "BET_STAKE_LOCK",
      occurredAt: atOffsetMs(PRE_CREATION_OFFSET_MS),
    });
    expect(debitBeforeCreation.success).toBe(false);
    if (debitBeforeCreation.success) {
      throw new Error("expected failure");
    }
    expect(debitBeforeCreation.error.name).toBe(
      "WALLET_OPERATION_CANNOT_HAPPEN_BEFORE_CREATION",
    );

    const debitWithoutBalance = wallet.debit({
      operationId: DEBIT_OPERATION_ID,
      amount: createAmount(DEBIT_AMOUNT_IN_CENTS),
      operationType: "BET_STAKE_LOCK",
      occurredAt: atOffsetSeconds(DEBIT_OFFSET_SECONDS),
    });
    expect(debitWithoutBalance.success).toBe(false);
    if (debitWithoutBalance.success) {
      throw new Error("expected failure");
    }
    expect(debitWithoutBalance.error.name).toBe(
      "INSUFFICIENT_WALLET_BALANCE",
    );
  });

  it("rejects rehydration when a ledger sequence is duplicated", () => {
    const result = Wallet.rehydrate({
      id: REHYDRATED_WALLET_ID,
      playerId: PLAYER_ID,
      createdAt: CREATED_AT,
      operations: [
        {
          id: REHYDRATED_CREDIT_OPERATION_ID,
          amount: createAmount(REHYDRATED_CREDIT_AMOUNT_IN_CENTS),
          occurredAt: atOffsetSeconds(REHYDRATED_CREDIT_OFFSET_SECONDS),
          operationType: "BET_PAYOUT",
          type: "credit",
          ledgerSequence: DUPLICATE_LEDGER_SEQUENCE,
        },
        {
          id: REHYDRATED_DEBIT_OPERATION_ID,
          amount: createAmount(REHYDRATED_DEBIT_AMOUNT_IN_CENTS),
          occurredAt: atOffsetSeconds(REHYDRATED_DEBIT_OFFSET_SECONDS),
          operationType: "BET_STAKE_LOCK",
          type: "debit",
          ledgerSequence: DUPLICATE_LEDGER_SEQUENCE,
        },
      ],
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error("expected failure");
    }

    expect(result.error.name).toBe(
      "WALLET_OPERATION_LEDGER_SEQUENCE_MUST_BE_UNIQUE",
    );
  });

  it("rejects rehydration when a ledger sequence is not greater than zero", () => {
    const result = Wallet.rehydrate({
      id: REHYDRATED_WALLET_ID,
      playerId: PLAYER_ID,
      createdAt: CREATED_AT,
      operations: [
        {
          id: REHYDRATED_CREDIT_OPERATION_ID,
          amount: createAmount(REHYDRATED_CREDIT_AMOUNT_IN_CENTS),
          occurredAt: atOffsetSeconds(REHYDRATED_CREDIT_OFFSET_SECONDS),
          operationType: "BET_PAYOUT",
          type: "credit",
          ledgerSequence: INVALID_LEDGER_SEQUENCE,
        },
      ],
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error("expected failure");
    }

    expect(result.error.name).toBe(
      "WALLET_OPERATION_LEDGER_SEQUENCE_MUST_BE_GREATER_THAN_ZERO",
    );
  });
});
