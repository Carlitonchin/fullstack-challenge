import { Module } from "@nestjs/common";
import { CasinoCrashProvablyFairStrategy } from "@games/domain/provably-fair/casino-crash-provably-fair.strategy";
import {
  PROVABLY_FAIR_STRATEGY,
  SERVER_SEED_GENERATOR,
} from "@games/domain/provably-fair/provably-fair.tokens";
import { CryptoServerSeedGenerator } from "@games/infrastructure/provably-fair/crypto-server-seed-generator";
import { GamesController } from "./presentation/controllers/games.controller";

@Module({
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
  ],
  exports: [PROVABLY_FAIR_STRATEGY, SERVER_SEED_GENERATOR],
})
export class AppModule {}
