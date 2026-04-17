import { Migration } from '@mikro-orm/migrations';

export class Migration20260417164836 extends Migration {

  override up(): void | Promise<void> {
    this.addSql(`create type "game_outbox_status" as enum ('PENDING', 'PROCESSING', 'UNROUTABLE', 'PUBLISHED', 'FAILED');`);
    this.addSql(`create table "game_outbox_messages" ("id" text not null, "created_at" timestamptz not null, "aggregate_type" text not null, "aggregate_id" text not null, "event_type" text not null, "exchange_name" text not null, "routing_key" text not null, "payload" jsonb not null, "headers" jsonb not null, "correlation_id" text null, "causation_id" text null, "idempotency_key" text not null, "partition_key" text null, "attempts" int not null, "available_at" timestamptz not null, "locked_at" timestamptz null, "locked_by" text null, "published_at" timestamptz null, "last_error" text null, "updated_at" timestamptz not null, "status" "game_outbox_status" not null, primary key ("id"));`);
    this.addSql(`create index "game_outbox_messages_status_available_at_created_at_index" on "game_outbox_messages" ("status", "available_at", "created_at");`);
    this.addSql(`create index "game_outbox_messages_aggregate_type_aggregate_id_created_at_index" on "game_outbox_messages" ("aggregate_type", "aggregate_id", "created_at");`);
    this.addSql(`create index "game_outbox_messages_correlation_id_index" on "game_outbox_messages" ("correlation_id");`);
    this.addSql(`alter table "game_outbox_messages" add constraint "game_outbox_messages_event_type_idempotency_key_unique" unique ("event_type", "idempotency_key");`);

    this.addSql(`alter table "game_outbox_messages" add constraint "game_outbox_messages_attempts_check" check (attempts >= 0);`);

    this.addSql(`alter table "bets" drop constraint "bets_version_check";`);
    this.addSql(`alter table "bets" add constraint "rounds_version_check" check (version > 0);`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "game_outbox_messages" cascade;`);

    this.addSql(`alter table "bets" drop constraint "rounds_version_check";`);
    this.addSql(`alter table "bets" add constraint "bets_version_check" check (version > 0);`);

    this.addSql(`drop type "game_outbox_status";`);
  }

}
