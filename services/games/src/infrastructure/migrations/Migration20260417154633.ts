import { Migration } from '@mikro-orm/migrations';

export class Migration20260417154633 extends Migration {

  override up(): void | Promise<void> {
    this.addSql(`drop index "provably_fair_strategy_definitions_strategy_id_created_at_index";`);
    this.addSql(`alter table "provably_fair_strategy_definitions" drop constraint "provably_fair_strategy_definitions_strategy_id_version_unique";`);
    this.addSql(`alter table "provably_fair_strategy_definitions" drop constraint "provably_fair_strategy_definitions_strategy_id_check";`);
    this.addSql(`alter table "provably_fair_strategy_definitions" drop constraint "provably_fair_strategy_definitions_version_check";`);
    this.addSql(`alter table "provably_fair_strategy_definitions" drop column "strategy_id", drop column "version";`);
    this.addSql(`create index "provably_fair_strategy_definitions_created_at_index" on "provably_fair_strategy_definitions" ("created_at");`);

    this.addSql(`alter table "rounds" drop constraint "rounds_crash_point_check";`);
    this.addSql(`alter table "rounds" add constraint "rounds_crash_point_check" check (crash_point >= 1);`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop index "provably_fair_strategy_definitions_created_at_index";`);
    this.addSql(`alter table "provably_fair_strategy_definitions" add "strategy_id" text not null, add "version" text not null;`);
    this.addSql(`create index "provably_fair_strategy_definitions_strategy_id_created_at_index" on "provably_fair_strategy_definitions" ("strategy_id", "created_at");`);
    this.addSql(`alter table "provably_fair_strategy_definitions" add constraint "provably_fair_strategy_definitions_strategy_id_version_unique" unique ("strategy_id", "version");`);
    this.addSql(`alter table "provably_fair_strategy_definitions" add constraint "provably_fair_strategy_definitions_strategy_id_check" check (length(trim(strategy_id)) > 0);`);
    this.addSql(`alter table "provably_fair_strategy_definitions" add constraint "provably_fair_strategy_definitions_version_check" check (length(trim(version)) > 0);`);

    this.addSql(`alter table "rounds" drop constraint "rounds_crash_point_check";`);
    this.addSql(`alter table "rounds" add constraint "rounds_crash_point_check" check (crash_point > 1);`);
  }

}
