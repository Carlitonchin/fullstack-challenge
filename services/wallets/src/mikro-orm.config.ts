import { defineConfig } from "@mikro-orm/postgresql";
import { Migrator } from "@mikro-orm/migrations";
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
  },
});
