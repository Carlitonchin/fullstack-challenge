import type { CreateWalletOutboxMessageProps, WalletOutboxMessageRecord } from "@wallets/infrastructure/schema/wallet-outbox-message";

export const WALLET_OUTBOX_REPOSITORY = Symbol("WALLET_OUTBOX_REPOSITORY");

export interface IWalletOutboxRepository {
  insert(message: CreateWalletOutboxMessageProps): Promise<WalletOutboxMessageRecord>;
}
