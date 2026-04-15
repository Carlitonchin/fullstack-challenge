export abstract class DomainError<TName extends string> extends Error {
  abstract override readonly name: TName;

  protected constructor(message: string) {
    super(message);
  }
}

export class BetIdIsRequiredError extends DomainError<"BET_ID_IS_REQUIRED"> {
  override readonly name = "BET_ID_IS_REQUIRED" as const;

  constructor() {
    super("Bet id is required");
  }
}

export class RoundIdIsRequiredError extends DomainError<"ROUND_ID_IS_REQUIRED"> {
  override readonly name = "ROUND_ID_IS_REQUIRED" as const;

  constructor() {
    super("Round id is required");
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

export class AmountInCentsMustBeAtLeastMinimumBetError extends DomainError<"AMOUNT_IN_CENTS_MUST_BE_AT_LEAST_MINIMUM_BET"> {
  override readonly name =
    "AMOUNT_IN_CENTS_MUST_BE_AT_LEAST_MINIMUM_BET" as const;

  constructor() {
    super("Amount in cents must be at least the minimum bet");
  }
}

export class AmountInCentsCannotExceedMaximumBetError extends DomainError<"AMOUNT_IN_CENTS_CANNOT_EXCEED_MAXIMUM_BET"> {
  override readonly name =
    "AMOUNT_IN_CENTS_CANNOT_EXCEED_MAXIMUM_BET" as const;

  constructor() {
    super("Amount in cents cannot exceed the maximum bet");
  }
}

export class UnsupportedCurrencyError extends DomainError<"UNSUPPORTED_CURRENCY"> {
  override readonly name = "UNSUPPORTED_CURRENCY" as const;

  constructor() {
    super("Currency must be BRL");
  }
}

export class BetCanOnlyBeAcceptedFromPendingStatusError extends DomainError<"BET_CAN_ONLY_BE_ACCEPTED_FROM_PENDING_STATUS"> {
  override readonly name =
    "BET_CAN_ONLY_BE_ACCEPTED_FROM_PENDING_STATUS" as const;

  constructor() {
    super("Bet can only be accepted from PENDING status");
  }
}

export class BetCannotBeAcceptedBeforeCreationError extends DomainError<"BET_CANNOT_BE_ACCEPTED_BEFORE_CREATION"> {
  override readonly name = "BET_CANNOT_BE_ACCEPTED_BEFORE_CREATION" as const;

  constructor() {
    super("Bet cannot be accepted before creation");
  }
}

export class BetCanOnlyBeRejectedFromPendingStatusError extends DomainError<"BET_CAN_ONLY_BE_REJECTED_FROM_PENDING_STATUS"> {
  override readonly name =
    "BET_CAN_ONLY_BE_REJECTED_FROM_PENDING_STATUS" as const;

  constructor() {
    super("Bet can only be rejected from PENDING status");
  }
}

export class RejectionReasonIsRequiredError extends DomainError<"REJECTION_REASON_IS_REQUIRED"> {
  override readonly name = "REJECTION_REASON_IS_REQUIRED" as const;

  constructor() {
    super("Rejection reason is required");
  }
}

export class BetCannotBeRejectedBeforeCreationError extends DomainError<"BET_CANNOT_BE_REJECTED_BEFORE_CREATION"> {
  override readonly name = "BET_CANNOT_BE_REJECTED_BEFORE_CREATION" as const;

  constructor() {
    super("Bet cannot be rejected before creation");
  }
}

export class BetCanOnlyCashOutFromAcceptedStatusError extends DomainError<"BET_CAN_ONLY_CASH_OUT_FROM_ACCEPTED_STATUS"> {
  override readonly name =
    "BET_CAN_ONLY_CASH_OUT_FROM_ACCEPTED_STATUS" as const;

  constructor() {
    super("Bet can only cash out from ACCEPTED status");
  }
}

export class CashoutMultiplierMustBeGreaterThanOneError extends DomainError<"CASHOUT_MULTIPLIER_MUST_BE_GREATER_THAN_ONE"> {
  override readonly name =
    "CASHOUT_MULTIPLIER_MUST_BE_GREATER_THAN_ONE" as const;

  constructor() {
    super("Cashout multiplier must be greater than 1");
  }
}

export class PayoutAmountInCentsMustBeAnIntegerError extends DomainError<"PAYOUT_AMOUNT_IN_CENTS_MUST_BE_AN_INTEGER"> {
  override readonly name =
    "PAYOUT_AMOUNT_IN_CENTS_MUST_BE_AN_INTEGER" as const;

  constructor() {
    super("Payout amount in cents must be an integer");
  }
}

export class PayoutAmountInCentsMustBeGreaterThanOrEqualToStakeError extends DomainError<"PAYOUT_AMOUNT_IN_CENTS_MUST_BE_GREATER_THAN_OR_EQUAL_TO_STAKE"> {
  override readonly name =
    "PAYOUT_AMOUNT_IN_CENTS_MUST_BE_GREATER_THAN_OR_EQUAL_TO_STAKE" as const;

  constructor() {
    super("Payout amount in cents must be greater than or equal to the stake");
  }
}

export class PayoutAmountCurrencyMustMatchBetAmountCurrencyError extends DomainError<"PAYOUT_AMOUNT_CURRENCY_MUST_MATCH_BET_AMOUNT_CURRENCY"> {
  override readonly name =
    "PAYOUT_AMOUNT_CURRENCY_MUST_MATCH_BET_AMOUNT_CURRENCY" as const;

  constructor() {
    super("Payout amount currency must match bet amount currency");
  }
}

export class BetCannotCashOutBeforeItIsAcceptedError extends DomainError<"BET_CANNOT_CASH_OUT_BEFORE_IT_IS_ACCEPTED"> {
  override readonly name = "BET_CANNOT_CASH_OUT_BEFORE_IT_IS_ACCEPTED" as const;

  constructor() {
    super("Bet cannot cash out before it is accepted");
  }
}

export class BetCanOnlyLoseFromAcceptedStatusError extends DomainError<"BET_CAN_ONLY_LOSE_FROM_ACCEPTED_STATUS"> {
  override readonly name = "BET_CAN_ONLY_LOSE_FROM_ACCEPTED_STATUS" as const;

  constructor() {
    super("Bet can only lose from ACCEPTED status");
  }
}

export class BetCannotLoseBeforeItIsAcceptedError extends DomainError<"BET_CANNOT_LOSE_BEFORE_IT_IS_ACCEPTED"> {
  override readonly name = "BET_CANNOT_LOSE_BEFORE_IT_IS_ACCEPTED" as const;

  constructor() {
    super("Bet cannot lose before it is accepted");
  }
}

export class BetCanOnlySettleFromResolvedStatusError extends DomainError<"BET_CAN_ONLY_SETTLE_FROM_RESOLVED_STATUS"> {
  override readonly name = "BET_CAN_ONLY_SETTLE_FROM_RESOLVED_STATUS" as const;

  constructor() {
    super("Bet can only settle from CASHED_OUT or LOST status");
  }
}

export class BetCannotSettleBeforeItIsResolvedError extends DomainError<"BET_CANNOT_SETTLE_BEFORE_IT_IS_RESOLVED"> {
  override readonly name = "BET_CANNOT_SETTLE_BEFORE_IT_IS_RESOLVED" as const;

  constructor() {
    super("Bet cannot settle before it is resolved");
  }
}

export class PlacedAtMustMatchCreatedAtError extends DomainError<"PLACED_AT_MUST_MATCH_CREATED_AT"> {
  override readonly name = "PLACED_AT_MUST_MATCH_CREATED_AT" as const;

  constructor() {
    super("Placed at must match created at");
  }
}

export class AcceptedBetsMustHaveAnAcceptedAtError extends DomainError<"ACCEPTED_BETS_MUST_HAVE_AN_ACCEPTED_AT"> {
  override readonly name = "ACCEPTED_BETS_MUST_HAVE_AN_ACCEPTED_AT" as const;

  constructor() {
    super("Accepted bets must have an accepted at");
  }
}

export class RejectedBetsMustHaveARejectedAtError extends DomainError<"REJECTED_BETS_MUST_HAVE_A_REJECTED_AT"> {
  override readonly name = "REJECTED_BETS_MUST_HAVE_A_REJECTED_AT" as const;

  constructor() {
    super("Rejected bets must have a rejected at");
  }
}

export class RejectedBetsMustHaveARejectionReasonError extends DomainError<"REJECTED_BETS_MUST_HAVE_A_REJECTION_REASON"> {
  override readonly name =
    "REJECTED_BETS_MUST_HAVE_A_REJECTION_REASON" as const;

  constructor() {
    super("Rejected bets must have a rejection reason");
  }
}

export class CashedOutBetsMustHaveACashedOutAtError extends DomainError<"CASHED_OUT_BETS_MUST_HAVE_A_CASHED_OUT_AT"> {
  override readonly name =
    "CASHED_OUT_BETS_MUST_HAVE_A_CASHED_OUT_AT" as const;

  constructor() {
    super("Cashed out bets must have a cashed out at");
  }
}

export class CashedOutBetsMustHaveACashoutMultiplierError extends DomainError<"CASHED_OUT_BETS_MUST_HAVE_A_CASHOUT_MULTIPLIER"> {
  override readonly name =
    "CASHED_OUT_BETS_MUST_HAVE_A_CASHOUT_MULTIPLIER" as const;

  constructor() {
    super("Cashed out bets must have a cashout multiplier");
  }
}

export class CashedOutBetsMustHaveAPayoutAmountError extends DomainError<"CASHED_OUT_BETS_MUST_HAVE_A_PAYOUT_AMOUNT"> {
  override readonly name = "CASHED_OUT_BETS_MUST_HAVE_A_PAYOUT_AMOUNT" as const;

  constructor() {
    super("Cashed out bets must have a payout amount");
  }
}

export class LostBetsMustHaveALostAtError extends DomainError<"LOST_BETS_MUST_HAVE_A_LOST_AT"> {
  override readonly name = "LOST_BETS_MUST_HAVE_A_LOST_AT" as const;

  constructor() {
    super("Lost bets must have a lost at");
  }
}

export class SettledBetsMustHaveASettledAtError extends DomainError<"SETTLED_BETS_MUST_HAVE_A_SETTLED_AT"> {
  override readonly name = "SETTLED_BETS_MUST_HAVE_A_SETTLED_AT" as const;

  constructor() {
    super("Settled bets must have a settled at");
  }
}

export class SettledBetsMustHaveAResolutionError extends DomainError<"SETTLED_BETS_MUST_HAVE_A_RESOLUTION"> {
  override readonly name = "SETTLED_BETS_MUST_HAVE_A_RESOLUTION" as const;

  constructor() {
    super("Settled bets must preserve a cashout or loss resolution");
  }
}

export class BetsCannotMixRejectedAndResolvedDataError extends DomainError<"BETS_CANNOT_MIX_REJECTED_AND_RESOLVED_DATA"> {
  override readonly name = "BETS_CANNOT_MIX_REJECTED_AND_RESOLVED_DATA" as const;

  constructor() {
    super("Bets cannot mix rejected and resolved data");
  }
}

export class BetsCannotMixCashoutAndLossDataError extends DomainError<"BETS_CANNOT_MIX_CASHOUT_AND_LOSS_DATA"> {
  override readonly name = "BETS_CANNOT_MIX_CASHOUT_AND_LOSS_DATA" as const;

  constructor() {
    super("Bets cannot mix cashout and loss data");
  }
}

export class ResolvedBetsMustHaveAnAcceptedAtError extends DomainError<"RESOLVED_BETS_MUST_HAVE_AN_ACCEPTED_AT"> {
  override readonly name = "RESOLVED_BETS_MUST_HAVE_AN_ACCEPTED_AT" as const;

  constructor() {
    super("Resolved bets must have an accepted at");
  }
}

export class BetStatusDoesNotMatchStoredResolutionDataError extends DomainError<"BET_STATUS_DOES_NOT_MATCH_STORED_RESOLUTION_DATA"> {
  override readonly name =
    "BET_STATUS_DOES_NOT_MATCH_STORED_RESOLUTION_DATA" as const;

  constructor() {
    super("Bet status does not match stored resolution data");
  }
}

export class BetTimestampsMustFollowCausalOrderError extends DomainError<"BET_TIMESTAMPS_MUST_FOLLOW_CAUSAL_ORDER"> {
  override readonly name = "BET_TIMESTAMPS_MUST_FOLLOW_CAUSAL_ORDER" as const;

  constructor() {
    super("Bet timestamps must follow causal order");
  }
}

export type BetDomainError =
  | BetIdIsRequiredError
  | RoundIdIsRequiredError
  | PlayerIdIsRequiredError
  | AmountInCentsMustBeAnIntegerError
  | AmountInCentsMustBeAtLeastMinimumBetError
  | AmountInCentsCannotExceedMaximumBetError
  | UnsupportedCurrencyError
  | BetCanOnlyBeAcceptedFromPendingStatusError
  | BetCannotBeAcceptedBeforeCreationError
  | BetCanOnlyBeRejectedFromPendingStatusError
  | RejectionReasonIsRequiredError
  | BetCannotBeRejectedBeforeCreationError
  | BetCanOnlyCashOutFromAcceptedStatusError
  | CashoutMultiplierMustBeGreaterThanOneError
  | PayoutAmountInCentsMustBeAnIntegerError
  | PayoutAmountInCentsMustBeGreaterThanOrEqualToStakeError
  | PayoutAmountCurrencyMustMatchBetAmountCurrencyError
  | BetCannotCashOutBeforeItIsAcceptedError
  | BetCanOnlyLoseFromAcceptedStatusError
  | BetCannotLoseBeforeItIsAcceptedError
  | BetCanOnlySettleFromResolvedStatusError
  | BetCannotSettleBeforeItIsResolvedError
  | PlacedAtMustMatchCreatedAtError
  | AcceptedBetsMustHaveAnAcceptedAtError
  | RejectedBetsMustHaveARejectedAtError
  | RejectedBetsMustHaveARejectionReasonError
  | CashedOutBetsMustHaveACashedOutAtError
  | CashedOutBetsMustHaveACashoutMultiplierError
  | CashedOutBetsMustHaveAPayoutAmountError
  | LostBetsMustHaveALostAtError
  | SettledBetsMustHaveASettledAtError
  | SettledBetsMustHaveAResolutionError
  | BetsCannotMixRejectedAndResolvedDataError
  | BetsCannotMixCashoutAndLossDataError
  | ResolvedBetsMustHaveAnAcceptedAtError
  | BetStatusDoesNotMatchStoredResolutionDataError
  | BetTimestampsMustFollowCausalOrderError;

export type BetResult<T = undefined> =
  | {
      success: true;
      error?: undefined;
      data?: T;
    }
  | {
      success: false;
      error: BetDomainError;
      data?: undefined;
    };
