import { Injectable } from "@nestjs/common";
import type {
  GameBetView,
  WalletBalanceUpdatedView,
} from "@games/application/game-view.types";
import { GameGateway } from "@games/presentation/gateways/game.gateway";

type PlayerRealtimeNotification =
  | {
      type: "wallet.balance-updated";
      playerId: string;
      payload: WalletBalanceUpdatedView;
    }
  | {
      type: "player.bet.updated";
      playerId: string;
      payload: GameBetView;
    };

@Injectable()
export class PlayerRealtimeNotificationQueue {
  private tail: Promise<void> = Promise.resolve();

  constructor(private readonly gameGateway: GameGateway) {}

  enqueue(notification: PlayerRealtimeNotification): Promise<void> {
    const dispatch = this.tail.then(() => this.dispatch(notification));

    this.tail = dispatch.catch(() => undefined);

    return dispatch;
  }

  private async dispatch(notification: PlayerRealtimeNotification): Promise<void> {
    switch (notification.type) {
      case "wallet.balance-updated":
        this.gameGateway.emitWalletBalanceUpdated(
          notification.playerId,
          notification.payload,
        );
        break;
      case "player.bet.updated":
        this.gameGateway.emitPlayerBetUpdated(
          notification.playerId,
          notification.payload,
        );
        break;
    }
  }
}
