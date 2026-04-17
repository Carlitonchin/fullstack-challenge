import { UniqueConstraintViolationException } from "@mikro-orm/core";
import { EntityManager } from "@mikro-orm/postgresql";
import {
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";
import type { ProvablyFairStrategy } from "@games/domain/provably-fair/provably-fair.strategy";
import type { ServerSeedGenerator } from "@games/domain/provably-fair/server-seed-generator";
import { Round } from "@games/domain/round/round";
import {
  PROVABLY_FAIR_STRATEGY,
  SERVER_SEED_GENERATOR,
} from "@games/domain/provably-fair/provably-fair.tokens";
import {
  PROVABLY_FAIR_STRATEGY_DEFINITION_REPOSITORY,
  type IProvablyFairStrategyDefinitionRepository,
} from "@games/port/provably-fair-strategy-definition.repository";
import {
  ROUND_REPOSITORY,
  type IRoundRepository,
  type RoundRepositoryError,
} from "@games/port/round.repository";

const BETTING_WINDOW_IN_SECONDS = 10;

@Injectable()
export class StartRoundUseCase {
  constructor(
    @Inject(ROUND_REPOSITORY)
    private readonly roundRepository: IRoundRepository,
    @Inject(PROVABLY_FAIR_STRATEGY_DEFINITION_REPOSITORY)
    private readonly provablyFairStrategyDefinitionRepository: IProvablyFairStrategyDefinitionRepository,
    @Inject(PROVABLY_FAIR_STRATEGY)
    private readonly provablyFairStrategy: ProvablyFairStrategy,
    @Inject(SERVER_SEED_GENERATOR)
    private readonly serverSeedGenerator: ServerSeedGenerator,
    private readonly em: EntityManager,
  ) { }

  async execute(roundId: string): Promise<Round> {
    const normalizedRoundId = roundId.trim();

    if (!normalizedRoundId) {
      throw new InternalServerErrorException("Round id is missing");
    }

    const currentStrategyResult =
      await this.provablyFairStrategyDefinitionRepository.findCurrentStrategy();

    if (!currentStrategyResult.success) {
      throw new InternalServerErrorException(currentStrategyResult.error.message);
    }

    const projectStrategyDefinition = this.provablyFairStrategy.definition;
    const currentStrategyDefinition = currentStrategyResult.data;

    let activeStrategyDefinitionId: string = currentStrategyDefinition?.id || "";

    if (!currentStrategyDefinition || !this.isSameStrategy(currentStrategyDefinition, projectStrategyDefinition)) {
      activeStrategyDefinitionId = projectStrategyDefinition.id;

      const persistedStrategyResult =
        await this.provablyFairStrategyDefinitionRepository.persist({
          definition: projectStrategyDefinition,
        });

      if (!persistedStrategyResult.success) {
        throw new InternalServerErrorException(
          persistedStrategyResult.error.message,
        );
      }
    }

    const currentRoundResult = await this.roundRepository.findCurrentRound();

    if (!currentRoundResult.success) {
      throw new InternalServerErrorException(
        this.getRoundRepositoryErrorMessage(currentRoundResult.error),
      );
    }

    if (currentRoundResult.data?.isActive) {
      throw new ConflictException("There is already an active round");
    }

    const createdAt = new Date();
    const serverSeed = this.serverSeedGenerator.generate();
    const nonce = normalizedRoundId;
    const commitment = this.provablyFairStrategy.commit(serverSeed);
    const outcome = this.provablyFairStrategy.generate({
      serverSeed,
      nonce,
    });

    const roundResult = Round.new({
      id: normalizedRoundId,
      crashPoint: outcome.crashPoint,
      provablyFairStrategyId: activeStrategyDefinitionId,
      nonce,
      serverSeedHash: commitment.serverSeedHash,
      serverSeed,
      createdAt,
      bettingWindowInSeconds: BETTING_WINDOW_IN_SECONDS,
    });

    if (!roundResult.success) {
      throw new InternalServerErrorException(roundResult.error.message);
    }

    const round = roundResult.data!;
    const domainEvents = round.pullDomainEvents();
    const persistedRoundResult = await this.roundRepository.persist(round);

    if (!persistedRoundResult.success) {
      throw new InternalServerErrorException(
        this.getRoundRepositoryErrorMessage(persistedRoundResult.error),
      );
    }

    try {
      await this.em.flush();
    } catch (error) {
      this.em.clear();

      if (this.isActiveRoundConflict(error)) {
        throw new ConflictException("There is already an active round");
      }

      throw error;
    }

    void domainEvents;
    // TODO: Publish round domain events once broker/outbox integration is available.

    return round;
  }

  private isSameStrategy(
    currentStrategy: { id: string },
    projectStrategy: { id: string },
  ): boolean {
    return currentStrategy.id === projectStrategy.id;
  }

  private isActiveRoundConflict(error: unknown): boolean {
    return (
      error instanceof UniqueConstraintViolationException &&
      typeof error.message === "string" &&
      error.message.includes("rounds_single_active_round_unique")
    );
  }

  private getRoundRepositoryErrorMessage(error: RoundRepositoryError): string {
    if (error instanceof Error) {
      return error.message;
    }

    return `Round repository error: ${error.name}`;
  }
}
