import * as BetErrors from "./bet.errors";

const MINIMUM_BET_IN_CENTS = 100;
const MAXIMUM_BET_IN_CENTS = 100_000;

export type BetCurrency = "BRL";

export type BetAmountProps = {
  amountInCents: number;
  currency: BetCurrency;
};

export class BetAmount {
  private _amountInCents: number;
  private _currency: BetCurrency;

  private constructor(props: BetAmountProps) {
    this._amountInCents = props.amountInCents;
    this._currency = props.currency;
  }

  static create(props: BetAmountProps): BetErrors.BetResult<BetAmount> {
    if (!Number.isInteger(props.amountInCents)) {
      return BetAmount.failure(
        new BetErrors.AmountInCentsMustBeAnIntegerError(),
      );
    }

    if (props.amountInCents < MINIMUM_BET_IN_CENTS) {
      return BetAmount.failure(
        new BetErrors.AmountInCentsMustBeAtLeastMinimumBetError(),
      );
    }

    if (props.amountInCents > MAXIMUM_BET_IN_CENTS) {
      return BetAmount.failure(
        new BetErrors.AmountInCentsCannotExceedMaximumBetError(),
      );
    }

    if (props.currency !== "BRL") {
      return BetAmount.failure(new BetErrors.UnsupportedCurrencyError());
    }

    return BetAmount.success(new BetAmount(props));
  }

  get amountInCents(): number {
    return this._amountInCents;
  }

  get currency(): BetCurrency {
    return this._currency;
  }

  equals(other: BetAmount): boolean {
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
