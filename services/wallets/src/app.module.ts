import { Module } from "@nestjs/common";
import { MikroOrmModule } from "@mikro-orm/nestjs";
import type { MikroOrmModuleSyncOptions } from "@mikro-orm/nestjs";
import { OutboxDispatcherService } from "@wallets/application/outbox/outbox-dispatcher.service";
import { CreateMyWalletUseCase } from "@wallets/application/use-cases/create-my-wallet.use-case";
import { GetMyWalletUseCase } from "@wallets/application/use-cases/get-my-wallet.use-case";
import { BROKER_PUBLISHER } from "@wallets/port/broker-publisher";
import { TIME_PROVIDER } from "@wallets/port/time-provider";
import { WALLET_OUTBOX_REPOSITORY } from "@wallets/port/wallet-outbox.repository";
import { WALLET_REPOSITORY } from "@wallets/port/wallet.repository";
import { AmqpBrokerPublisher } from "./infrastructure/broker/amqp-broker.publisher";
import { OutboxConfigService } from "./infrastructure/config/outbox.config";
import { OutboxPublisherWorker } from "./infrastructure/outbox/outbox-publisher.worker";
import { WalletOutboxRepository } from "./infrastructure/repository/wallet-outbox.repository";
import { WalletRepository } from "./infrastructure/repository/wallet.repository";
import { SystemTimeProvider } from "./infrastructure/time/system-time.provider";
import { KeycloakJwtAuthGuard } from "./presentation/auth/keycloak-jwt-auth.guard";
import { WalletsController } from "./presentation/controllers/wallets.controller";
import mikroOrmConfig from "./mikro-orm.config";

@Module({
  imports: [MikroOrmModule.forRoot(mikroOrmConfig as MikroOrmModuleSyncOptions)],
  controllers: [WalletsController],
  providers: [
    OutboxConfigService,
    OutboxDispatcherService,
    OutboxPublisherWorker,
    CreateMyWalletUseCase,
    GetMyWalletUseCase,
    KeycloakJwtAuthGuard,
    {
      provide: WALLET_REPOSITORY,
      useClass: WalletRepository,
    },
    {
      provide: WALLET_OUTBOX_REPOSITORY,
      useClass: WalletOutboxRepository,
    },
    {
      provide: TIME_PROVIDER,
      useClass: SystemTimeProvider,
    },
    {
      provide: BROKER_PUBLISHER,
      useClass: AmqpBrokerPublisher,
    },
  ],
})
export class AppModule { }
