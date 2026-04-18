/// <reference types="bun-types" />

import { describe, expect, it } from "bun:test";
import { InternalServerErrorException } from "@nestjs/common";

import { GameQueryService } from "../../src/application/game-query.service";
import { Bet } from "../../src/domain/bet/bet";
import { BetAmount } from "../../src/domain/bet/bet-amount";
import { CasinoCrashProvablyFairStrategy } from "../../src/domain/provably-fair/casino-crash-provably-fair.strategy";
import { ProvablyFairStrategyDefinition } from "../../src/domain/provably-fair/provably-fair-strategy-definition";
import { Round } from "../../src/domain/round/round";
import { LogarithmicRoundTimingStrategy } from "../../src/domain/round/round-timing.strategy";
import type { IBetRepository } from "../../src/port/bet.repository";
import type { IProvablyFairStrategyDefinitionRepository } from "../../src/port/provably-fair-strategy-definition.repository";
import type { IRoundRepository } from "../../src/port/round.repository";

const CREATED_AT = new Date("2026-04-18T12:00:00.000Z");
const PREVIOUS_CREATED_AT = new Date("2026-04-18T11:58:00.000Z");

function assertSuccess<T>(result: { success: boolean; data?: T; error?: Error }): T {
  expect(result.success).toBe(true);

  if (!result.success) {
    throw result.error;
  }

  return result.data!;
}

function createStrategyDefinition(id = "casino-crash-v1") {
  return assertSuccess(
    ProvablyFairStrategyDefinition.create({
      id,
      algorithm: "crash-hmac-sha256-v1",
      displayName: "Casino Crash HMAC-SHA256",
      description: "Crash point generation with a committed server seed.",
      hashAlgorithm: "SHA-256(serverSeed)",
      outcomeAlgorithm: "HMAC-SHA256(serverSeed, nonce)",
      houseEdgeDescription: "Instant bust when the digest is divisible by 101.",
      verificationFormula:
        "Otherwise take the first 13 hex characters and compute the public crash formula.",
      verificationSteps: [
        {
          order: 1,
          instruction: "Compute SHA-256(serverSeed) and compare it with serverSeedHash.",
        },
        {
          order: 2,
          instruction: "Compute HMAC-SHA256(serverSeed, nonce) and derive the crash point.",
        },
      ],
    }),
  );
}

function createRound(params: {
  id: string;
  createdAt: Date;
  strategy: CasinoCrashProvablyFairStrategy;
  serverSeed: string;
  crashAt?: Date;
}) {
  const commitment = params.strategy.commit(params.serverSeed);
  const outcome = params.strategy.generate({
    serverSeed: params.serverSeed,
    nonce: params.id,
  });

  const round = assertSuccess(
    Round.new({
      id: params.id,
      crashPoint: outcome.crashPoint,
      provablyFairStrategyId: params.strategy.definition.id,
      nonce: params.id,
      serverSeedHash: commitment.serverSeedHash,
      serverSeed: params.serverSeed,
      createdAt: params.createdAt,
      bettingWindowInSeconds: 10,
      startDelayInMs: 5_000,
      roundDurationInMs: 2_000,
      crashRevealInMs: 1_000,
    }),
  );

  round.pullDomainEvents();

  if (params.crashAt) {
    assertSuccess(
      round.openBettingFromFirstAcceptedBet({
        openedAt: params.createdAt,
        bettingWindowInSeconds: 10,
        startDelayInMs: 5_000,
        roundDurationInMs: 2_000,
        crashRevealInMs: 1_000,
      }),
    );
    assertSuccess(round.closeBetting(new Date(params.createdAt.getTime() + 10_000)));
    assertSuccess(round.start(new Date(params.createdAt.getTime() + 15_000)));
    assertSuccess(round.crash(params.crashAt));
    assertSuccess(round.settle(new Date(params.crashAt.getTime() + 1_000)));
    round.pullDomainEvents();
  }

  return round;
}

function createAcceptedBet(roundId: string): Bet {
  const amount = assertSuccess(
    BetAmount.create({
      amountInCents: 2_500,
      currency: "BRL",
    }),
  );

  const bet = assertSuccess(
    Bet.new({
      id: "bet-1",
      roundId,
      playerId: "player-1",
      playerUsername: "player",
      amount,
      createdAt: CREATED_AT,
    }),
  );

  bet.pullDomainEvents();
  assertSuccess(bet.accept(CREATED_AT));
  bet.pullDomainEvents();

  return bet;
}

