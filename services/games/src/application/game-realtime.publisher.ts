import { MikroORM, RequestContext } from "@mikro-orm/core";
import { Injectable, Logger } from "@nestjs/common";
import { GameQueryService } from "@games/application/game-query.service";
import { GameGateway } from "@games/presentation/gateways/game.gateway";

@Injectable()
export class GameRealtimePublisher {
  private readonly logger = new Logger(GameRealtimePublisher.name);

  constructor(
    private readonly orm: MikroORM,
    private readonly gameQueryService: GameQueryService,
    private readonly gameGateway: GameGateway,
  ) {}

  async publishSnapshot(): Promise<void> {
    const snapshot = await RequestContext.create(this.orm.em, async () =>
      this.gameQueryService.getCurrentSnapshot(),
    );
    this.gameGateway.emitGameSnapshot(snapshot);
  }

  async publishBetUpdated(betId: string): Promise<void> {
    const bet = await this.findBetView(betId);

    if (!bet) {
      return;
    }

    this.gameGateway.emitBetUpdated(bet);
  }

  async publishHistoryUpdated(): Promise<void> {
    const history = await RequestContext.create(this.orm.em, async () =>
      this.gameQueryService.getRoundHistory(),
    );
    this.gameGateway.emitHistoryUpdated(history);
  }

  private async findBetView(betId: string) {
    const snapshot = await RequestContext.create(this.orm.em, async () =>
      this.gameQueryService.getCurrentSnapshot(),
    );
    const publicBet = snapshot.bets.find((bet) => bet.id === betId);

    if (publicBet) {
      return publicBet;
    }

    this.logger.debug(
      `Skipping public bet broadcast for ${betId} because it is not visible in the current snapshot`,
    );
    return null;
  }
}
