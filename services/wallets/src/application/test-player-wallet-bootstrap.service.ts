import { MikroORM, RequestContext } from "@mikro-orm/core";
import {
  ConflictException,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from "@nestjs/common";
import { CreateMyWalletUseCase } from "@wallets/application/use-cases/create-my-wallet.use-case";

const DEFAULT_TEST_PLAYER_ID = "00000000-0000-4000-8000-000000000001";

@Injectable()
export class TestPlayerWalletBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(TestPlayerWalletBootstrapService.name);

  constructor(
    private readonly orm: MikroORM,
    private readonly createMyWalletUseCase: CreateMyWalletUseCase,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const bootstrapEnabled = this.readBooleanEnv(
      "DEMO_PLAYER_WALLET_BOOTSTRAP_ENABLED",
      true,
    );

    if (!bootstrapEnabled) {
      this.logger.log("Demo player wallet bootstrap disabled");
      return;
    }

    const playerId = process.env.DEMO_PLAYER_ID?.trim() || DEFAULT_TEST_PLAYER_ID;
    const playerUsername = process.env.DEMO_PLAYER_USERNAME?.trim() || "player";

    try {
      await RequestContext.create(this.orm.em, async () => {
        await this.createMyWalletUseCase.execute(playerId);
      });
      this.logger.log(
        `Bootstrapped demo wallet for player ${playerUsername} (${playerId})`,
      );
    } catch (error) {
      if (error instanceof ConflictException) {
        this.logger.log(
          `Demo wallet for player ${playerUsername} (${playerId}) already exists`,
        );
        return;
      }

      throw error;
    }
  }

  private readBooleanEnv(name: string, defaultValue: boolean): boolean {
    const rawValue = process.env[name]?.trim().toLowerCase();

    if (!rawValue) {
      return defaultValue;
    }

    return rawValue !== "false" && rawValue !== "0" && rawValue !== "no";
  }
}
