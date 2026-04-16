import * as WalletErrors from "./wallet.errors";
import { WalletBalance, type WalletCurrency } from "./wallet-balance";
import {
  WalletCreatedDomainEvent,
  WalletCreditedDomainEvent,
  WalletDebitedDomainEvent,
  type WalletDomainEvent,
} from "./wallet.events";

export type WalletOperationType =
  | "ACCOUNT_FUNDING"
  | "BET_STAKE_LOCK"
  | "BET_STAKE_REFUND"
  | "BET_PAYOUT";

export type WalletOperation = {
  id: string;
  amount: WalletBalance;
  occurredAt: Date;
  type: "credit" | "debit";
  operationType: WalletOperationType
};

export type PersistedWalletOperation = WalletOperation & {
  ledgerSequence: bigint;
};

export type WalletProps = {
  id: string;
  playerId: string;
  balance: WalletBalance;
  createdAt: Date;
  updatedAt: Date;
};


export type NewWalletProps = {
  id: string;
  playerId: string;
  createdAt: Date;
};

export type RehydrateWalletProps = {
  id: string;
  playerId: string;
  createdAt: Date;
  operations: PersistedWalletOperation[];
};

type WalletMutationProps = {
  operationId: string;
  amount: WalletBalance;
  operationType: WalletOperationType
  occurredAt?: Date;
};

export class Wallet {
  private _id: string;
  private _playerId: string;
  private _balance: WalletBalance;
  private _createdAt: Date;
  private _updatedAt: Date;
  private _domainEvents: WalletDomainEvent[];
  private _newOperations: WalletOperation[];

  private constructor(props: WalletProps) {
    this._id = props.id;
    this._playerId = props.playerId;
    this._balance = props.balance;
    this._createdAt = new Date(props.createdAt);
    this._updatedAt = new Date(props.updatedAt);
    this._domainEvents = [];
    this._newOperations = [];
  }

  private static createWallet(
    props: NewWalletProps,
  ): WalletErrors.WalletResult<Wallet> {
    const initialBalanceResult = WalletBalance.create({
      amountInCents: 0n,
      currency: "BRL",
    });
    if (!initialBalanceResult.success) {
      return Wallet.failure(initialBalanceResult.error);
    }

    const walletProps: WalletProps = {
      id: props.id,
      playerId: props.playerId,
      balance: initialBalanceResult.data!,
      createdAt: props.createdAt,
      updatedAt: props.createdAt,
    };

    const invariantResult = Wallet.ensureInvariants(walletProps);
    if (!invariantResult.success) {
      return invariantResult;
    }

    const wallet = new Wallet(walletProps);
    return Wallet.success(wallet);
  }

  static new(props: NewWalletProps): WalletErrors.WalletResult<Wallet> {
    const result = Wallet.createWallet(props);

    if (!result.success) {
      return result;
    }

    const wallet = result.data!;

    wallet.recordDomainEvent(
      new WalletCreatedDomainEvent({
        type: "wallet.created",
        walletId: wallet.id,
        playerId: wallet.playerId,
        occurredAt: wallet.createdAt,
        idempotencyKey: wallet.id,
        amountInCents: 0n,
        currency: wallet.currency,
        balanceAfterInCents: wallet.balanceInCents,
      }),
    );

    return result;
  }

