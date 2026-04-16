import { defineConfig } from "@mikro-orm/postgresql";
import { Migrator } from "@mikro-orm/migrations";
import { Migration20260416011113 } from "./infrastructure/migrations/Migration20260416011113";
import { WalletSchema } from "./infrastructure/schema/wallet"
import { WalletOperationSchema } from "./infrastructure/schema/wallet-operation";
import { WalletOutboxMessageSchema } from "./infrastructure/schema/wallet-outbox-message";
import { Migration20260416153234 } from "./infrastructure/migrations/Migration20260416153234";
import { Migration20260416162910 } from "./infrastructure/migrations/Migration20260416162910";

export default defineConfig({
  clientUrl: process.env.DATABASE_URL,
  entities: [WalletSchema, WalletOperationSchema, WalletOutboxMessageSchema],
  extensions: [Migrator],
  migrations: {
    path: "./src/infrastructure/migrations",
    pathTs: "./src/infrastructure/migrations",
    glob: "!(*.d).{js,ts}",
    migrationsList: [
      Migration20260416011113,
      Migration20260416153234,
      Migration20260416162910
    ],
  },
});
