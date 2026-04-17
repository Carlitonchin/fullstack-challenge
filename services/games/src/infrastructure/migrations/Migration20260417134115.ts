import { Migration } from '@mikro-orm/migrations';

export class Migration20260417134115 extends Migration {

  override up(): void | Promise<void> {
    this.addSql(`alter table "rounds" add "version" int not null default 1;`);
    this.addSql(`alter table "rounds" add constraint "rounds_version_check" check (version > 0);`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "rounds" drop constraint "rounds_version_check";`);
    this.addSql(`alter table "rounds" drop column "version";`);
  }

}
