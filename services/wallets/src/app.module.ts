import { Module } from "@nestjs/common";
import { MikroOrmModule } from "@mikro-orm/nestjs";
import type { MikroOrmModuleSyncOptions } from "@mikro-orm/nestjs";
import { MessagingOutboxModule } from "@crash/messaging";
import { WalletMoneyFlowService } from "@wallets/application/wallet-money-flow.service";
import { WalletDomainEventOutboxMapper } from "@wallets/application/outbox/wallet-domain-event-outbox.mapper";
import { CreateMyWalletUseCase } from "@wallets/application/use-cases/create-my-wallet.use-case";
import { GetMyWalletUseCase } from "@wallets/application/use-cases/get-my-wallet.use-case";
import { TIME_PROVIDER } from "@wallets/port/time-provider";
import { WALLET_REPOSITORY } from "@wallets/port/wallet.repository";
import { GamesMoneyFlowConsumer } from "@wallets/infrastructure/messaging/games-money-flow.consumer";
import { WalletRepository } from "./infrastructure/repository/wallet.repository";
import { WalletOutboxMessageSchema } from "./infrastructure/schema/wallet-outbox-message";
import { SystemTimeProvider } from "./infrastructure/time/system-time.provider";
import { KeycloakJwtAuthGuard } from "./presentation/auth/keycloak-jwt-auth.guard";
import { WalletsController } from "./presentation/controllers/wallets.controller";
import mikroOrmConfig from "./mikro-orm.config";

@Module({
  imports: [
    MikroOrmModule.forRoot(mikroOrmConfig as MikroOrmModuleSyncOptions),
    MessagingOutboxModule.register({
      schema: WalletOutboxMessageSchema,
      tableName: "wallet_outbox_messages",
      workerIdPrefix: "wallets",
    }),
  ],
  controllers: [WalletsController],
  providers: [
    WalletDomainEventOutboxMapper,
    WalletMoneyFlowService,
    GamesMoneyFlowConsumer,
    CreateMyWalletUseCase,
    GetMyWalletUseCase,
    KeycloakJwtAuthGuard,
    {
      provide: WALLET_REPOSITORY,
      useClass: WalletRepository,
    },
    {
      provide: TIME_PROVIDER,
      useClass: SystemTimeProvider,
    },
  ],
})
export class AppModule { }
