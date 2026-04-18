import { MikroORM, RequestContext } from "@mikro-orm/core";
import { Logger } from "@nestjs/common";
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
  WalletBalanceUpdatedView,
} from "@games/application/game-view.types";
import { KeycloakJwtVerifier } from "@games/presentation/auth/keycloak-jwt.verifier";

@WebSocketGateway({
  path: "/socket.io",
  cors: {
    origin: true,
    credentials: true,
  },
})
export class GameGateway implements OnGatewayConnection {
  private readonly logger = new Logger(GameGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly orm: MikroORM,
    private readonly gameQueryService: GameQueryService,
    private readonly jwtVerifier: KeycloakJwtVerifier,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const playerId = await this.authenticateClient(client);

    if (!playerId) {
      return;
    }

    const snapshot = await RequestContext.create(
      this.orm.em,
      async () => this.gameQueryService.getCurrentSnapshot(),
    );

    client.emit("game.snapshot", snapshot);
  }

  emitGameSnapshot(snapshot: CurrentGameSnapshotView): void {
    this.server.emit("game.snapshot", snapshot);
  }

  emitBetUpdated(bet: GameBetView): void {
    this.server.emit("bet.updated", bet);
  }

  emitHistoryUpdated(): void {
    this.server.emit("history.updated");
  }

  emitWalletBalanceUpdated(
    playerId: string,
    payload: WalletBalanceUpdatedView,
  ): void {
    this.server.to(getPlayerRoom(playerId)).emit("wallet.balance-updated", payload);
  }

  emitPlayerBetUpdated(playerId: string, bet: GameBetView): void {
    this.server.to(getPlayerRoom(playerId)).emit("player.bet.updated", bet);
  }

  private async authenticateClient(client: Socket): Promise<string | null> {
    const token = this.extractHandshakeToken(client);

    if (!token) {
      client.disconnect(true);
      return null;
    }

    try {
      const payload = await this.jwtVerifier.verifyAccessToken(token);
      const playerId = typeof payload.sub === "string" ? payload.sub.trim() : "";

      if (!playerId) {
        client.disconnect(true);
        return null;
      }

      client.data.playerId = playerId;
      await client.join(getPlayerRoom(playerId));

      return playerId;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Rejected websocket connection: ${reason}`);
      client.disconnect(true);
      return null;
    }
  }

  private extractHandshakeToken(client: Socket): string | null {
    const token = client.handshake.auth?.token;

    return typeof token === "string" && token.trim() ? token.trim() : null;
  }
}

function getPlayerRoom(playerId: string): string {
  return `player:${playerId}`;
}
