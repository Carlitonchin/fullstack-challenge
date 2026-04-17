import { Module } from "@nestjs/common";
import { MikroOrmModule } from "@mikro-orm/nestjs";
import type { MikroOrmModuleSyncOptions } from "@mikro-orm/nestjs";
import { CasinoCrashProvablyFairStrategy } from "@games/domain/provably-fair/casino-crash-provably-fair.strategy";
import {
  PROVABLY_FAIR_STRATEGY,
  SERVER_SEED_GENERATOR,
} from "@games/domain/provably-fair/provably-fair.tokens";
import { CryptoServerSeedGenerator } from "@games/infrastructure/provably-fair/crypto-server-seed-generator";
import { ProvablyFairStrategyDefinitionRepository } from "@games/infrastructure/repository/provably-fair-strategy-definition.repository";
import { RoundRepository } from "@games/infrastructure/repository/round.repository";
import { ROUND_REPOSITORY } from "@games/port/round.repository";
import { PROVABLY_FAIR_STRATEGY_DEFINITION_REPOSITORY } from "@games/port/provably-fair-strategy-definition.repository";
import mikroOrmConfig from "./mikro-orm.config";
import { GamesController } from "./presentation/controllers/games.controller";

@Module({
  imports: [MikroOrmModule.forRoot(mikroOrmConfig as MikroOrmModuleSyncOptions)],
  controllers: [GamesController],
  providers: [
    {
      provide: PROVABLY_FAIR_STRATEGY,
      useValue: new CasinoCrashProvablyFairStrategy(),
    },
    {
      provide: SERVER_SEED_GENERATOR,
      useClass: CryptoServerSeedGenerator,
    },
    {
      provide: PROVABLY_FAIR_STRATEGY_DEFINITION_REPOSITORY,
      useClass: ProvablyFairStrategyDefinitionRepository,
    },
    {
      provide: ROUND_REPOSITORY,
      useClass: RoundRepository,
    },
  ]
})
export class AppModule {}
