import type { WalletCurrency } from "./wallet-balance";

type WalletEventBase<TType extends string> = {
  type: TType;
  walletId: string;
  playerId: string;
  occurredAt: Date;
  operationId?: string;
  correlationId?: string;
  causationId?: string;
};

export type WalletCreatedDomainEvent = WalletEventBase<"wallet.created"> & {
  amountInCents: bigint;
  currency: WalletCurrency;
  balanceAfterInCents: bigint;
};

export type WalletCreditedDomainEvent = WalletEventBase<"wallet.credited"> & {
  amountInCents: bigint;
  currency: WalletCurrency;
  balanceAfterInCents: bigint;
};

export type WalletDebitedDomainEvent = WalletEventBase<"wallet.debited"> & {
  amountInCents: bigint;
  currency: WalletCurrency;
  balanceAfterInCents: bigint;
};

export type WalletDomainEvent =
  | WalletCreatedDomainEvent
  | WalletCreditedDomainEvent
  | WalletDebitedDomainEvent;
