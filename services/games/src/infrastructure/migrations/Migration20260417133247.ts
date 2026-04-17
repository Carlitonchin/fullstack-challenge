import { Migration } from '@mikro-orm/migrations';

export class Migration20260417133247 extends Migration {

  override up(): void | Promise<void> {
    this.addSql(`create type "round_status_type" as enum ('BETTING_OPEN', 'BETTING_CLOSED', 'IN_PROGRESS', 'CRASHED', 'ERROR', 'SETTLED');`);
    this.addSql(`create table "rounds" ("id" text not null, "status" "round_status_type" not null, "crash_point" numeric(12,4) not null, "provably_fair_strategy_id" text not null, "nonce" text not null, "server_seed_hash" text not null, "server_seed" text not null, "started_at" timestamptz null, "betting_closes_at" timestamptz not null, "crashed_at" timestamptz null, "crash_multiplier" numeric(12,4) null, "failed_at" timestamptz null, "error_reason" text null, "refund_required" boolean not null default false, "created_at" timestamptz not null, primary key ("id"));`);
    this.addSql(`create index "rounds_status_created_at_index" on "rounds" ("status", "created_at");`);
    this.addSql(`create index "rounds_provably_fair_strategy_id_created_at_index" on "rounds" ("provably_fair_strategy_id", "created_at");`);

    this.addSql(`alter table "rounds" add constraint "rounds_provably_fair_strategy_id_foreign" foreign key ("provably_fair_strategy_id") references "provably_fair_strategy_definitions" ("id") on update restrict on delete restrict;`);
    this.addSql(`alter table "rounds" add constraint "rounds_crash_point_check" check (crash_point > 1);`);
    this.addSql(`alter table "rounds" add constraint "rounds_nonce_check" check (length(trim(nonce)) > 0);`);
    this.addSql(`alter table "rounds" add constraint "rounds_server_seed_hash_check" check (length(trim(server_seed_hash)) > 0);`);
    this.addSql(`alter table "rounds" add constraint "rounds_server_seed_check" check (length(trim(server_seed)) > 0);`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "rounds" cascade;`);

    this.addSql(`drop type "round_status_type";`);
  }

}
