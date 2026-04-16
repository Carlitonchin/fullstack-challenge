import { Module } from "@nestjs/common";
import { MikroOrmModule } from "@mikro-orm/nestjs";
import type { MikroOrmModuleSyncOptions } from "@mikro-orm/nestjs";
import { GetMyWalletUseCase } from "@wallets/application/use-cases/get-my-wallet.use-case";
import { WALLET_REPOSITORY } from "@wallets/port/wallet.repository";
import { WalletRepository } from "./infrastructure/repository/wallet.repository";
import { KeycloakJwtAuthGuard } from "./presentation/auth/keycloak-jwt-auth.guard";
import { WalletsController } from "./presentation/controllers/wallets.controller";
import mikroOrmConfig from "./mikro-orm.config";

@Module({
  imports: [MikroOrmModule.forRoot(mikroOrmConfig as MikroOrmModuleSyncOptions)],
  controllers: [WalletsController],
  providers: [
    GetMyWalletUseCase,
    KeycloakJwtAuthGuard,
    {
      provide: WALLET_REPOSITORY,
      useClass: WalletRepository,
    },
  ],
})
export class AppModule { }
