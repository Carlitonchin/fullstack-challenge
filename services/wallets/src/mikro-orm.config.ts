import { defineConfig } from "@mikro-orm/postgresql";
import { Migrator } from "@mikro-orm/migrations";
import { Migration20260416011113 } from "./infrastructure/migrations/Migration20260416011113";
import { WalletSchema } from "./infrastructure/schema/wallet"
import { WalletOperationSchema } from "./infrastructure/schema/wallet-operation";

export default defineConfig({
  clientUrl: process.env.DATABASE_URL,
  entities: [WalletSchema, WalletOperationSchema],
  extensions: [Migrator],
  migrations: {
    path: "./src/infrastructure/migrations",
    pathTs: "./src/infrastructure/migrations",
    glob: "!(*.d).{js,ts}",
    migrationsList: [Migration20260416011113],
  },
});
