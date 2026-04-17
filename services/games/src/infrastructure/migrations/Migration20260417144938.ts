import { Migration } from '@mikro-orm/migrations';

export class Migration20260417144938 extends Migration {

  override up(): void | Promise<void> {
    this.addSql(`create unique index "rounds_single_active_round_unique" on "rounds" ((true)) where "status" not in ('SETTLED', 'ERROR');`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "rounds" drop constraint "rounds_single_active_round_unique";`);
  }

}
