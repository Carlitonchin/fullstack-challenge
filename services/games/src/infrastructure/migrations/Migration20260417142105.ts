import { Migration } from '@mikro-orm/migrations';

export class Migration20260417142105 extends Migration {

  override up(): void | Promise<void> {
    this.addSql(`alter table "bets" add "version" int not null default 1;`);
    this.addSql(`alter table "bets" add constraint "bets_version_check" check (version > 0);`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "bets" drop constraint "bets_version_check";`);
    this.addSql(`alter table "bets" drop column "version";`);
  }

}
