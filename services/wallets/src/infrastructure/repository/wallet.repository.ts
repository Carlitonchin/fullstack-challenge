import { Injectable } from "@nestjs/common";
import { EntityManager } from "@mikro-orm/postgresql";
import {
  Wallet,
  type PersistedWalletOperation,
  type WalletOperation,
} from "../../domain/wallet/wallet";
import { WalletBalance } from "../../domain/wallet/wallet-balance";
import type {
  WalletDomainError,
  WalletResult,
} from "../../domain/wallet/wallet.errors";
import type {
  IWalletRepository
} from "@wallets/port/wallet.repository";
import {
  WalletSchema,
  WalletCurrencyType,
  type IWallet,
} from "../schema/wallet";
import {
  WalletOperationSchema,
  type IWalletOperation,
} from "../schema/wallet-operation";

@Injectable()
export class WalletRepository implements IWalletRepository {
  constructor(private readonly em: EntityManager) { }

  async findByPlayerId(playerId: string): Promise<WalletResult<Wallet | undefined>> {
    const walletRecord = await this.em.findOne(
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

  async persist(wallet: Wallet): Promise<WalletResult<Wallet>> {
    const entity = this.em.create(WalletSchema, {
      id: wallet.id,
      playerId: wallet.playerId,
      currency: WalletCurrencyType[wallet.currency],
      createdAt: wallet.createdAt,
    });

    this.em.persist(entity);

    return WalletRepository.success(wallet);
  }

  async persistOperation({
    wallet,
    operation
  }: {
    wallet: Wallet;
    operation: WalletOperation;
  }): Promise<WalletResult<WalletOperation>> {
    const signedAmountInCents =
      operation.type === "credit"
        ? operation.amount.amountInCents
        : operation.amount.amountInCents * -1n;

    const entity = this.em.create(
      WalletOperationSchema,
      {
        id: operation.id,
        wallet: this.em.getReference(WalletSchema, wallet.id),
        amountCents: signedAmountInCents,
        operationId: operation.id,
        operationType: operation.operationType,
        createdAt: operation.occurredAt,
      } as unknown as IWalletOperation,
    );

    this.em.persist(entity);

    return WalletRepository.success(operation);
  }

  private mapOperation(
    operationRecord: IWalletOperation,
    walletRecord: IWallet,
  ): WalletResult<PersistedWalletOperation> {
    const rawAmountInCents = BigInt(operationRecord.amountCents.toString());
    const type = rawAmountInCents >= 0n ? "credit" : "debit";
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
      type: type,
      operationType: operationRecord.operationType,
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