describe("GameQueryService", () => {
  it("enriches the current snapshot with pre-round fairness disclosure and a verified previous proof", async () => {
    const strategy = new CasinoCrashProvablyFairStrategy();
    const currentRound = createRound({
      id: "round-current",
      createdAt: CREATED_AT,
      strategy,
      serverSeed: "server-seed-current",
    });
    const previousRound = createRound({
      id: "round-previous",
      createdAt: PREVIOUS_CREATED_AT,
      strategy,
      serverSeed: "server-seed-previous",
      crashAt: new Date(PREVIOUS_CREATED_AT.getTime() + 17_000),
    });
    const currentBet = createAcceptedBet(currentRound.id);
    const strategyDefinition = createStrategyDefinition();

    const roundRepository: IRoundRepository = {
      findCurrentRound: async () => ({ success: true, data: currentRound }),
      findById: async (id) => ({
        success: true,
        data:
          id === currentRound.id
            ? currentRound
            : id === previousRound.id
              ? previousRound
              : undefined,
      }),
      findRecentSettledRounds: async () => ({
        success: true,
        data: [previousRound],
      }),
      findSettledRoundsPage: async () => ({
        success: true,
        data: [previousRound],
      }),
      countSettledRounds: async () => ({ success: true, data: 1 }),
      persist: async () => ({ success: true, data: currentRound }),
      update: async () => ({ success: true, data: currentRound }),
    };
    const betRepository: IBetRepository = {
      findCurrentByPlayerIdAndRoundId: async () => ({ success: true, data: undefined }),
      findByRoundId: async (roundId) => ({
        success: true,
        data: roundId === currentRound.id ? [currentBet] : [],
      }),
      findByPlayerId: async () => ({ success: true, data: [currentBet] }),
      findPageByPlayerId: async () => ({ success: true, data: [currentBet] }),
      countByPlayerId: async () => ({ success: true, data: 1 }),
      findById: async (id) => ({
        success: true,
        data: id === currentBet.id ? currentBet : undefined,
      }),
      persist: async () => ({ success: true, data: currentBet }),
      update: async () => ({ success: true, data: currentBet }),
    };
    const definitionRepository: IProvablyFairStrategyDefinitionRepository = {
      findCurrentStrategy: async () => ({ success: true, data: strategyDefinition }),
      findById: async () => ({ success: true, data: strategyDefinition }),
      persist: async () => ({ success: true, data: strategyDefinition }),
    };

    const service = new GameQueryService(
      roundRepository,
      betRepository,
      definitionRepository,
      strategy,
      new LogarithmicRoundTimingStrategy(),
    );

    const snapshot = await service.getCurrentSnapshot(CREATED_AT);

    expect(snapshot.round).not.toBeNull();
    expect(snapshot.round?.serverSeed).toBeNull();
    expect(snapshot.round?.crashPoint).toBeNull();
    expect(snapshot.round?.fairness.nonce).toBe(currentRound.id);
    expect(snapshot.round?.fairness.timeline.publishedAt).toBe(
      CREATED_AT.toISOString(),
    );
    expect(snapshot.round?.fairness.timeline.serverTime).toBe(
      CREATED_AT.toISOString(),
    );
    expect(snapshot.round?.fairness.commitment.serverSeedHash).toBe(
      currentRound.serverSeedHash,
    );
    expect(snapshot.round?.fairness.commitment.isSeedRevealed).toBe(false);
    expect(snapshot.round?.fairness.strategy.strategyId).toBe(strategy.definition.id);
    expect(snapshot.round?.fairness.strategy.algorithm).toBe(
      strategy.definition.algorithm,
    );
    expect(snapshot.round?.fairness.curve).toEqual(snapshot.round?.curve);
    expect(snapshot.round?.fairness.previousRoundProof).toEqual({
      roundId: previousRound.id,
      serverSeedHash: previousRound.serverSeedHash,
      serverSeed: previousRound.serverSeed,
      nonce: previousRound.nonce,
      crashPoint: previousRound.crashMultiplier ?? previousRound.crashPoint,
      verified: true,
    });
  });

  it("fails the snapshot explicitly when the stored strategy definition does not match the round", async () => {
    const strategy = new CasinoCrashProvablyFairStrategy();
    const currentRound = createRound({
      id: "round-current",
      createdAt: CREATED_AT,
      strategy,
      serverSeed: "server-seed-current",
    });
    const wrongDefinition = createStrategyDefinition("casino-crash-v2");

    const service = new GameQueryService(
      {
        findCurrentRound: async () => ({ success: true, data: currentRound }),
        findById: async () => ({ success: true, data: currentRound }),
        findRecentSettledRounds: async () => ({ success: true, data: [] }),
        persist: async () => ({ success: true, data: currentRound }),
        update: async () => ({ success: true, data: currentRound }),
      },
      {
        findCurrentByPlayerIdAndRoundId: async () => ({ success: true, data: undefined }),
        findByRoundId: async () => ({ success: true, data: [] }),
        findByPlayerId: async () => ({ success: true, data: [] }),
        findById: async () => ({ success: true, data: undefined }),
        persist: async () => ({ success: true, data: createAcceptedBet(currentRound.id) }),
        update: async () => ({ success: true, data: createAcceptedBet(currentRound.id) }),
      },
      {
        findCurrentStrategy: async () => ({ success: true, data: wrongDefinition }),
        findById: async () => ({ success: true, data: wrongDefinition }),
        persist: async () => ({ success: true, data: wrongDefinition }),
      },
      strategy,
      new LogarithmicRoundTimingStrategy(),
    );

    await expect(service.getCurrentSnapshot(CREATED_AT)).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });
});
