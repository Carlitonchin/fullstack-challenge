import { Migration } from '@mikro-orm/migrations';

export class Migration20260416133229 extends Migration {

  override up(): void | Promise<void> {
    this.addSql(`create type "wallet_outbox_status" as enum ('PENDING', 'PROCESSING', 'PUBLISHED', 'FAILED');`);
    this.addSql(`create table "wallet_outbox_messages" ("id" text not null, "aggregate_type" text not null, "aggregate_id" text not null, "event_type" text not null, "topic" text not null, "routing_key" text not null, "payload" jsonb not null, "headers" jsonb not null, "correlation_id" text null, "causation_id" text null, "idempotency_key" text not null, "partition_key" text null, "status" "wallet_outbox_status" not null, "attempts" int not null, "available_at" timestamptz not null, "locked_at" timestamptz null, "locked_by" text null, "published_at" timestamptz null, "last_error" text null, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("id"));`);
    this.addSql(`create index "wallet_outbox_messages_status_available_at_created_at_index" on "wallet_outbox_messages" ("status", "available_at", "created_at");`);
    this.addSql(`create index "wallet_outbox_messages_aggregate_type_aggregate_id_created_at_index" on "wallet_outbox_messages" ("aggregate_type", "aggregate_id", "created_at");`);
    this.addSql(`create index "wallet_outbox_messages_correlation_id_index" on "wallet_outbox_messages" ("correlation_id");`);
    this.addSql(`alter table "wallet_outbox_messages" add constraint "wallet_outbox_messages_event_type_idempotency_key_unique" unique ("event_type", "idempotency_key");`);

    this.addSql(`alter table "wallet_outbox_messages" add constraint "wallet_outbox_messages_attempts_check" check (attempts >= 0);`);

    this.addSql(`alter table "wallet_operations" alter column "ledger_sequence" drop default;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "wallet_outbox_messages" cascade;`);

    this.addSql(`create sequence if not exists "wallet_operations_ledger_sequence_seq";`);
    this.addSql(`select setval('wallet_operations_ledger_sequence_seq', (select max("ledger_sequence") from "wallet_operations"));`);
    this.addSql(`alter table "wallet_operations" alter column "ledger_sequence" set default nextval('wallet_operations_ledger_sequence_seq');`);

    this.addSql(`drop type "wallet_outbox_status";`);
  }

}
