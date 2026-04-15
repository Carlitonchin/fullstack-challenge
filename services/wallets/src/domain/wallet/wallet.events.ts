import type { WalletCurrency } from "./wallet-balance";

type WalletEventBase<TType extends string> = {
  type: TType;
  walletId: string;
  playerId: string;
  occurredAt: Date;
};

export type WalletCreatedDomainEvent = WalletEventBase<"wallet.created"> & {
  amountInCents: number;
  currency: WalletCurrency;
  balanceAfterInCents: number;
};

export type WalletCreditedDomainEvent = WalletEventBase<"wallet.credited"> & {
  amountInCents: number;
  currency: WalletCurrency;
  balanceAfterInCents: number;
};

export type WalletDebitedDomainEvent = WalletEventBase<"wallet.debited"> & {
  amountInCents: number;
  currency: WalletCurrency;
  balanceAfterInCents: number;
};

export type WalletDomainEvent =
  | WalletCreatedDomainEvent
  | WalletCreditedDomainEvent
  | WalletDebitedDomainEvent;
