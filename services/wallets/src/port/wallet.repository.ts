import type { WalletResult } from "@wallets/domain/wallet/wallet.errors";
import type { Wallet } from "@wallets/domain/wallet/wallet";

export const WALLET_REPOSITORY = Symbol("WALLET_REPOSITORY");

export interface IWalletRepository {
  findByPlayerId(playerId: string): Promise<WalletResult<Wallet | undefined>>;
}
