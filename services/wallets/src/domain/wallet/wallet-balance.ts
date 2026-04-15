import * as WalletErrors from "./wallet.errors";

export type WalletCurrency = "BRL";

export type WalletBalanceProps = {
  amountInCents: bigint | number;
  currency: WalletCurrency;
};

export class WalletBalance {
  private _amountInCents: bigint;
  private _currency: WalletCurrency;

  private constructor(props: { amountInCents: bigint; currency: WalletCurrency }) {
    this._amountInCents = props.amountInCents;
    this._currency = props.currency;
  }

  static create(
    props: WalletBalanceProps,
  ): WalletErrors.WalletResult<WalletBalance> {
    const normalizedAmountResult = WalletBalance.normalizeAmountInCents(
      props.amountInCents,
    );
    if (!normalizedAmountResult.success) {
      return WalletBalance.failure(normalizedAmountResult.error);
    }

    const amountInCents = normalizedAmountResult.data!;

    if (amountInCents < 0n) {
      return WalletBalance.failure(
        new WalletErrors.AmountInCentsCannotBeNegativeError(),
      );
    }

    if (props.currency !== "BRL") {
      return WalletBalance.failure(new WalletErrors.UnsupportedCurrencyError());
    }

    return WalletBalance.success(
      new WalletBalance({ amountInCents, currency: props.currency }),
    );
  }

  get amountInCents(): bigint {
    return this._amountInCents;
  }

  get currency(): WalletCurrency {
    return this._currency;
  }

  add(
    amount: WalletBalance,
  ): WalletErrors.WalletResult<WalletBalance> {
    if (amount.currency !== this.currency) {
      return WalletBalance.failure(
        new WalletErrors.BalanceCurrencyMustMatchWalletCurrencyError(),
      );
    }

    return WalletBalance.create({
      amountInCents: this.amountInCents + amount.amountInCents,
      currency: this.currency,
    });
  }

  subtract(
    amount: WalletBalance,
  ): WalletErrors.WalletResult<WalletBalance> {
    if (amount.currency !== this.currency) {
      return WalletBalance.failure(
        new WalletErrors.BalanceCurrencyMustMatchWalletCurrencyError(),
      );
    }

    if (this.amountInCents < amount.amountInCents) {
      return WalletBalance.failure(
        new WalletErrors.InsufficientWalletBalanceError(),
      );
    }

    return WalletBalance.create({
      amountInCents: this.amountInCents - amount.amountInCents,
      currency: this.currency,
    });
  }

  gte(amount: WalletBalance): boolean {
    return (
      this.currency === amount.currency &&
      this.amountInCents >= amount.amountInCents
    );
  }

  equals(other: WalletBalance): boolean {
    return (
      this.amountInCents === other.amountInCents &&
      this.currency === other.currency
    );
  }

  private static normalizeAmountInCents(
    amountInCents: bigint | number,
  ): WalletErrors.WalletResult<bigint> {
    if (typeof amountInCents === "bigint") {
      return WalletBalance.success(amountInCents);
    }

    if (!Number.isInteger(amountInCents)) {
      return WalletBalance.failure(
        new WalletErrors.AmountInCentsMustBeAnIntegerError(),
      );
    }

    if (!Number.isSafeInteger(amountInCents)) {
      return WalletBalance.failure(
        new WalletErrors.AmountInCentsMustBeASafeIntegerError(),
      );
    }

    return WalletBalance.success(BigInt(amountInCents));
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
