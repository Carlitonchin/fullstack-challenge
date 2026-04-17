import { Migration } from '@mikro-orm/migrations';

export class Migration20260417131229 extends Migration {

  override up(): void | Promise<void> {
    this.addSql(`create table "provably_fair_strategy_definitions" ("id" text not null, "strategy_id" text not null, "algorithm" text not null, "version" text not null, "display_name" text not null, "description" text not null, "hash_algorithm" text not null, "outcome_algorithm" text not null, "house_edge_description" text not null, "verification_formula" text not null, "verification_steps" jsonb not null, "created_at" timestamptz not null, primary key ("id"));`);
    this.addSql(`create index "provably_fair_strategy_definitions_strategy_id_created_at_index" on "provably_fair_strategy_definitions" ("strategy_id", "created_at");`);
    this.addSql(`alter table "provably_fair_strategy_definitions" add constraint "provably_fair_strategy_definitions_strategy_id_version_unique" unique ("strategy_id", "version");`);
    this.addSql(`alter table "provably_fair_strategy_definitions" add constraint "provably_fair_strategy_definitions_strategy_id_check" check (length(trim(strategy_id)) > 0);`);
    this.addSql(`alter table "provably_fair_strategy_definitions" add constraint "provably_fair_strategy_definitions_algorithm_check" check (length(trim(algorithm)) > 0);`);
    this.addSql(`alter table "provably_fair_strategy_definitions" add constraint "provably_fair_strategy_definitions_version_check" check (length(trim(version)) > 0);`);
    this.addSql(`alter table "provably_fair_strategy_definitions" add constraint "provably_fair_strategy_definitions_display_name_check" check (length(trim(display_name)) > 0);`);
    this.addSql(`alter table "provably_fair_strategy_definitions" add constraint "provably_fair_strategy_definitions_description_check" check (length(trim(description)) > 0);`);
    this.addSql(`alter table "provably_fair_strategy_definitions" add constraint "provably_fair_strategy_definitions_hash_algorithm_check" check (length(trim(hash_algorithm)) > 0);`);
    this.addSql(`alter table "provably_fair_strategy_definitions" add constraint "provably_fair_strategy_definitions_outcome_algorithm_check" check (length(trim(outcome_algorithm)) > 0);`);
    this.addSql(`alter table "provably_fair_strategy_definitions" add constraint "provably_fair_strategy_definitions_house_edge_description_check" check (length(trim(house_edge_description)) > 0);`);
    this.addSql(`alter table "provably_fair_strategy_definitions" add constraint "provably_fair_strategy_definitions_verification_formula_check" check (length(trim(verification_formula)) > 0);`);
  }

}
