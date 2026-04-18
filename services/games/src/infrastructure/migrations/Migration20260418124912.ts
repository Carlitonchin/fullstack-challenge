import { Migration } from '@mikro-orm/migrations';

export class Migration20260418124912 extends Migration {

  override up(): void | Promise<void> {
    this.addSql(`alter table "bets" drop constraint "bets_round_id_player_id_unique";`);
    this.addSql(`create unique index "bets_round_id_player_id_active_unique" on "bets" ("round_id", "player_id") where "status" <> 'REJECTED';`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "bets" drop constraint "bets_round_id_player_id_active_unique";`);
    this.addSql(`alter table "bets" add constraint "bets_round_id_player_id_unique" unique ("round_id", "player_id");`);
  }

}
