export abstract class DomainError<TName extends string> extends Error {
  abstract override readonly name: TName;

  protected constructor(message: string) {
    super(message);
  }
}

export class BettingWindowMustBeGreaterThanZeroError extends DomainError<"BETTING_WINDOW_MUST_BE_GREATER_THAN_ZERO"> {
  override readonly name = "BETTING_WINDOW_MUST_BE_GREATER_THAN_ZERO" as const;

  constructor() {
    super("Betting window must be greater than zero");
  }
}

export class StartDelayCannotBeNegativeError extends DomainError<"START_DELAY_CANNOT_BE_NEGATIVE"> {
  override readonly name = "START_DELAY_CANNOT_BE_NEGATIVE" as const;

  constructor() {
    super("Start delay cannot be negative");
  }
}

export class CrashRevealCannotBeNegativeError extends DomainError<"CRASH_REVEAL_CANNOT_BE_NEGATIVE"> {
  override readonly name = "CRASH_REVEAL_CANNOT_BE_NEGATIVE" as const;

  constructor() {
    super("Crash reveal cannot be negative");
  }
}

export class RoundDurationCannotBeNegativeError extends DomainError<"ROUND_DURATION_CANNOT_BE_NEGATIVE"> {
  override readonly name = "ROUND_DURATION_CANNOT_BE_NEGATIVE" as const;

  constructor() {
    super("Round duration cannot be negative");
  }
}

export class RoundCanOnlyCloseBettingFromBettingOpenError extends DomainError<"ROUND_CAN_ONLY_CLOSE_BETTING_FROM_BETTING_OPEN"> {
  override readonly name = "ROUND_CAN_ONLY_CLOSE_BETTING_FROM_BETTING_OPEN" as const;

  constructor() {
    super("Round can only close betting from BETTING_OPEN status");
  }
}

export class RoundCanOnlyOpenBettingFromWaitingForFirstBetError extends DomainError<"ROUND_CAN_ONLY_OPEN_BETTING_FROM_WAITING_FOR_FIRST_BET"> {
  override readonly name =
    "ROUND_CAN_ONLY_OPEN_BETTING_FROM_WAITING_FOR_FIRST_BET" as const;

  constructor() {
    super("Round can only open betting from WAITING_FOR_FIRST_BET status");
  }
}

export class BettingCannotOpenBeforeRoundCreationError extends DomainError<"BETTING_CANNOT_OPEN_BEFORE_ROUND_CREATION"> {
  override readonly name = "BETTING_CANNOT_OPEN_BEFORE_ROUND_CREATION" as const;

  constructor() {
    super("Betting cannot open before round creation");
  }
}

export class BettingCannotCloseBeforeRoundCreationError extends DomainError<"BETTING_CANNOT_CLOSE_BEFORE_ROUND_CREATION"> {
  override readonly name = "BETTING_CANNOT_CLOSE_BEFORE_ROUND_CREATION" as const;

  constructor() {
    super("Betting cannot close before round creation");
  }
}

export class RoundCanOnlyStartFromBettingClosedError extends DomainError<"ROUND_CAN_ONLY_START_FROM_BETTING_CLOSED"> {
  override readonly name = "ROUND_CAN_ONLY_START_FROM_BETTING_CLOSED" as const;

  constructor() {
    super("Round can only start from BETTING_CLOSED status");
  }
}

export class RoundCannotStartBeforeScheduledStartTimeError extends DomainError<"ROUND_CANNOT_START_BEFORE_SCHEDULED_START_TIME"> {
  override readonly name = "ROUND_CANNOT_START_BEFORE_SCHEDULED_START_TIME" as const;

  constructor() {
    super("Round cannot start before its scheduled start time");
  }
}

export class RoundCannotStartBeforeCreationError extends DomainError<"ROUND_CANNOT_START_BEFORE_CREATION"> {
  override readonly name = "ROUND_CANNOT_START_BEFORE_CREATION" as const;

  constructor() {
    super("Round cannot start before creation");
  }
}

