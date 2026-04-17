import {
  ConflictException,
  Injectable,
} from "@nestjs/common";
import { EntityManager } from "@mikro-orm/postgresql";
import { GameOutboxService } from "@games/application/game-outbox.service";
import { RoundFactoryService } from "@games/application/round-factory.service";
import {
  ROUND_REPOSITORY,
  type IRoundRepository,
} from "@games/port/round.repository";
import { Inject } from "@nestjs/common";

@Injectable()
export class StartRoundUseCase {
  constructor(
    @Inject(ROUND_REPOSITORY)
    private readonly roundRepository: IRoundRepository,
    private readonly roundFactoryService: RoundFactoryService,
    private readonly gameOutboxService: GameOutboxService,
    private readonly em: EntityManager,
  ) {}

  async execute(roundId: string) {
    const normalizedRoundId = roundId.trim();

    if (!normalizedRoundId) {
      throw new ConflictException("Round id is missing");
    }

    const currentRoundResult = await this.roundRepository.findCurrentRound();

    if (!currentRoundResult.success) {
      throw new ConflictException(
        getRepositoryErrorMessage(currentRoundResult.error),
      );
    }

    if (currentRoundResult.data?.isActive) {
      throw new ConflictException("There is already an active round");
    }

    const round = await this.roundFactoryService.createRound({
      createdAt: new Date(),
      roundId: normalizedRoundId,
    });
    const roundEvents = round.pullDomainEvents();

    await this.gameOutboxService.insertRoundEvents({
      events: roundEvents,
      persistedAt: round.createdAt,
    });
    await this.em.flush();

    return round;
  }
}

function getRepositoryErrorMessage(error: Error | { name: string }): string {
  if (error instanceof Error) {
    return error.message;
  }

  return error.name;
}
