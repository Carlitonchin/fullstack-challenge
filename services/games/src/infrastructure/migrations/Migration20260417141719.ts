import { Migration } from '@mikro-orm/migrations';

export class Migration20260417141719 extends Migration {

  override up(): void | Promise<void> {
    this.addSql(`create type "bet_status_type" as enum ('PENDING', 'ACCEPTED', 'CASHED_OUT', 'LOST', 'SETTLED', 'REJECTED');`);
    this.addSql(`create table "bets" ("id" text not null, "round_id" text not null, "player_id" text not null, "amount_in_cents" bigint not null, "currency" text not null, "status" "bet_status_type" not null, "placed_at" timestamptz not null, "accepted_at" timestamptz null, "rejected_at" timestamptz null, "rejection_reason" text null, "cashed_out_at" timestamptz null, "cashout_multiplier" numeric(12,4) null, "payout_amount_in_cents" bigint null, "lost_at" timestamptz null, "settled_at" timestamptz null, "created_at" timestamptz not null, primary key ("id"));`);
    this.addSql(`create index "bets_round_id_created_at_index" on "bets" ("round_id", "created_at");`);
    this.addSql(`create index "bets_player_id_created_at_index" on "bets" ("player_id", "created_at");`);
    this.addSql(`create index "bets_status_created_at_index" on "bets" ("status", "created_at");`);

    this.addSql(`alter table "bets" add constraint "bets_round_id_foreign" foreign key ("round_id") references "rounds" ("id") on update restrict on delete restrict;`);
    this.addSql(`alter table "bets" add constraint "bets_player_id_check" check (length(trim(player_id)) > 0);`);
    this.addSql(`alter table "bets" add constraint "bets_currency_check" check (length(trim(currency)) > 0);`);
    this.addSql(`alter table "bets" add constraint "bets_rejection_reason_check" check (rejection_reason is null or length(trim(rejection_reason)) > 0);`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "bets" cascade;`);

    this.addSql(`drop type "bet_status_type";`);
  }

}