export class RoundCanOnlyCrashFromInProgressError extends DomainError<"ROUND_CAN_ONLY_CRASH_FROM_IN_PROGRESS"> {
  override readonly name = "ROUND_CAN_ONLY_CRASH_FROM_IN_PROGRESS" as const;

  constructor() {
    super("Round can only crash from IN_PROGRESS status");
  }
}

export class RoundCannotCrashBeforeScheduledCrashTimeError extends DomainError<"ROUND_CANNOT_CRASH_BEFORE_SCHEDULED_CRASH_TIME"> {
  override readonly name =
    "ROUND_CANNOT_CRASH_BEFORE_SCHEDULED_CRASH_TIME" as const;

  constructor() {
    super("Round cannot crash before its scheduled crash time");
  }
}

export class RoundCannotCrashBeforeItStartsError extends DomainError<"ROUND_CANNOT_CRASH_BEFORE_IT_STARTS"> {
  override readonly name = "ROUND_CANNOT_CRASH_BEFORE_IT_STARTS" as const;

  constructor() {
    super("Round cannot crash before it starts");
  }
}

export class RoundCanOnlyFailFromANonTerminalStatusError extends DomainError<"ROUND_CAN_ONLY_FAIL_FROM_A_NON_TERMINAL_STATUS"> {
  override readonly name =
    "ROUND_CAN_ONLY_FAIL_FROM_A_NON_TERMINAL_STATUS" as const;

  constructor() {
    super("Round can only fail from a non-terminal status");
  }
}

export class ErrorReasonIsRequiredError extends DomainError<"ERROR_REASON_IS_REQUIRED"> {
  override readonly name = "ERROR_REASON_IS_REQUIRED" as const;

  constructor() {
    super("Error reason is required");
  }
}

export class RoundCannotFailBeforeCreationError extends DomainError<"ROUND_CANNOT_FAIL_BEFORE_CREATION"> {
  override readonly name = "ROUND_CANNOT_FAIL_BEFORE_CREATION" as const;

  constructor() {
    super("Round cannot fail before creation");
  }
}

export class RoundCannotFailBeforeItStartsError extends DomainError<"ROUND_CANNOT_FAIL_BEFORE_IT_STARTS"> {
  override readonly name = "ROUND_CANNOT_FAIL_BEFORE_IT_STARTS" as const;

  constructor() {
    super("Round cannot fail before it starts");
  }
}

export class RoundCannotFailBeforeItCrashesError extends DomainError<"ROUND_CANNOT_FAIL_BEFORE_IT_CRASHES"> {
  override readonly name = "ROUND_CANNOT_FAIL_BEFORE_IT_CRASHES" as const;

  constructor() {
    super("Round cannot fail before it crashes");
  }
}

export class RoundCanOnlySettleFromCrashedStatusError extends DomainError<"ROUND_CAN_ONLY_SETTLE_FROM_CRASHED_STATUS"> {
  override readonly name = "ROUND_CAN_ONLY_SETTLE_FROM_CRASHED_STATUS" as const;

  constructor() {
    super("Round can only settle from CRASHED status");
  }
}

export class RoundCannotSettleBeforeScheduledSettleTimeError extends DomainError<"ROUND_CANNOT_SETTLE_BEFORE_SCHEDULED_SETTLE_TIME"> {
  override readonly name =
    "ROUND_CANNOT_SETTLE_BEFORE_SCHEDULED_SETTLE_TIME" as const;

  constructor() {
    super("Round cannot settle before its scheduled settle time");
  }
}

export class RoundIdIsRequiredError extends DomainError<"ROUND_ID_IS_REQUIRED"> {
  override readonly name = "ROUND_ID_IS_REQUIRED" as const;

  constructor() {
    super("Round id is required");
  }
}

export class RoundVersionMustBeGreaterThanZeroError extends DomainError<"ROUND_VERSION_MUST_BE_GREATER_THAN_ZERO"> {
  override readonly name = "ROUND_VERSION_MUST_BE_GREATER_THAN_ZERO" as const;

