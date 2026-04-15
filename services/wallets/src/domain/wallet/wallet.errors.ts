export abstract class DomainError<TName extends string> extends Error {
  abstract override readonly name: TName;

  protected constructor(message: string) {
    super(message);
  }
}

export class WalletIdIsRequiredError extends DomainError<"WALLET_ID_IS_REQUIRED"> {
  override readonly name = "WALLET_ID_IS_REQUIRED" as const;

  constructor() {
    super("Wallet id is required");
  }
}

export class PlayerIdIsRequiredError extends DomainError<"PLAYER_ID_IS_REQUIRED"> {
  override readonly name = "PLAYER_ID_IS_REQUIRED" as const;

  constructor() {
    super("Player id is required");
  }
}

export class AmountInCentsMustBeAnIntegerError extends DomainError<"AMOUNT_IN_CENTS_MUST_BE_AN_INTEGER"> {
  override readonly name = "AMOUNT_IN_CENTS_MUST_BE_AN_INTEGER" as const;

  constructor() {
    super("Amount in cents must be an integer");
  }
}

export class AmountInCentsMustBeASafeIntegerError extends DomainError<"AMOUNT_IN_CENTS_MUST_BE_A_SAFE_INTEGER"> {
  override readonly name = "AMOUNT_IN_CENTS_MUST_BE_A_SAFE_INTEGER" as const;

  constructor() {
    super("Amount in cents must be a safe integer when provided as a number");
  }
}

export class AmountInCentsCannotBeNegativeError extends DomainError<"AMOUNT_IN_CENTS_CANNOT_BE_NEGATIVE"> {
  override readonly name = "AMOUNT_IN_CENTS_CANNOT_BE_NEGATIVE" as const;

  constructor() {
    super("Amount in cents cannot be negative");
  }
}

export class AmountInCentsMustBeGreaterThanZeroError extends DomainError<"AMOUNT_IN_CENTS_MUST_BE_GREATER_THAN_ZERO"> {
  override readonly name = "AMOUNT_IN_CENTS_MUST_BE_GREATER_THAN_ZERO" as const;

  constructor() {
    super("Amount in cents must be greater than zero");
  }
}

export class UnsupportedCurrencyError extends DomainError<"UNSUPPORTED_CURRENCY"> {
  override readonly name = "UNSUPPORTED_CURRENCY" as const;

  constructor() {
    super("Currency must be BRL");
  }
}

export class InsufficientWalletBalanceError extends DomainError<"INSUFFICIENT_WALLET_BALANCE"> {
  override readonly name = "INSUFFICIENT_WALLET_BALANCE" as const;

  constructor() {
    super("Wallet balance is insufficient");
  }
}

export class BalanceCurrencyMustMatchWalletCurrencyError extends DomainError<"BALANCE_CURRENCY_MUST_MATCH_WALLET_CURRENCY"> {
  override readonly name =
    "BALANCE_CURRENCY_MUST_MATCH_WALLET_CURRENCY" as const;

  constructor() {
    super("Balance currency must match wallet currency");
  }
}

export class CreatedAtIsRequiredError extends DomainError<"CREATED_AT_IS_REQUIRED"> {
  override readonly name = "CREATED_AT_IS_REQUIRED" as const;

  constructor() {
    super("Created at is required");
  }
}

export class UpdatedAtIsRequiredError extends DomainError<"UPDATED_AT_IS_REQUIRED"> {
  override readonly name = "UPDATED_AT_IS_REQUIRED" as const;

  constructor() {
    super("Updated at is required");
  }
}

export class UpdatedAtCannotBeBeforeCreatedAtError extends DomainError<"UPDATED_AT_CANNOT_BE_BEFORE_CREATED_AT"> {
  override readonly name = "UPDATED_AT_CANNOT_BE_BEFORE_CREATED_AT" as const;

  constructor() {
    super("Updated at cannot be before created at");
  }
}

export class WalletOperationCannotHappenBeforeCreationError extends DomainError<"WALLET_OPERATION_CANNOT_HAPPEN_BEFORE_CREATION"> {
  override readonly name =
    "WALLET_OPERATION_CANNOT_HAPPEN_BEFORE_CREATION" as const;

  constructor() {
    super("Wallet operation cannot happen before creation");
  }
}

export class WalletOperationCannotGoBackInTimeError extends DomainError<"WALLET_OPERATION_CANNOT_GO_BACK_IN_TIME"> {
  override readonly name = "WALLET_OPERATION_CANNOT_GO_BACK_IN_TIME" as const;

  constructor() {
    super("Wallet operation cannot go back in time");
  }
}

export class WalletOperationIdIsRequiredError extends DomainError<"WALLET_OPERATION_ID_IS_REQUIRED"> {
  override readonly name = "WALLET_OPERATION_ID_IS_REQUIRED" as const;

  constructor() {
    super("Wallet operation id is required");
  }
}

export class WalletOperationAlreadyProcessedError extends DomainError<"WALLET_OPERATION_ALREADY_PROCESSED"> {
  override readonly name = "WALLET_OPERATION_ALREADY_PROCESSED" as const;

  constructor() {
    super("Wallet operation was already processed");
  }
}

export type WalletDomainError =
  | WalletIdIsRequiredError
  | PlayerIdIsRequiredError
  | AmountInCentsMustBeAnIntegerError
  | AmountInCentsMustBeASafeIntegerError
  | AmountInCentsCannotBeNegativeError
  | AmountInCentsMustBeGreaterThanZeroError
  | UnsupportedCurrencyError
  | InsufficientWalletBalanceError
  | BalanceCurrencyMustMatchWalletCurrencyError
  | CreatedAtIsRequiredError
  | UpdatedAtIsRequiredError
  | UpdatedAtCannotBeBeforeCreatedAtError
  | WalletOperationCannotHappenBeforeCreationError
  | WalletOperationCannotGoBackInTimeError
  | WalletOperationIdIsRequiredError
  | WalletOperationAlreadyProcessedError;

export type WalletResult<T = undefined> =
  | {
      success: true;
      error?: undefined;
      data?: T;
    }
  | {
      success: false;
      error: WalletDomainError;
      data?: undefined;
    };
