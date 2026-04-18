export const BET_DEBIT_REQUESTED = "bet.debit.requested";
export const BET_DEBIT_SUCCEEDED = "bet.debit.succeeded";
export const BET_DEBIT_FAILED = "bet.debit.failed";
export const BET_REFUND_REQUESTED = "bet.refund.requested";
export const BET_REFUND_SUCCEEDED = "bet.refund.succeeded";
export const BET_REFUND_FAILED = "bet.refund.failed";
export const CASHOUT_CREDIT_REQUESTED = "cashout.credit.requested";
export const CASHOUT_CREDIT_SUCCEEDED = "cashout.credit.succeeded";
export const CASHOUT_CREDIT_FAILED = "cashout.credit.failed";
export const WALLET_CREDITED = "wallet.credited";
export const WALLET_DEBITED = "wallet.debited";
export const BET_REJECTED = "bet.rejected";

export type MoneyCurrency = "BRL";

export type WalletBalanceChangedData = {
  walletId: string;
  playerId: string;
  operationId: string | null;
  amountInCents: string;
  currency: MoneyCurrency;
  balanceAfterInCents: string;
};

export type WalletCreditedData = WalletBalanceChangedData;
export type WalletDebitedData = WalletBalanceChangedData;

export type BetRejectedData = {
  betId: string;
  roundId: string;
  playerId: string;
  playerUsername: string;
  rejectionReason: string;
};

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

export type BetRefundRequestedData = {
  playerId: string;
  roundId: string;
  betId: string;
  amountInCents: string;
  currency: MoneyCurrency;
  idempotencyKey: string;
};

export type BetRefundSucceededData = {
  playerId: string;
  roundId: string;
  betId: string;
  operationId: string;
  amountInCents: string;
  currency: MoneyCurrency;
  idempotencyKey: string;
};

export type BetRefundFailedData = {
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
