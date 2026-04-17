import * as ProvablyFairErrors from "./provably-fair.errors";

export type ProvablyFairVerificationStep = {
  order: number;
  instruction: string;
};

type ProvablyFairStrategyDefinitionProps = {
  id: string;
  algorithm: string;
  displayName: string;
  description: string;
  hashAlgorithm: string;
  outcomeAlgorithm: string;
  houseEdgeDescription: string;
  verificationFormula: string;
  verificationSteps: ProvablyFairVerificationStep[];
};

export class ProvablyFairStrategyDefinition {
  private readonly _id: string;
  private readonly _algorithm: string;
  private readonly _displayName: string;
  private readonly _description: string;
  private readonly _hashAlgorithm: string;
  private readonly _outcomeAlgorithm: string;
  private readonly _houseEdgeDescription: string;
  private readonly _verificationFormula: string;
  private readonly _verificationSteps: ProvablyFairVerificationStep[];

  private constructor(props: ProvablyFairStrategyDefinitionProps) {
    this._id = props.id;
    this._algorithm = props.algorithm;
    this._displayName = props.displayName;
    this._description = props.description;
    this._hashAlgorithm = props.hashAlgorithm;
    this._outcomeAlgorithm = props.outcomeAlgorithm;
    this._houseEdgeDescription = props.houseEdgeDescription;
    this._verificationFormula = props.verificationFormula;
    this._verificationSteps = props.verificationSteps.map((step) => ({
      order: step.order,
      instruction: step.instruction,
    }));
  }

  static create(
    props: ProvablyFairStrategyDefinitionProps,
  ): ProvablyFairErrors.ProvablyFairResult<ProvablyFairStrategyDefinition> {
    const trimmedVerificationSteps = props.verificationSteps.filter((step) =>
      step.instruction.trim(),
    );

    if (!props.id.trim()) {
      return ProvablyFairStrategyDefinition.failure(
        new ProvablyFairErrors.ProvablyFairStrategyIdIsRequiredError(),
      );
    }

    if (!props.algorithm.trim()) {
      return ProvablyFairStrategyDefinition.failure(
        new ProvablyFairErrors.ProvablyFairAlgorithmIsRequiredError(),
      );
    }

    if (!props.displayName.trim()) {
      return ProvablyFairStrategyDefinition.failure(
        new ProvablyFairErrors.ProvablyFairDisplayNameIsRequiredError(),
      );
    }

    if (!props.description.trim()) {
      return ProvablyFairStrategyDefinition.failure(
        new ProvablyFairErrors.ProvablyFairDescriptionIsRequiredError(),
      );
    }

    if (!props.hashAlgorithm.trim()) {
      return ProvablyFairStrategyDefinition.failure(
        new ProvablyFairErrors.ProvablyFairHashAlgorithmIsRequiredError(),
      );
    }

    if (!props.outcomeAlgorithm.trim()) {
      return ProvablyFairStrategyDefinition.failure(
        new ProvablyFairErrors.ProvablyFairOutcomeAlgorithmIsRequiredError(),
      );
    }

    if (!props.houseEdgeDescription.trim()) {
      return ProvablyFairStrategyDefinition.failure(
        new ProvablyFairErrors.ProvablyFairHouseEdgeDescriptionIsRequiredError(),
      );
    }

    if (!props.verificationFormula.trim()) {
      return ProvablyFairStrategyDefinition.failure(
        new ProvablyFairErrors.ProvablyFairVerificationFormulaIsRequiredError(),
      );
    }

    if (trimmedVerificationSteps.length === 0) {
      return ProvablyFairStrategyDefinition.failure(
        new ProvablyFairErrors.ProvablyFairVerificationStepsAreRequiredError(),
      );
    }

    const sortedVerificationSteps = trimmedVerificationSteps
      .map((step, index) => ({
        order: step.order || index + 1,
        instruction: step.instruction.trim(),
      }))
      .sort((left, right) => left.order - right.order);

    return ProvablyFairStrategyDefinition.success(
      new ProvablyFairStrategyDefinition({
        ...props,
        id: props.id.trim(),
        algorithm: props.algorithm.trim(),
        displayName: props.displayName.trim(),
        description: props.description.trim(),
        hashAlgorithm: props.hashAlgorithm.trim(),
        outcomeAlgorithm: props.outcomeAlgorithm.trim(),
        houseEdgeDescription: props.houseEdgeDescription.trim(),
        verificationFormula: props.verificationFormula.trim(),
        verificationSteps: sortedVerificationSteps,
      }),
    );
  }

  get id(): string {
    return this._id;
  }

  get algorithm(): string {
    return this._algorithm;
  }

  get displayName(): string {
    return this._displayName;
  }

  get description(): string {
    return this._description;
  }

  get hashAlgorithm(): string {
    return this._hashAlgorithm;
  }

  get outcomeAlgorithm(): string {
    return this._outcomeAlgorithm;
  }

  get houseEdgeDescription(): string {
    return this._houseEdgeDescription;
  }

  get verificationFormula(): string {
    return this._verificationFormula;
  }

  get verificationSteps(): ProvablyFairVerificationStep[] {
    return this._verificationSteps.map((step) => ({ ...step }));
  }

  private static success<T>(
    data?: T,
  ): ProvablyFairErrors.ProvablyFairResult<T> {
    return {
      success: true,
      data,
    };
  }

  private static failure(
    error: ProvablyFairErrors.ProvablyFairDomainDefinitionError,
  ): ProvablyFairErrors.ProvablyFairResult {
    return {
      success: false,
      error,
    };
  }
}
