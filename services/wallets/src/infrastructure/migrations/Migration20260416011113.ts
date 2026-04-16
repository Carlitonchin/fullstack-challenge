import { Migration } from '@mikro-orm/migrations';

export class Migration20260416011113 extends Migration {

  override up(): void | Promise<void> {
    this.addSql(`create type "wallet_currency_type" as enum ('BRL');`);
    this.addSql(`create type "operation_type" as enum ('BET_STAKE_LOCK', 'BET_STAKE_REFUND', 'BET_PAYOUT');`);
    this.addSql(`create table "wallets" ("id" text not null, "player_id" text not null, "currency" "wallet_currency_type" not null, "created_at" timestamptz not null, primary key ("id"));`);
    this.addSql(`alter table "wallets" add constraint "wallets_player_id_unique" unique ("player_id");`);

    this.addSql(`create table "wallet_operations" ("id" text not null, "wallet_id" text not null, "amount_cents" bigint not null, "operation_id" text not null, "operation_type" "operation_type" not null, "ledger_sequence" bigint generated always as identity not null, "created_at" timestamptz not null, primary key ("id"));`);
    this.addSql(`alter table "wallet_operations" add constraint "wallet_operations_operation_id_unique" unique ("operation_id");`);
    this.addSql(`alter table "wallet_operations" add constraint "wallet_operations_ledger_sequence_unique" unique ("ledger_sequence");`);
    this.addSql(`create index "wallet_operations_wallet_id_ledger_sequence_index" on "wallet_operations" ("wallet_id", "ledger_sequence");`);
    this.addSql(`create index "wallet_operations_wallet_id_created_at_index" on "wallet_operations" ("wallet_id", "created_at");`);
    this.addSql(`alter table "wallet_operations" add constraint "wallet_operations_amount_cents_check" check (amount_cents <> 0);`);
    this.addSql(`alter table "wallet_operations" add constraint "wallet_operations_ledger_sequence_check" check (ledger_sequence > 0);`);

    this.addSql(`alter table "wallet_operations" add constraint "wallet_operations_wallet_id_foreign" foreign key ("wallet_id") references "wallets" ("id") on update restrict on delete restrict;`);
    this.addSql(`
      create or replace function prevent_negative_wallet_balance()
      returns trigger
      language plpgsql
      as $$
      declare
        current_balance bigint;
      begin
        perform 1
        from "wallets"
        where "id" = new."wallet_id"
        for update;

        select coalesce(sum("amount_cents"), 0)
          into current_balance
        from "wallet_operations"
        where "wallet_id" = new."wallet_id";

        if current_balance + new."amount_cents" < 0 then
          raise exception 'wallet balance cannot be negative for wallet_id=%', new."wallet_id";
        end if;

        return new;
      end;
      $$;
    `);
    this.addSql(`
      create trigger wallet_operations_prevent_negative_balance
      before insert on "wallet_operations"
      for each row
      execute function prevent_negative_wallet_balance();
    `);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop trigger if exists wallet_operations_prevent_negative_balance on "wallet_operations";`);
    this.addSql(`drop function if exists prevent_negative_wallet_balance();`);
    this.addSql(`alter table "wallet_operations" drop constraint if exists "wallet_operations_wallet_id_foreign";`);
    this.addSql(`drop table if exists "wallet_operations" cascade;`);
    this.addSql(`drop table if exists "wallets" cascade;`);
    this.addSql(`drop type if exists "operation_type";`);
    this.addSql(`drop type if exists "wallet_currency_type";`);
  }
}
