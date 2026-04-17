import { Migration } from '@mikro-orm/migrations';

export class Migration20260417190000 extends Migration {

  override up(): void | Promise<void> {
    this.addSql(`alter table "rounds" add "starts_at" timestamptz not null default now(), add "scheduled_crash_at" timestamptz not null default now(), add "settles_at" timestamptz not null default now();`);
    this.addSql(`update "rounds" set "starts_at" = coalesce("started_at", "betting_closes_at"), "scheduled_crash_at" = coalesce("crashed_at", "betting_closes_at"), "settles_at" = coalesce("failed_at", "created_at");`);
    this.addSql(`alter table "rounds" alter column "starts_at" drop default, alter column "scheduled_crash_at" drop default, alter column "settles_at" drop default;`);

    this.addSql(`alter table "bets" add "player_username" text not null default '';`);
    this.addSql(`update "bets" set "player_username" = "player_id" where "player_username" = '';`);
    this.addSql(`alter table "bets" alter column "player_username" drop default;`);
    this.addSql(`alter table "bets" add constraint "bets_round_id_player_id_unique" unique ("round_id", "player_id");`);
    this.addSql(`alter table "bets" add constraint "bets_player_username_check" check (length(trim(player_username)) > 0);`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "bets" drop constraint "bets_round_id_player_id_unique";`);
    this.addSql(`alter table "bets" drop constraint "bets_player_username_check";`);
    this.addSql(`alter table "bets" drop column "player_username";`);

    this.addSql(`alter table "rounds" drop column "starts_at", drop column "scheduled_crash_at", drop column "settles_at";`);
  }

}
