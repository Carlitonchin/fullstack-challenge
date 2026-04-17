export const BET_DEBIT_REQUESTED = "bet.debit.requested";
export const BET_DEBIT_SUCCEEDED = "bet.debit.succeeded";
export const BET_DEBIT_FAILED = "bet.debit.failed";
export const CASHOUT_CREDIT_REQUESTED = "cashout.credit.requested";
export const CASHOUT_CREDIT_SUCCEEDED = "cashout.credit.succeeded";
export const CASHOUT_CREDIT_FAILED = "cashout.credit.failed";

export type MoneyCurrency = "BRL";

export type BetDebitRequestedData = {
  playerId: string;
  roundId: string;
  betId: string;
  amountInCents: string;
  currency: MoneyCurrency;
  idempotencyKey: string;
};

export type BetDebitSucceededData = {
  playerId: string;
  roundId: string;
  betId: string;
  operationId: string;
  amountInCents: string;
  currency: MoneyCurrency;
  idempotencyKey: string;
};

export type BetDebitFailedData = {
  playerId: string;
  roundId: string;
  betId: string;
  reason: string;
  idempotencyKey: string;
};

export type CashoutCreditRequestedData = {
  playerId: string;
  roundId: string;
  betId: string;
  payoutAmountInCents: string;
  currency: MoneyCurrency;
  idempotencyKey: string;
};

export type CashoutCreditSucceededData = {
  playerId: string;
  roundId: string;
  betId: string;
  operationId: string;
  payoutAmountInCents: string;
  currency: MoneyCurrency;
  idempotencyKey: string;
};

export type CashoutCreditFailedData = {
  playerId: string;
  roundId: string;
  betId: string;
  reason: string;
  idempotencyKey: string;
};
