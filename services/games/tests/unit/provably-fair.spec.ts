/// <reference types="bun-types" />

import { describe, expect, it } from "bun:test";

import { CasinoCrashProvablyFairStrategy } from "../../src/domain/provably-fair/casino-crash-provably-fair.strategy";
import { ProvablyFairStrategyDefinition } from "../../src/domain/provably-fair/provably-fair-strategy-definition";

const STRATEGY_ID = "casino-crash-v1";
const STRATEGY_ALGORITHM = "crash-hmac-sha256-v1";
const STRATEGY_VERSION = "1.0.0";
const STRATEGY_DISPLAY_NAME = "Casino Crash HMAC-SHA256";
const STRATEGY_DESCRIPTION =
  "Versioned public definition for a crash strategy.";
const STRATEGY_HASH_ALGORITHM = "SHA-256(serverSeed)";
const STRATEGY_OUTCOME_ALGORITHM = "HMAC-SHA256(serverSeed, nonce)";
const STRATEGY_HOUSE_EDGE_DESCRIPTION =
  "If the full HMAC digest interpreted as hexadecimal is divisible by 101, the result is 1.00.";
const STRATEGY_VERIFICATION_FORMULA =
  "Otherwise take the first 13 hex characters of the HMAC digest and compute the crash point formula.";
const UNSORTED_VERIFICATION_STEPS = [
  {
    order: 2,
    instruction: "Compute the round HMAC digest.",
  },
  {
    order: 1,
    instruction: "Verify the published server seed hash.",
  },
] as const;
const SORTED_VERIFICATION_STEPS = [
  {
    order: 1,
    instruction: "Verify the published server seed hash.",
  },
  {
    order: 2,
    instruction: "Compute the round HMAC digest.",
  },
] as const;
const SERVER_SEED = "server-seed-1";
const NONCE = "round-1";
const INSTANT_BUST_NONCE = "round-8";
const EXPECTED_SERVER_SEED_HASH =
  "a562d93d4bf3b40f7d2ed81c4c43334cc714f2d7d11691a1bec023153998f2e2";
const EXPECTED_CRASH_POINT = 7.38;

function assertSuccess<T>(result: { success: boolean; data?: T; error?: Error }): T {
  expect(result.success).toBe(true);

  if (!result.success) {
    throw result.error;
  }

  return result.data!;
}

function createStrategyDefinition() {
  return ProvablyFairStrategyDefinition.create({
    id: STRATEGY_ID,
    algorithm: STRATEGY_ALGORITHM,
    version: STRATEGY_VERSION,
    displayName: STRATEGY_DISPLAY_NAME,
    description: STRATEGY_DESCRIPTION,
    hashAlgorithm: STRATEGY_HASH_ALGORITHM,
    outcomeAlgorithm: STRATEGY_OUTCOME_ALGORITHM,
    houseEdgeDescription: STRATEGY_HOUSE_EDGE_DESCRIPTION,
    verificationFormula: STRATEGY_VERIFICATION_FORMULA,
    verificationSteps: [...UNSORTED_VERIFICATION_STEPS],
  });
}