  constructor() {
    super("Round version must be greater than zero");
  }
}

export class ServerSeedIsRequiredError extends DomainError<"SERVER_SEED_IS_REQUIRED"> {
  override readonly name = "SERVER_SEED_IS_REQUIRED" as const;

  constructor() {
    super("Server seed is required");
  }
}

export class ServerSeedHashIsRequiredError extends DomainError<"SERVER_SEED_HASH_IS_REQUIRED"> {
  override readonly name = "SERVER_SEED_HASH_IS_REQUIRED" as const;

  constructor() {
    super("Server seed hash is required");
  }
}

export class ProvablyFairStrategyIdIsRequiredError extends DomainError<"PROVABLY_FAIR_STRATEGY_ID_IS_REQUIRED"> {
  override readonly name = "PROVABLY_FAIR_STRATEGY_ID_IS_REQUIRED" as const;

  constructor() {
    super("Provably fair strategy id is required");
  }
}

export class ProvablyFairNonceIsRequiredError extends DomainError<"PROVABLY_FAIR_NONCE_IS_REQUIRED"> {
  override readonly name = "PROVABLY_FAIR_NONCE_IS_REQUIRED" as const;

  constructor() {
    super("Provably fair nonce is required");
  }
}

export class RoundProvablyFairStrategyDefinitionMismatchError extends DomainError<"ROUND_PROVABLY_FAIR_STRATEGY_DEFINITION_MISMATCH"> {
  override readonly name =
    "ROUND_PROVABLY_FAIR_STRATEGY_DEFINITION_MISMATCH" as const;

  constructor() {
    super("Round provably fair strategy definition does not match the round strategy id");
  }
}

export class CrashPointMustBeGreaterThanOneError extends DomainError<"CRASH_POINT_MUST_BE_GREATER_THAN_ONE"> {
  override readonly name = "CRASH_POINT_MUST_BE_GREATER_THAN_ONE" as const;

  constructor() {
    super("Crash point must be greater than 1");
  }
}

export class BettingCloseTimeMustBeAfterCreationTimeError extends DomainError<"BETTING_CLOSE_TIME_MUST_BE_AFTER_CREATION_TIME"> {
  override readonly name =
    "BETTING_CLOSE_TIME_MUST_BE_AFTER_CREATION_TIME" as const;

  constructor() {
    super("Betting close time must be after creation time");
  }
}

export class RoundStartTimeMustBeAfterBettingCloseTimeError extends DomainError<"ROUND_START_TIME_MUST_BE_AFTER_BETTING_CLOSE_TIME"> {
  override readonly name =
    "ROUND_START_TIME_MUST_BE_AFTER_BETTING_CLOSE_TIME" as const;

  constructor() {
    super("Round start time must be after betting close time");
  }
}

export class ActiveRoundsMustHaveABettingCloseTimeError extends DomainError<"ACTIVE_ROUNDS_MUST_HAVE_A_BETTING_CLOSE_TIME"> {
  override readonly name =
    "ACTIVE_ROUNDS_MUST_HAVE_A_BETTING_CLOSE_TIME" as const;

  constructor() {
    super("Active rounds beyond waiting state must have a betting close time");
  }
}

export class ActiveRoundsMustHaveAScheduledStartTimeError extends DomainError<"ACTIVE_ROUNDS_MUST_HAVE_A_SCHEDULED_START_TIME"> {
  override readonly name =
    "ACTIVE_ROUNDS_MUST_HAVE_A_SCHEDULED_START_TIME" as const;

  constructor() {
    super("Active rounds beyond waiting state must have a scheduled start time");
  }
}

export class ActiveRoundsMustHaveAScheduledCrashTimeError extends DomainError<"ACTIVE_ROUNDS_MUST_HAVE_A_SCHEDULED_CRASH_TIME"> {
  override readonly name =
    "ACTIVE_ROUNDS_MUST_HAVE_A_SCHEDULED_CRASH_TIME" as const;

