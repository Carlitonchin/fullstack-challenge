import { CasinoCrashProvablyFairStrategy } from "../../src/domain/provably-fair/casino-crash-provably-fair.strategy";
import { ProvablyFairStrategyDefinitionRepository } from "../../src/infrastructure/repository/provably-fair-strategy-definition.repository";
import { describe, expect, it } from "bun:test";

describe("ProvablyFairStrategyDefinitionRepository", () => {
  it("returns the current strategy ordering by createdAt descending", async () => {
    const strategy = new CasinoCrashProvablyFairStrategy();
    const definition = strategy.definition;
    const em = {
      find: async () => [
        {
          id: definition.id,
          algorithm: definition.algorithm,
          displayName: definition.displayName,
          description: definition.description,
          hashAlgorithm: definition.hashAlgorithm,
          outcomeAlgorithm: definition.outcomeAlgorithm,
          houseEdgeDescription: definition.houseEdgeDescription,
          verificationFormula: definition.verificationFormula,
          verificationSteps: definition.verificationSteps,
          createdAt: new Date("2026-04-17T00:00:00.000Z"),
        },
      ],
    };
    const repository = new ProvablyFairStrategyDefinitionRepository(em as never);

    const result = await repository.findCurrentStrategy();

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.data).toBeDefined();
    expect(result.data?.id).toBe(definition.id);
    expect(result.data?.verificationSteps).toEqual(definition.verificationSteps);
  });

  it("persists a snapshot record and returns the definition", async () => {
    const strategy = new CasinoCrashProvablyFairStrategy();
    const persistedEntities: unknown[] = [];
    const em = {
      findOne: async () => null,
      create: (_schema: unknown, entity: unknown) => entity,
      persist: (entity: unknown) => {
        persistedEntities.push(entity);
      },
    };
    const repository = new ProvablyFairStrategyDefinitionRepository(em as never);

    const result = await repository.persist({
      definition: strategy.definition,
      createdAt: new Date("2026-04-18T00:00:00.000Z"),
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.data).toBe(strategy.definition);
    expect(persistedEntities).toHaveLength(1);
    expect(persistedEntities[0]).toEqual(
      expect.objectContaining({
        id: strategy.definition.id,
        createdAt: new Date("2026-04-18T00:00:00.000Z"),
      }),
    );
  });
});
