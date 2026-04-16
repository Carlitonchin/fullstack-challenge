import { Injectable } from "@nestjs/common";
import { MikroORM } from "@mikro-orm/postgresql";
import { Wallet, type PersistedWalletOperation } from "../../domain/wallet/wallet";
import { WalletBalance } from "../../domain/wallet/wallet-balance";
import type {
  WalletDomainError,
  WalletResult,
} from "../../domain/wallet/wallet.errors";
import { WalletSchema, type IWallet } from "../schema/wallet";
import { type IWalletOperation } from "../schema/wallet-operation";

@Injectable()
export class WalletRepository {
  constructor(private readonly orm: MikroORM) {}

  async findByPlayerId(playerId: string): Promise<WalletResult<Wallet | undefined>> {
    const entityManager = this.orm.em.fork();
    const walletRecord = await entityManager.findOne(
      WalletSchema,
      { playerId },
      { populate: ["operations"] },
    );

    if (!walletRecord) {
      return WalletRepository.success(undefined);
    }

    const operationResults = walletRecord.operations
      .getItems()
      .map((operation) => this.mapOperation(operation, walletRecord));
    const failedOperationResult = operationResults.find((result) => !result.success);

    if (failedOperationResult && !failedOperationResult.success) {
      return WalletRepository.failure(failedOperationResult.error);
    }

    const operations = operationResults.map((result) => result.data!);

    const walletResult = Wallet.rehydrate({
      id: walletRecord.id,
      playerId: walletRecord.playerId,
      createdAt: walletRecord.createdAt,
      operations,
    });

    if (!walletResult.success) {
      return WalletRepository.failure(walletResult.error);
    }

    return WalletRepository.success(walletResult.data);
  }

  private mapOperation(
    operationRecord: IWalletOperation,
    walletRecord: IWallet,
  ): WalletResult<PersistedWalletOperation> {
    const rawAmountInCents = BigInt(operationRecord.amountCents.toString());
    const operationType = rawAmountInCents >= 0n ? "credit" : "debit";
    const balanceResult = WalletBalance.create({
      amountInCents:
        rawAmountInCents >= 0n ? rawAmountInCents : rawAmountInCents * -1n,
      currency: walletRecord.currency,
    });

    if (!balanceResult.success) {
      return WalletRepository.failure(balanceResult.error);
    }

    return WalletRepository.success({
      id: operationRecord.operationId,
      amount: balanceResult.data!,
      occurredAt: operationRecord.createdAt,
      type: operationType,
      ledgerSequence: BigInt(operationRecord.ledgerSequence.toString()),
    });
  }

  private static success<T>(data: T): WalletResult<T> {
    return { success: true, data };
  }

  private static failure<T>(error: WalletDomainError): WalletResult<T> {
    return { success: false, error };
  }
}
