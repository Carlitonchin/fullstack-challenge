import { defineConfig } from "@mikro-orm/postgresql";
import { Migrator } from "@mikro-orm/migrations";
import { ProvablyFairStrategyDefinitionSchema } from "./infrastructure/schema/provably-fair-strategy-definition";
import { RoundSchema } from "./infrastructure/schema/round";
import { Migration20260417131229 } from "./infrastructure/migrations/Migration20260417131229";
import { Migration20260417133247 } from "./infrastructure/migrations/Migration20260417133247";
import { Migration20260417134115 } from "./infrastructure/migrations/Migration20260417134115";
import { BetSchema } from "./infrastructure/schema/bet";
import { Migration20260417141719 } from "./infrastructure/migrations/Migration20260417141719";
import { Migration20260417142105 } from "./infrastructure/migrations/Migration20260417142105";
import { GameOutboxMessageSchema } from "./infrastructure/schema/game-outbox-message";
import { Migration20260417144938 } from "./infrastructure/migrations/Migration20260417144938";
import { Migration20260417154633 } from "./infrastructure/migrations/Migration20260417154633";

export default defineConfig({
  clientUrl: process.env.DATABASE_URL,
  entities: [
    ProvablyFairStrategyDefinitionSchema,
    RoundSchema,
    BetSchema,
    GameOutboxMessageSchema,
  ],
  extensions: [Migrator],
  migrations: {
    path: "./src/infrastructure/migrations",
    pathTs: "./src/infrastructure/migrations",
    glob: "!(*.d).{js,ts}",
    migrationsList: [
      Migration20260417131229,
      Migration20260417133247,
      Migration20260417134115,
      Migration20260417141719,
      Migration20260417142105,
      Migration20260417144938,
      Migration20260417154633
    ],
  },
});
