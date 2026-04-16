import { Module } from "@nestjs/common";
import { MikroOrmModule } from "@mikro-orm/nestjs";
import type { MikroOrmModuleSyncOptions } from "@mikro-orm/nestjs";
import { WalletRepository } from "./infrastructure/repository/wallet.repository";
import { KeycloakJwtAuthGuard } from "./presentation/auth/keycloak-jwt-auth.guard";
import { WalletsController } from "./presentation/controllers/wallets.controller";
import mikroOrmConfig from "./mikro-orm.config";

@Module({
  imports: [MikroOrmModule.forRoot(mikroOrmConfig as MikroOrmModuleSyncOptions)],
  controllers: [WalletsController],
  providers: [WalletRepository, KeycloakJwtAuthGuard],
})
export class AppModule { }
