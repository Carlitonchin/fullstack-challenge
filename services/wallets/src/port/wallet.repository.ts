import type { WalletResult } from "@wallets/domain/wallet/wallet.errors";
import type { Wallet, WalletOperation } from "@wallets/domain/wallet/wallet";

export const WALLET_REPOSITORY = Symbol("WALLET_REPOSITORY");

export interface IWalletRepository {
  findByPlayerId(playerId: string): Promise<WalletResult<Wallet | undefined>>;
  persist(wallet: Wallet): Promise<WalletResult<Wallet>>;
  persistOperation(params: {
    wallet: Wallet;
    operation: WalletOperation;
  }): Promise<WalletResult<WalletOperation>>;
}
