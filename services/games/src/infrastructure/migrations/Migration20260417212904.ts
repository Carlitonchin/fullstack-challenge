import { Migration } from '@mikro-orm/migrations';

export class Migration20260417212904 extends Migration {

  override up(): void | Promise<void> {
    this.addSql(`alter type "round_status_type" add value if not exists 'WAITING_FOR_FIRST_BET' before 'BETTING_OPEN';`);
    this.addSql(`alter table "rounds" alter column "starts_at" drop not null;`);
    this.addSql(`alter table "rounds" alter column "betting_closes_at" drop not null;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "rounds" alter column "starts_at" set not null;`);
    this.addSql(`alter table "rounds" alter column "betting_closes_at" set not null;`);
  }

}
