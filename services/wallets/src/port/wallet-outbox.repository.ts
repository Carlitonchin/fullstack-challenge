import type { CreateWalletOutboxMessageProps, WalletOutboxMessageRecord } from "@wallets/infrastructure/schema/wallet-outbox-message";

export const WALLET_OUTBOX_REPOSITORY = Symbol("WALLET_OUTBOX_REPOSITORY");

export type ClaimWalletOutboxBatchParams = {
  batchSize: number;
  claimedAt: Date;
  expiredLockAt: Date;
  workerId: string;
};

export type MarkWalletOutboxPublishedParams = {
  messageId: string;
  publishedAt: Date;
  workerId: string;
};

export type MarkWalletOutboxRetryParams = {
  messageId: string;
  availableAt: Date;
  failedAt: Date;
  error: string;
  workerId: string;
};

export type MarkWalletOutboxUnroutableParams = {
  messageId: string;
  availableAt: Date;
  failedAt: Date;
  error: string;
  workerId: string;
};

export type MarkWalletOutboxFailedParams = {
  messageId: string;
  failedAt: Date;
  error: string;
  workerId: string;
};

export type ReleaseExpiredWalletOutboxLocksParams = {
  expiredLockAt: Date;
  releasedAt: Date;
};

export interface IWalletOutboxRepository {
  insert(message: CreateWalletOutboxMessageProps): Promise<WalletOutboxMessageRecord>;
  claimBatch(params: ClaimWalletOutboxBatchParams): Promise<WalletOutboxMessageRecord[]>;
  markPublished(params: MarkWalletOutboxPublishedParams): Promise<void>;
  markRetry(params: MarkWalletOutboxRetryParams): Promise<void>;
  markUnroutable(params: MarkWalletOutboxUnroutableParams): Promise<void>;
  markFailed(params: MarkWalletOutboxFailedParams): Promise<void>;
  releaseExpiredLocks(params: ReleaseExpiredWalletOutboxLocksParams): Promise<number>;
}
