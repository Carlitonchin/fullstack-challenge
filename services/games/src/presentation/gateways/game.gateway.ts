import { MikroORM, RequestContext } from "@mikro-orm/core";
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import { GameQueryService } from "@games/application/game-query.service";
import type {
  CurrentGameSnapshotView,
  GameBetView,
  GameRoundHistoryEntryView,
} from "@games/application/game-view.types";

@WebSocketGateway({
  path: "/socket.io",
  cors: {
    origin: true,
    credentials: true,
  },
})
export class GameGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly orm: MikroORM,
    private readonly gameQueryService: GameQueryService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const { snapshot, history } = await RequestContext.create(
      this.orm.em,
      async () => {
        const snapshot = await this.gameQueryService.getCurrentSnapshot();
        const history = await this.gameQueryService.getRoundHistory();

        return { snapshot, history };
      },
    );

    client.emit("game.snapshot", snapshot);
    client.emit("history.updated", history);
  }

  emitGameSnapshot(snapshot: CurrentGameSnapshotView): void {
    this.server.emit("game.snapshot", snapshot);
  }

  emitBetUpdated(bet: GameBetView): void {
    this.server.emit("bet.updated", bet);
  }

  emitHistoryUpdated(history: GameRoundHistoryEntryView[]): void {
    this.server.emit("history.updated", history);
  }
}