  constructor() {
    super("Active rounds beyond waiting state must have a scheduled crash time");
  }
}

export class ActiveRoundsMustHaveASettleTimeError extends DomainError<"ACTIVE_ROUNDS_MUST_HAVE_A_SETTLE_TIME"> {
  override readonly name = "ACTIVE_ROUNDS_MUST_HAVE_A_SETTLE_TIME" as const;

  constructor() {
    super("Active rounds beyond waiting state must have a settle time");
  }
}

export class ScheduledCrashTimeMustBeAtOrAfterRoundStartTimeError extends DomainError<"SCHEDULED_CRASH_TIME_MUST_BE_AT_OR_AFTER_ROUND_START_TIME"> {
  override readonly name =
    "SCHEDULED_CRASH_TIME_MUST_BE_AT_OR_AFTER_ROUND_START_TIME" as const;

  constructor() {
    super("Scheduled crash time must be at or after round start time");
  }
}

export class RoundSettleTimeMustBeAtOrAfterScheduledCrashTimeError extends DomainError<"ROUND_SETTLE_TIME_MUST_BE_AT_OR_AFTER_SCHEDULED_CRASH_TIME"> {
  override readonly name =
    "ROUND_SETTLE_TIME_MUST_BE_AT_OR_AFTER_SCHEDULED_CRASH_TIME" as const;

  constructor() {
    super("Round settle time must be at or after scheduled crash time");
  }
}

export class StartedRoundsMustHaveAStartTimeError extends DomainError<"STARTED_ROUNDS_MUST_HAVE_A_START_TIME"> {
  override readonly name = "STARTED_ROUNDS_MUST_HAVE_A_START_TIME" as const;

  constructor() {
    super("Started rounds must have a start time");
  }
}

export class RoundsWithStartedStateMustHaveAScheduledStartTimeError extends DomainError<"ROUNDS_WITH_STARTED_STATE_MUST_HAVE_A_SCHEDULED_START_TIME"> {
  override readonly name =
    "ROUNDS_WITH_STARTED_STATE_MUST_HAVE_A_SCHEDULED_START_TIME" as const;

  constructor() {
    super("Rounds with started state must have a scheduled start time");
  }
}

export class RoundsWithStartedStateMustHaveAScheduledCrashTimeError extends DomainError<"ROUNDS_WITH_STARTED_STATE_MUST_HAVE_A_SCHEDULED_CRASH_TIME"> {
  override readonly name =
    "ROUNDS_WITH_STARTED_STATE_MUST_HAVE_A_SCHEDULED_CRASH_TIME" as const;

  constructor() {
    super("Rounds with started state must have a scheduled crash time");
  }
}

export class RoundsWithStartedStateMustHaveASettleTimeError extends DomainError<"ROUNDS_WITH_STARTED_STATE_MUST_HAVE_A_SETTLE_TIME"> {
  override readonly name =
    "ROUNDS_WITH_STARTED_STATE_MUST_HAVE_A_SETTLE_TIME" as const;

  constructor() {
    super("Rounds with started state must have a settle time");
  }
}

export class CrashedOrSettledRoundsMustHaveACrashTimeError extends DomainError<"CRASHED_OR_SETTLED_ROUNDS_MUST_HAVE_A_CRASH_TIME"> {
  override readonly name =
    "CRASHED_OR_SETTLED_ROUNDS_MUST_HAVE_A_CRASH_TIME" as const;

  constructor() {
    super("Crashed or settled rounds must have a crash time");
  }
}

export class CrashedOrSettledRoundsMustHaveACrashMultiplierError extends DomainError<"CRASHED_OR_SETTLED_ROUNDS_MUST_HAVE_A_CRASH_MULTIPLIER"> {
  override readonly name =
    "CRASHED_OR_SETTLED_ROUNDS_MUST_HAVE_A_CRASH_MULTIPLIER" as const;

  constructor() {
    super("Crashed or settled rounds must have a crash multiplier");
  }
}

