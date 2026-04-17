import { defineEntity, type InferEntity, p } from "@mikro-orm/core";

export type PersistedProvablyFairVerificationStep = {
  order: number;
  instruction: string;
};

export type CreateProvablyFairStrategyDefinitionSnapshotRecordProps = {
  id: string;
  strategyId: string;
  algorithm: string;
  version: string;
  displayName: string;
  description: string;
  hashAlgorithm: string;
  outcomeAlgorithm: string;
  houseEdgeDescription: string;
  verificationFormula: string;
  verificationSteps: PersistedProvablyFairVerificationStep[];
  createdAt?: Date;
};

export type ProvablyFairStrategyDefinitionSnapshotRecord = {
  id: string;
  strategyId: string;
  algorithm: string;
  version: string;
  displayName: string;
  description: string;
  hashAlgorithm: string;
  outcomeAlgorithm: string;
  houseEdgeDescription: string;
  verificationFormula: string;
  verificationSteps: PersistedProvablyFairVerificationStep[];
  createdAt: Date;
};

export function createProvablyFairStrategyDefinitionSnapshotRecord(
  props: CreateProvablyFairStrategyDefinitionSnapshotRecordProps,
): ProvablyFairStrategyDefinitionSnapshotRecord {
  const verificationSteps = props.verificationSteps
    .map((step, index) => ({
      order: Number.isInteger(step.order) && step.order > 0 ? step.order : index + 1,
      instruction: normalizeRequiredString(
        step.instruction,
        `verificationSteps[${index}].instruction`,
      ),
    }))
    .sort((left, right) => left.order - right.order);

  if (verificationSteps.length === 0) {
    throw new Error("verificationSteps must contain at least one step");
  }

  return {
    id: normalizeRequiredString(props.id, "id"),
    strategyId: normalizeRequiredString(props.strategyId, "strategyId"),
    algorithm: normalizeRequiredString(props.algorithm, "algorithm"),
    version: normalizeRequiredString(props.version, "version"),
    displayName: normalizeRequiredString(props.displayName, "displayName"),
    description: normalizeRequiredString(props.description, "description"),
    hashAlgorithm: normalizeRequiredString(props.hashAlgorithm, "hashAlgorithm"),
    outcomeAlgorithm: normalizeRequiredString(
      props.outcomeAlgorithm,
      "outcomeAlgorithm",
    ),
    houseEdgeDescription: normalizeRequiredString(
      props.houseEdgeDescription,
      "houseEdgeDescription",
    ),
    verificationFormula: normalizeRequiredString(
      props.verificationFormula,
      "verificationFormula",
    ),
    verificationSteps,
    createdAt: cloneDate(props.createdAt ?? new Date()),
  };
}

export const ProvablyFairStrategyDefinitionSchema = defineEntity({
  name: "ProvablyFairStrategyDefinitionSnapshot",
  tableName: "provably_fair_strategy_definitions",
  indexes: [
    {
      name: "provably_fair_strategy_definitions_strategy_id_created_at_index",
      properties: ["strategyId", "createdAt"],
    },
  ],
  uniques: [
    {
      name: "provably_fair_strategy_definitions_strategy_id_version_unique",
      properties: ["strategyId", "version"],
    },
  ],
  properties: {
    id: p.text().primary(),
    strategyId: p
      .text()
      .fieldName("strategy_id")
      .check("length(trim(strategy_id)) > 0"),
    algorithm: p.text().check("length(trim(algorithm)) > 0"),
    version: p.text().check("length(trim(version)) > 0"),
    displayName: p
      .text()
      .fieldName("display_name")
      .check("length(trim(display_name)) > 0"),
    description: p.text().check("length(trim(description)) > 0"),
    hashAlgorithm: p
      .text()
      .fieldName("hash_algorithm")
      .check("length(trim(hash_algorithm)) > 0"),
    outcomeAlgorithm: p
      .text()
      .fieldName("outcome_algorithm")
      .check("length(trim(outcome_algorithm)) > 0"),
    houseEdgeDescription: p
      .text()
      .fieldName("house_edge_description")
      .check("length(trim(house_edge_description)) > 0"),
    verificationFormula: p
      .text()
      .fieldName("verification_formula")
      .check("length(trim(verification_formula)) > 0"),
    verificationSteps: p
      .json()
      .fieldName("verification_steps")
      .columnType("jsonb"),
    createdAt: p
      .datetime()
      .fieldName("created_at")
      .columnType("timestamptz")
      .onCreate(() => new Date()),
  },
});

export type IProvablyFairStrategyDefinitionSnapshot = InferEntity<
  typeof ProvablyFairStrategyDefinitionSchema
>;

function normalizeRequiredString(value: string, fieldName: string): string {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    throw new Error(`${fieldName} is required`);
  }

  return normalizedValue;
}

function cloneDate(value: Date): Date {
  return new Date(value);
}
