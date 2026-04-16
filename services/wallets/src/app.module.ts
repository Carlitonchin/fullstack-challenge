import { Module } from "@nestjs/common";
import { MikroOrmModule } from "@mikro-orm/nestjs";
import type { MikroOrmModuleSyncOptions } from "@mikro-orm/nestjs";
import { WalletsController } from "./presentation/controllers/wallets.controller";
import mikroOrmConfig from "./mikro-orm.config";

@Module({
  imports: [MikroOrmModule.forRoot(mikroOrmConfig as MikroOrmModuleSyncOptions)],
  controllers: [WalletsController],
})
export class AppModule { }
