import { Inject, Injectable, InternalServerErrorException } from "@nestjs/common";
import { EntityManager } from "@mikro-orm/postgresql";
import type { ProvablyFairStrategy } from "@games/domain/provably-fair/provably-fair.strategy";
import type { ServerSeedGenerator } from "@games/domain/provably-fair/server-seed-generator";
import {
  PROVABLY_FAIR_STRATEGY,
  SERVER_SEED_GENERATOR,
} from "@games/domain/provably-fair/provably-fair.tokens";
import { Round } from "@games/domain/round/round";
import {
  BETTING_WINDOW_IN_SECONDS,
  ROUND_CRASH_REVEAL_IN_MS,
  ROUND_START_DELAY_IN_MS,
} from "@games/domain/round/round-timing.strategy";
import type { RoundTimingStrategy } from "@games/domain/round/round-timing.strategy";
import { ROUND_TIMING_STRATEGY } from "@games/domain/round/round.tokens";
import { ProvablyFairStrategyDefinitionRepository } from "@games/infrastructure/repository/provably-fair-strategy-definition.repository";
import { RoundRepository } from "@games/infrastructure/repository/round.repository";

@Injectable()
export class RoundFactoryService {
  constructor(
    @Inject(PROVABLY_FAIR_STRATEGY)
    private readonly provablyFairStrategy: ProvablyFairStrategy,
    @Inject(SERVER_SEED_GENERATOR)
    private readonly serverSeedGenerator: ServerSeedGenerator,
    @Inject(ROUND_TIMING_STRATEGY)
    private readonly roundTimingStrategy: RoundTimingStrategy,
    private readonly em: EntityManager,
  ) {}

  async createRound(params: {
    createdAt: Date;
    roundId?: string;
    entityManager?: EntityManager;
  }): Promise<Round> {
    const entityManager = params.entityManager ?? this.em;
    const roundRepository = new RoundRepository(entityManager);
    const strategyDefinitionRepository =
      new ProvablyFairStrategyDefinitionRepository(entityManager);

    const currentStrategyResult =
      await strategyDefinitionRepository.findCurrentStrategy();

    if (!currentStrategyResult.success) {
      throw new InternalServerErrorException(currentStrategyResult.error.message);
    }

    const projectStrategyDefinition = this.provablyFairStrategy.definition;
    const currentStrategyDefinition = currentStrategyResult.data;

    let activeStrategyDefinitionId = currentStrategyDefinition?.id ?? "";

    if (
      !currentStrategyDefinition ||
      currentStrategyDefinition.id !== projectStrategyDefinition.id
    ) {
      activeStrategyDefinitionId = projectStrategyDefinition.id;

      const persistedStrategyResult =
        await strategyDefinitionRepository.persist({
          definition: projectStrategyDefinition,
        });

      if (!persistedStrategyResult.success) {
        throw new InternalServerErrorException(
          persistedStrategyResult.error.message,
        );
      }
    }

    const roundId = params.roundId?.trim() || crypto.randomUUID();
    const serverSeed = this.serverSeedGenerator.generate();
    const commitment = this.provablyFairStrategy.commit(serverSeed);
    const outcome = this.provablyFairStrategy.generate({
      serverSeed,
      nonce: roundId,
    });
    const roundDurationInMs = this.roundTimingStrategy.calculateDurationInMs(
      outcome.crashPoint,
    );

    const roundResult = Round.new({
      id: roundId,
      crashPoint: outcome.crashPoint,
      provablyFairStrategyId: activeStrategyDefinitionId,
      nonce: roundId,
      serverSeedHash: commitment.serverSeedHash,
      serverSeed,
      createdAt: params.createdAt,
      bettingWindowInSeconds: BETTING_WINDOW_IN_SECONDS,
      startDelayInMs: ROUND_START_DELAY_IN_MS,
      roundDurationInMs,
      crashRevealInMs: ROUND_CRASH_REVEAL_IN_MS,
    });

    if (!roundResult.success) {
      throw new InternalServerErrorException(roundResult.error.message);
    }

    const persistedRoundResult = await roundRepository.persist(roundResult.data!);

    if (!persistedRoundResult.success) {
      throw new InternalServerErrorException(
        getRepositoryErrorMessage(persistedRoundResult.error),
      );
    }

    return persistedRoundResult.data!;
  }
}

function getRepositoryErrorMessage(error: Error | { name: string }): string {
  if (error instanceof Error) {
    return error.message;
  }

  return error.name;
}
