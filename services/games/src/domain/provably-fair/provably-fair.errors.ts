export abstract class ProvablyFairDomainError<
  TName extends string,
> extends Error {
  abstract override readonly name: TName;

  protected constructor(message: string) {
    super(message);
  }
}

export class ProvablyFairStrategyIdIsRequiredError extends ProvablyFairDomainError<"PROVABLY_FAIR_STRATEGY_ID_IS_REQUIRED"> {
  override readonly name = "PROVABLY_FAIR_STRATEGY_ID_IS_REQUIRED" as const;

  constructor() {
    super("Provably fair strategy id is required");
  }
}

export class ProvablyFairAlgorithmIsRequiredError extends ProvablyFairDomainError<"PROVABLY_FAIR_ALGORITHM_IS_REQUIRED"> {
  override readonly name = "PROVABLY_FAIR_ALGORITHM_IS_REQUIRED" as const;

  constructor() {
    super("Provably fair algorithm is required");
  }
}

export class ProvablyFairVersionIsRequiredError extends ProvablyFairDomainError<"PROVABLY_FAIR_VERSION_IS_REQUIRED"> {
  override readonly name = "PROVABLY_FAIR_VERSION_IS_REQUIRED" as const;

  constructor() {
    super("Provably fair version is required");
  }
}

export class ProvablyFairDisplayNameIsRequiredError extends ProvablyFairDomainError<"PROVABLY_FAIR_DISPLAY_NAME_IS_REQUIRED"> {
  override readonly name = "PROVABLY_FAIR_DISPLAY_NAME_IS_REQUIRED" as const;

  constructor() {
    super("Provably fair display name is required");
  }
}

export class ProvablyFairDescriptionIsRequiredError extends ProvablyFairDomainError<"PROVABLY_FAIR_DESCRIPTION_IS_REQUIRED"> {
  override readonly name = "PROVABLY_FAIR_DESCRIPTION_IS_REQUIRED" as const;

  constructor() {
    super("Provably fair description is required");
  }
}

export class ProvablyFairHashAlgorithmIsRequiredError extends ProvablyFairDomainError<"PROVABLY_FAIR_HASH_ALGORITHM_IS_REQUIRED"> {
  override readonly name =
    "PROVABLY_FAIR_HASH_ALGORITHM_IS_REQUIRED" as const;

  constructor() {
    super("Provably fair hash algorithm is required");
  }
}

export class ProvablyFairOutcomeAlgorithmIsRequiredError extends ProvablyFairDomainError<"PROVABLY_FAIR_OUTCOME_ALGORITHM_IS_REQUIRED"> {
  override readonly name =
    "PROVABLY_FAIR_OUTCOME_ALGORITHM_IS_REQUIRED" as const;

  constructor() {
    super("Provably fair outcome algorithm is required");
  }
}

export class ProvablyFairHouseEdgeDescriptionIsRequiredError extends ProvablyFairDomainError<"PROVABLY_FAIR_HOUSE_EDGE_DESCRIPTION_IS_REQUIRED"> {
  override readonly name =
    "PROVABLY_FAIR_HOUSE_EDGE_DESCRIPTION_IS_REQUIRED" as const;

  constructor() {
    super("Provably fair house edge description is required");
  }
}

export class ProvablyFairVerificationFormulaIsRequiredError extends ProvablyFairDomainError<"PROVABLY_FAIR_VERIFICATION_FORMULA_IS_REQUIRED"> {
  override readonly name =
    "PROVABLY_FAIR_VERIFICATION_FORMULA_IS_REQUIRED" as const;

  constructor() {
    super("Provably fair verification formula is required");
  }
}

export class ProvablyFairVerificationStepsAreRequiredError extends ProvablyFairDomainError<"PROVABLY_FAIR_VERIFICATION_STEPS_ARE_REQUIRED"> {
  override readonly name =
    "PROVABLY_FAIR_VERIFICATION_STEPS_ARE_REQUIRED" as const;

  constructor() {
    super("Provably fair verification steps are required");
  }
}

export type ProvablyFairDomainDefinitionError =
  | ProvablyFairStrategyIdIsRequiredError
  | ProvablyFairAlgorithmIsRequiredError
  | ProvablyFairVersionIsRequiredError
  | ProvablyFairDisplayNameIsRequiredError
  | ProvablyFairDescriptionIsRequiredError
  | ProvablyFairHashAlgorithmIsRequiredError
  | ProvablyFairOutcomeAlgorithmIsRequiredError
  | ProvablyFairHouseEdgeDescriptionIsRequiredError
  | ProvablyFairVerificationFormulaIsRequiredError
  | ProvablyFairVerificationStepsAreRequiredError;

export type ProvablyFairResult<T = undefined> =
  | {
      success: true;
      error?: undefined;
      data?: T;
    }
  | {
      success: false;
      error: ProvablyFairDomainDefinitionError;
      data?: undefined;
    };
