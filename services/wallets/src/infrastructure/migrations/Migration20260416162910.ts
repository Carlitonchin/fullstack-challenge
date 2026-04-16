import { Migration } from '@mikro-orm/migrations';

export class Migration20260416162910 extends Migration {

  override up(): void | Promise<void> {
    this.addSql(`alter table "wallet_outbox_messages" rename column "topic" to "exchange_name";`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "wallet_outbox_messages" rename column "exchange_name" to "topic";`);
  }

}