describe("ProvablyFairStrategyDefinition", () => {
  it("creates a valid versioned strategy definition and sorts verification steps", () => {
    const definition = assertSuccess(createStrategyDefinition());

    expect(definition.id).toBe(STRATEGY_ID);
    expect(definition.algorithm).toBe(STRATEGY_ALGORITHM);
    expect(definition.version).toBe(STRATEGY_VERSION);
    expect(definition.displayName).toBe(STRATEGY_DISPLAY_NAME);
    expect(definition.description).toBe(STRATEGY_DESCRIPTION);
    expect(definition.hashAlgorithm).toBe(STRATEGY_HASH_ALGORITHM);
    expect(definition.outcomeAlgorithm).toBe(STRATEGY_OUTCOME_ALGORITHM);
    expect(definition.houseEdgeDescription).toBe(
      STRATEGY_HOUSE_EDGE_DESCRIPTION,
    );
    expect(definition.verificationFormula).toBe(
      STRATEGY_VERIFICATION_FORMULA,
    );
    expect(definition.verificationSteps).toEqual([
      ...SORTED_VERIFICATION_STEPS,
    ]);
  });

  it("rejects a definition without verification steps", () => {
    const result = ProvablyFairStrategyDefinition.create({
      id: STRATEGY_ID,
      algorithm: STRATEGY_ALGORITHM,
      version: STRATEGY_VERSION,
      displayName: STRATEGY_DISPLAY_NAME,
      description: STRATEGY_DESCRIPTION,
      hashAlgorithm: STRATEGY_HASH_ALGORITHM,
      outcomeAlgorithm: STRATEGY_OUTCOME_ALGORITHM,
      houseEdgeDescription: STRATEGY_HOUSE_EDGE_DESCRIPTION,
      verificationFormula: STRATEGY_VERIFICATION_FORMULA,
      verificationSteps: [],
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error("expected failure");
    }

    expect(result.error.name).toBe(
      "PROVABLY_FAIR_VERIFICATION_STEPS_ARE_REQUIRED",
    );
  });
});

describe("CasinoCrashProvablyFairStrategy", () => {
  it("publishes a versioned definition", () => {
    const strategy = new CasinoCrashProvablyFairStrategy();

    expect(strategy.definition.id).toBe(STRATEGY_ID);
    expect(strategy.definition.algorithm).toBe(STRATEGY_ALGORITHM);
    expect(strategy.definition.version).toBe(STRATEGY_VERSION);
  });

  it("creates a deterministic seed commitment", () => {
    const strategy = new CasinoCrashProvablyFairStrategy();

    expect(strategy.commit(SERVER_SEED)).toEqual({
      strategyId: STRATEGY_ID,
      serverSeedHash: EXPECTED_SERVER_SEED_HASH,
    });
  });

  it("generates the same crash point for the same inputs", () => {
    const strategy = new CasinoCrashProvablyFairStrategy();

    expect(
      strategy.generate({
        serverSeed: SERVER_SEED,
        nonce: NONCE,
      }),
    ).toEqual({
      strategyId: STRATEGY_ID,
      serverSeedHash: EXPECTED_SERVER_SEED_HASH,
      crashPoint: EXPECTED_CRASH_POINT,
    });
  });

  it("changes the outcome when the nonce changes", () => {
    const strategy = new CasinoCrashProvablyFairStrategy();

    const originalOutcome = strategy.generate({
      serverSeed: SERVER_SEED,
      nonce: NONCE,
    });
    const changedNonceOutcome = strategy.generate({
      serverSeed: SERVER_SEED,
      nonce: "round-2",
    });

    expect(changedNonceOutcome.crashPoint).not.toBe(originalOutcome.crashPoint);
  });

  it("verifies the expected crash point and rejects a tampered one", () => {
    const strategy = new CasinoCrashProvablyFairStrategy();

    expect(
      strategy.verify(
        {
          serverSeed: SERVER_SEED,
          nonce: NONCE,
        },
        EXPECTED_CRASH_POINT,
      ),
    ).toBe(true);

    expect(
      strategy.verify(
        {
          serverSeed: SERVER_SEED,
          nonce: NONCE,
        },
        EXPECTED_CRASH_POINT + 0.01,
      ),
    ).toBe(false);
  });

  it("returns an instant bust when the digest hits the house edge rule", () => {
    const strategy = new CasinoCrashProvablyFairStrategy();

    expect(
      strategy.generate({
        serverSeed: SERVER_SEED,
        nonce: INSTANT_BUST_NONCE,
      }),
    ).toEqual({
      strategyId: STRATEGY_ID,
      serverSeedHash: EXPECTED_SERVER_SEED_HASH,
      crashPoint: 1,
    });
  });
});
