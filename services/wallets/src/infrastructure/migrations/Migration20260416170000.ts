import { Migration } from "@mikro-orm/migrations";

export class Migration20260416170000 extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `alter type "operation_type" add value if not exists 'ACCOUNT_FUNDING';`,
    );
  }

  override down(): void | Promise<void> {
    throw new Error("Down migration is not supported for ACCOUNT_FUNDING enum addition");
  }
}
