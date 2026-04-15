import * as WalletErrors from "./wallet.errors";
import { WalletBalance, type WalletCurrency } from "./wallet-balance";
import { type WalletDomainEvent } from "./wallet.events";

export type WalletOperation = {
  amount: WalletBalance;
  occurredAt: Date;
  type: "credit" | "debit";
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
  operations: WalletOperation[];
};

type WalletMutationProps = {
  amount: WalletBalance;
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
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
    this._domainEvents = [];
  }

  private static createWallet(
    props: NewWalletProps,
  ): WalletErrors.WalletResult<Wallet> {
    const initialBalanceResult = WalletBalance.create({
      amountInCents: 0,
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

    wallet.recordDomainEvent({
      type: "wallet.created",
      walletId: wallet.id,
      playerId: wallet.playerId,
      occurredAt: wallet.createdAt,
      amountInCents: 0,
      currency: wallet.currency,
      balanceAfterInCents: wallet.balanceInCents,
    });

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

    for (const operation of props.operations) {
      const operationResult =
        operation.type === "credit"
          ? wallet.applyCredit(operation.amount, operation.occurredAt, false)
          : wallet.applyDebit(operation.amount, operation.occurredAt, false);

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

  get balanceInCents(): number {
    return this._balance.amountInCents;
  }

  get currency(): WalletCurrency {
    return this._balance.currency;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  pullDomainEvents(): WalletDomainEvent[] {
    const events = [...this._domainEvents];
    this._domainEvents = [];
    return events;
  }

  pullNewOperations(): WalletOperation[] {
    const operations = [...this._newOperations]
    this._newOperations = [];
    return operations;
  }

  credit({
    amount,
    occurredAt = new Date(),
  }: WalletMutationProps): WalletErrors.WalletResult {
    const result = this.applyCredit(amount, occurredAt, true);
    if (result.success) {
      this._newOperations.push({ amount, occurredAt, type: "credit" })
    }

    return result;
  }

  debit({
    amount,
    occurredAt = new Date(),
  }: WalletMutationProps): WalletErrors.WalletResult {
    const result = this.applyDebit(amount, occurredAt, true);

    if (result.success) {
      this._newOperations.push({ amount, occurredAt, type: "debit" })
    }

    return result;
  }

  private applyCredit(
    amount: WalletBalance,
    occurredAt: Date,
    emitDomainEvent: boolean,
  ): WalletErrors.WalletResult {
    const operationTimeResult = this.ensureOperationTime(occurredAt);
    if (!operationTimeResult.success) {
      return operationTimeResult;
    }

    if (amount.amountInCents <= 0) {
      return Wallet.failure(
        new WalletErrors.AmountInCentsMustBeGreaterThanZeroError(),
      );
    }

    const nextBalanceResult = this._balance.add(amount);
    if (!nextBalanceResult.success) {
      return Wallet.failure(nextBalanceResult.error);
    }

    this._balance = nextBalanceResult.data!;
    this._updatedAt = occurredAt;

    if (emitDomainEvent) {
      this.recordDomainEvent({
        type: "wallet.credited",
        walletId: this.id,
        playerId: this.playerId,
        occurredAt,
        amountInCents: amount.amountInCents,
        currency: amount.currency,
        balanceAfterInCents: this.balanceInCents,
      });
    }

    return Wallet.success();
  }

  private applyDebit(
    amount: WalletBalance,
    occurredAt: Date,
    emitDomainEvent: boolean,
  ): WalletErrors.WalletResult {
    const operationTimeResult = this.ensureOperationTime(occurredAt);
    if (!operationTimeResult.success) {
      return operationTimeResult;
    }

    if (amount.amountInCents <= 0) {
      return Wallet.failure(
        new WalletErrors.AmountInCentsMustBeGreaterThanZeroError(),
      );
    }

    const nextBalanceResult = this._balance.subtract(amount);
    if (!nextBalanceResult.success) {
      return Wallet.failure(nextBalanceResult.error);
    }

    this._balance = nextBalanceResult.data!;
    this._updatedAt = occurredAt;

    if (emitDomainEvent) {
      this.recordDomainEvent({
        type: "wallet.debited",
        walletId: this.id,
        playerId: this.playerId,
        occurredAt,
        amountInCents: amount.amountInCents,
        currency: amount.currency,
        balanceAfterInCents: this.balanceInCents,
      });
    }

    return Wallet.success();
  }

  private ensureOperationTime(
    occurredAt: Date,
  ): WalletErrors.WalletResult {
    if (occurredAt.getTime() < this.createdAt.getTime()) {
      return Wallet.failure(
        new WalletErrors.WalletOperationCannotHappenBeforeCreationError(),
      );
    }

    if (occurredAt.getTime() < this.updatedAt.getTime()) {
      return Wallet.failure(
        new WalletErrors.WalletOperationCannotGoBackInTimeError(),
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

    if (!(props.createdAt instanceof Date) || Number.isNaN(props.createdAt.getTime())) {
      return Wallet.failure(new WalletErrors.CreatedAtIsRequiredError());
    }

    if (!(props.updatedAt instanceof Date) || Number.isNaN(props.updatedAt.getTime())) {
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