  static rehydrate(
    props: RehydrateWalletProps,
  ): WalletErrors.WalletResult<Wallet> {
    const walletResult = Wallet.createWallet({
      id: props.id,
      playerId: props.playerId,
      createdAt: props.createdAt,
    });
    if (!walletResult.success) {
      return walletResult;
    }

    const wallet = walletResult.data!;
    const seenLedgerSequences = new Set<bigint>();

    const orderedOperations = [...props.operations].sort((left, right) => {
      const leftSequence = left.ledgerSequence;
      const rightSequence = right.ledgerSequence;

      if (leftSequence < rightSequence) {
        return -1;
      }

      if (leftSequence > rightSequence) {
        return 1;
      }

      return 0;
    });

    for (const operation of orderedOperations) {
      if (operation.ledgerSequence <= 0n) {
        return Wallet.failure(
          new WalletErrors.WalletOperationLedgerSequenceMustBeGreaterThanZeroError(),
        );
      }

      if (seenLedgerSequences.has(operation.ledgerSequence)) {
        return Wallet.failure(
          new WalletErrors.WalletOperationLedgerSequenceMustBeUniqueError(),
        );
      }

      seenLedgerSequences.add(operation.ledgerSequence);

      const operationResult =
        operation.type === "credit"
          ? wallet.applyCredit(operation, false)
          : wallet.applyDebit(operation, false);

      if (!operationResult.success) {
        return operationResult;
      }
    }

    wallet.pullDomainEvents();

    return Wallet.success(wallet);
  }

  get id(): string {
    return this._id;
  }

  get playerId(): string {
    return this._playerId;
  }

  get balance(): WalletBalance {
    return this._balance;
  }

  get balanceInCents(): bigint {
    return this._balance.amountInCents;
  }

  get currency(): WalletCurrency {
    return this._balance.currency;
  }

  get createdAt(): Date {
    return new Date(this._createdAt);
  }

  get updatedAt(): Date {
    return new Date(this._updatedAt);
  }

  pullDomainEvents(): WalletDomainEvent[] {
    const events = [...this._domainEvents];
    this._domainEvents = [];
    return events;
  }

  pullNewOperations(): WalletOperation[] {
    const operations = this._newOperations.map((operation) => ({
      ...operation,
      occurredAt: new Date(operation.occurredAt),
    }));
    this._newOperations = [];
    return operations;
  }

  credit({
    operationId,
    amount,
    operationType,
    occurredAt = new Date(),
  }: WalletMutationProps): WalletErrors.WalletResult {
    const result = this.applyCredit(
      {
        id: operationId,
        amount,
        operationType,
        occurredAt,
        type: "credit",
      },
      true,
    );
    if (result.success) {
      this._newOperations.push({
        id: operationId,
        amount,
        operationType,
        occurredAt: new Date(occurredAt),
        type: "credit",
      });
    }

    return result;
  }

  debit({
    operationId,
    amount,
    operationType,
    occurredAt = new Date(),
  }: WalletMutationProps): WalletErrors.WalletResult {
    const result = this.applyDebit(
      {
        id: operationId,
        operationType,
        amount,
        occurredAt,
        type: "debit",
      },
      true,
    );

    if (result.success) {
      this._newOperations.push({
        id: operationId,
        amount,
        operationType,
        occurredAt: new Date(occurredAt),
        type: "debit",
      });
    }

    return result;
  }

  private applyCredit(
    operation: WalletOperation,
    emitDomainEvent: boolean,
  ): WalletErrors.WalletResult {
    const operationValidationResult = this.ensureOperationCanBeApplied(operation);
    if (!operationValidationResult.success) {
      return Wallet.failure(operationValidationResult.error);
    }
    const operationId = operationValidationResult.data!;

    if (operation.amount.amountInCents <= 0n) {
      return Wallet.failure(
        new WalletErrors.AmountInCentsMustBeGreaterThanZeroError(),
      );
    }

    const nextBalanceResult = this._balance.add(operation.amount);
    if (!nextBalanceResult.success) {
      return Wallet.failure(nextBalanceResult.error);
    }

    this._balance = nextBalanceResult.data!;
    this._updatedAt =
      operation.occurredAt.getTime() > this._updatedAt.getTime()
        ? new Date(operation.occurredAt)
        : new Date(this._updatedAt);

    if (emitDomainEvent) {
      this.recordDomainEvent(
        new WalletCreditedDomainEvent({
          type: "wallet.credited",
          walletId: this.id,
          playerId: this.playerId,
          operationId,
          occurredAt: new Date(operation.occurredAt),
          idempotencyKey: operationId,
          amountInCents: operation.amount.amountInCents,
          currency: operation.amount.currency,
          balanceAfterInCents: this.balanceInCents,
        }),
      );
    }

    return Wallet.success();
  }

