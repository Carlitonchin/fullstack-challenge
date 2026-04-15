import * as BetErrors from "./bet.errors";
import type { BetCurrency } from "./bet-amount";

export type PayoutAmountProps = {
  amountInCents: number;
  currency: BetCurrency;
};

export class PayoutAmount {
  private _amountInCents: number;
  private _currency: BetCurrency;

  private constructor(props: PayoutAmountProps) {
    this._amountInCents = props.amountInCents;
    this._currency = props.currency;
  }

  static create(props: PayoutAmountProps): BetErrors.BetResult<PayoutAmount> {
    if (!Number.isInteger(props.amountInCents)) {
      return PayoutAmount.failure(
        new BetErrors.PayoutAmountInCentsMustBeAnIntegerError(),
      );
    }

    if (props.amountInCents <= 0) {
      return PayoutAmount.failure(
        new BetErrors.PayoutAmountInCentsMustBeGreaterThanZeroError(),
      );
    }

    if (props.currency !== "BRL") {
      return PayoutAmount.failure(new BetErrors.UnsupportedCurrencyError());
    }

    return PayoutAmount.success(new PayoutAmount(props));
  }

  get amountInCents(): number {
    return this._amountInCents;
  }

  get currency(): BetCurrency {
    return this._currency;
  }

  equals(other: PayoutAmount): boolean {
    return (
      this.amountInCents === other.amountInCents &&
      this.currency === other.currency
    );
  }

  private static success<T>(data?: T): BetErrors.BetResult<T> {
    return { success: true, data };
  }

  private static failure<T = undefined>(
    error: BetErrors.BetDomainError,
  ): BetErrors.BetResult<T> {
    return { success: false, error };
  }
}
