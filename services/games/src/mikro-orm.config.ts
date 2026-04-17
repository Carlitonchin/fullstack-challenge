import { defineConfig } from "@mikro-orm/postgresql";
import { Migrator } from "@mikro-orm/migrations";
import { ProvablyFairStrategyDefinitionSchema } from "./infrastructure/schema/provably-fair-strategy-definition";
import { RoundSchema } from "./infrastructure/schema/round";
import { Migration20260417131229 } from "./infrastructure/migrations/Migration20260417131229";
import { Migration20260417133247 } from "./infrastructure/migrations/Migration20260417133247";

export default defineConfig({
  clientUrl: process.env.DATABASE_URL,
  entities: [ProvablyFairStrategyDefinitionSchema, RoundSchema],
  extensions: [Migrator],
  migrations: {
    path: "./src/infrastructure/migrations",
    pathTs: "./src/infrastructure/migrations",
    glob: "!(*.d).{js,ts}",
    migrationsList: [
      Migration20260417131229,
      Migration20260417133247
    ],
  },
});