export class ErroredRoundsMustHaveAFailureTimeError extends DomainError<"ERRORED_ROUNDS_MUST_HAVE_A_FAILURE_TIME"> {
  override readonly name = "ERRORED_ROUNDS_MUST_HAVE_A_FAILURE_TIME" as const;

  constructor() {
    super("Errored rounds must have a failure time");
  }
}

export class ErroredRoundsMustHaveAnErrorReasonError extends DomainError<"ERRORED_ROUNDS_MUST_HAVE_AN_ERROR_REASON"> {
  override readonly name =
    "ERRORED_ROUNDS_MUST_HAVE_AN_ERROR_REASON" as const;

  constructor() {
    super("Errored rounds must have an error reason");
  }
}

export class ErroredRoundsMustRequireARefundError extends DomainError<"ERRORED_ROUNDS_MUST_REQUIRE_A_REFUND"> {
  override readonly name = "ERRORED_ROUNDS_MUST_REQUIRE_A_REFUND" as const;

  constructor() {
    super("Errored rounds must require a refund");
  }
}

export type RoundDomainError =
  | BettingWindowMustBeGreaterThanZeroError
  | StartDelayCannotBeNegativeError
  | CrashRevealCannotBeNegativeError
  | RoundDurationCannotBeNegativeError
  | RoundCanOnlyCloseBettingFromBettingOpenError
  | RoundCanOnlyOpenBettingFromWaitingForFirstBetError
  | BettingCannotOpenBeforeRoundCreationError
  | BettingCannotCloseBeforeRoundCreationError
  | RoundCanOnlyStartFromBettingClosedError
  | RoundCannotStartBeforeCreationError
  | RoundCannotStartBeforeScheduledStartTimeError
  | RoundCanOnlyCrashFromInProgressError
  | RoundCannotCrashBeforeItStartsError
  | RoundCannotCrashBeforeScheduledCrashTimeError
  | RoundCanOnlyFailFromANonTerminalStatusError
  | ErrorReasonIsRequiredError
  | RoundCannotFailBeforeCreationError
  | RoundCannotFailBeforeItStartsError
  | RoundCannotFailBeforeItCrashesError
  | RoundCanOnlySettleFromCrashedStatusError
  | RoundCannotSettleBeforeScheduledSettleTimeError
  | RoundIdIsRequiredError
  | RoundVersionMustBeGreaterThanZeroError
  | ServerSeedIsRequiredError
  | ServerSeedHashIsRequiredError
  | ProvablyFairStrategyIdIsRequiredError
  | ProvablyFairNonceIsRequiredError
  | RoundProvablyFairStrategyDefinitionMismatchError
  | CrashPointMustBeGreaterThanOneError
  | BettingCloseTimeMustBeAfterCreationTimeError
  | RoundStartTimeMustBeAfterBettingCloseTimeError
  | ActiveRoundsMustHaveABettingCloseTimeError
  | ActiveRoundsMustHaveAScheduledStartTimeError
  | ActiveRoundsMustHaveAScheduledCrashTimeError
  | ActiveRoundsMustHaveASettleTimeError
  | ScheduledCrashTimeMustBeAtOrAfterRoundStartTimeError
  | RoundSettleTimeMustBeAtOrAfterScheduledCrashTimeError
  | StartedRoundsMustHaveAStartTimeError
  | RoundsWithStartedStateMustHaveAScheduledStartTimeError
  | RoundsWithStartedStateMustHaveAScheduledCrashTimeError
  | RoundsWithStartedStateMustHaveASettleTimeError
  | CrashedOrSettledRoundsMustHaveACrashTimeError
  | CrashedOrSettledRoundsMustHaveACrashMultiplierError
  | ErroredRoundsMustHaveAFailureTimeError
  | ErroredRoundsMustHaveAnErrorReasonError
  | ErroredRoundsMustRequireARefundError;

export type RoundResult<T = undefined> =
  | {
      success: true;
      error?: undefined;
      data?: T;
    }
  | {
      success: false;
      error: RoundDomainError;
      data?: undefined;
    };
