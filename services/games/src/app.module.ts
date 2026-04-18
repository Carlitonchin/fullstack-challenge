import { Module } from "@nestjs/common";
import { MikroOrmModule } from "@mikro-orm/nestjs";
import type { MikroOrmModuleSyncOptions } from "@mikro-orm/nestjs";
import { MessagingOutboxModule } from "@crash/messaging";
import { GameCommandService } from "@games/application/game-command.service";
import { GameOutboxService } from "@games/application/game-outbox.service";
import { GameQueryService } from "@games/application/game-query.service";
import { GameRealtimePublisher } from "@games/application/game-realtime.publisher";
import { RoundEngineWorker } from "@games/application/round-engine.worker";
import { RoundFactoryService } from "@games/application/round-factory.service";
import { GameDomainEventOutboxMapper } from "@games/application/outbox/game-domain-event-outbox.mapper";
import { CasinoCrashProvablyFairStrategy } from "@games/domain/provably-fair/casino-crash-provably-fair.strategy";
import {
  PROVABLY_FAIR_STRATEGY,
  SERVER_SEED_GENERATOR,
} from "@games/domain/provably-fair/provably-fair.tokens";
import { CryptoServerSeedGenerator } from "@games/infrastructure/provably-fair/crypto-server-seed-generator";
import { BetRepository } from "@games/infrastructure/repository/bet.repository";
import { ProvablyFairStrategyDefinitionRepository } from "@games/infrastructure/repository/provably-fair-strategy-definition.repository";
import { RoundRepository } from "@games/infrastructure/repository/round.repository";
import { GameOutboxMessageSchema } from "@games/infrastructure/schema/game-outbox-message";
import { PlayerRealtimeEventsConsumer } from "@games/infrastructure/messaging/player-realtime-events.consumer";
import { WalletEventsConsumer } from "@games/infrastructure/messaging/wallet-events.consumer";
import { LogarithmicRoundTimingStrategy } from "@games/domain/round/round-timing.strategy";
import { ROUND_TIMING_STRATEGY } from "@games/domain/round/round.tokens";
import { StartRoundUseCase } from "@games/application/use-cases/start-round.use-case";
import { PlayerRealtimeNotificationQueue } from "@games/application/player-realtime-notification.queue";
import { BET_REPOSITORY } from "@games/port/bet.repository";
import { ROUND_REPOSITORY } from "@games/port/round.repository";
import { PROVABLY_FAIR_STRATEGY_DEFINITION_REPOSITORY } from "@games/port/provably-fair-strategy-definition.repository";
import mikroOrmConfig from "./mikro-orm.config";
import { KeycloakJwtAuthGuard } from "./presentation/auth/keycloak-jwt-auth.guard";
import { KeycloakJwtVerifier } from "./presentation/auth/keycloak-jwt.verifier";
import { GamesController } from "./presentation/controllers/games.controller";
import { GameGateway } from "./presentation/gateways/game.gateway";

@Module({
  imports: [
    MikroOrmModule.forRoot(mikroOrmConfig as MikroOrmModuleSyncOptions),
    MessagingOutboxModule.register({
      schema: GameOutboxMessageSchema,
      tableName: "game_outbox_messages",
      workerIdPrefix: "games",
    }),
  ],
  controllers: [GamesController],
  providers: [
    GameDomainEventOutboxMapper,
    GameOutboxService,
    GameQueryService,
    GameCommandService,
    GameRealtimePublisher,
    RoundFactoryService,
    GameGateway,
    PlayerRealtimeNotificationQueue,
    PlayerRealtimeEventsConsumer,
    WalletEventsConsumer,
    RoundEngineWorker,
    KeycloakJwtAuthGuard,
    KeycloakJwtVerifier,
    {
      provide: PROVABLY_FAIR_STRATEGY,
      useValue: new CasinoCrashProvablyFairStrategy(),
    },
    {
      provide: ROUND_TIMING_STRATEGY,
      useValue: new LogarithmicRoundTimingStrategy(),
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
    {
      provide: BET_REPOSITORY,
      useClass: BetRepository,
    },
    StartRoundUseCase,
  ]
})
export class AppModule {}
