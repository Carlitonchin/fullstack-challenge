import { Migration } from '@mikro-orm/migrations';

export class Migration20260417214447 extends Migration {

  override up(): void | Promise<void> {
    this.addSql(`alter table "rounds" alter column "scheduled_crash_at" drop not null;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "rounds" alter column "scheduled_crash_at" set not null;`);
  }

}