  private applyDebit(
    operation: WalletOperation,
    emitDomainEvent: boolean,
  ): WalletErrors.WalletResult {
    const operationValidationResult = this.ensureOperationCanBeApplied(operation);
    if (!operationValidationResult.success) {
      return Wallet.failure(operationValidationResult.error);
    }
    const operationId = operationValidationResult.data!;

    if (operation.amount.amountInCents <= 0n) {
      return Wallet.failure(
        new WalletErrors.AmountInCentsMustBeGreaterThanZeroError(),
      );
    }

    const nextBalanceResult = this._balance.subtract(operation.amount);
    if (!nextBalanceResult.success) {
      return Wallet.failure(nextBalanceResult.error);
    }

    this._balance = nextBalanceResult.data!;
    this._updatedAt =
      operation.occurredAt.getTime() > this._updatedAt.getTime()
        ? new Date(operation.occurredAt)
        : new Date(this._updatedAt);

    if (emitDomainEvent) {
      this.recordDomainEvent(
        new WalletDebitedDomainEvent({
          type: "wallet.debited",
          walletId: this.id,
          playerId: this.playerId,
          operationId,
          occurredAt: new Date(operation.occurredAt),
          idempotencyKey: operationId,
          amountInCents: operation.amount.amountInCents,
          currency: operation.amount.currency,
          balanceAfterInCents: this.balanceInCents,
        }),
      );
    }

    return Wallet.success();
  }

  private ensureOperationCanBeApplied(
    operation: WalletOperation,
  ): WalletErrors.WalletResult<string> {
    const operationId = operation.id?.trim();
    if (!operationId) {
      return Wallet.failure(new WalletErrors.WalletOperationIdIsRequiredError());
    }

    const operationTimeResult = this.ensureOperationTime(operation.occurredAt);
    if (!operationTimeResult.success) {
      return Wallet.failure(operationTimeResult.error);
    }

    return Wallet.success(operationId);
  }

  private ensureOperationTime(
    occurredAt: Date,
  ): WalletErrors.WalletResult {
    if (occurredAt.getTime() < this.createdAt.getTime()) {
      return Wallet.failure(
        new WalletErrors.WalletOperationCannotHappenBeforeCreationError(),
      );
    }

    return Wallet.success();
  }

  private recordDomainEvent(event: WalletDomainEvent): void {
    this._domainEvents.push(event);
  }

  private static ensureInvariants(
    props: WalletProps,
  ): WalletErrors.WalletResult {
    if (!props.id.trim()) {
      return Wallet.failure(new WalletErrors.WalletIdIsRequiredError());
    }

    if (!props.playerId.trim()) {
      return Wallet.failure(new WalletErrors.PlayerIdIsRequiredError());
    }

    if (Number.isNaN(props.createdAt.getTime())) {
      return Wallet.failure(new WalletErrors.CreatedAtIsRequiredError());
    }

    if (Number.isNaN(props.updatedAt.getTime())) {
      return Wallet.failure(new WalletErrors.UpdatedAtIsRequiredError());
    }

    if (props.updatedAt.getTime() < props.createdAt.getTime()) {
      return Wallet.failure(
        new WalletErrors.UpdatedAtCannotBeBeforeCreatedAtError(),
      );
    }

    const balanceResult = WalletBalance.create({
      amountInCents: props.balance.amountInCents,
      currency: props.balance.currency,
    });
    if (!balanceResult.success) {
      return Wallet.failure(balanceResult.error);
    }

    return Wallet.success();
  }
  private static success<T>(data?: T): WalletErrors.WalletResult<T> {
    return { success: true, data };
  }

  private static failure<T = undefined>(
    error: WalletErrors.WalletDomainError,
  ): WalletErrors.WalletResult<T> {
    return { success: false, error };
  }
}
