/// <reference types="bun-types" />

import { describe, expect, it, mock } from "bun:test";
import { OutboxStatus } from "@crash/persistence";
import {
  PostgresOutboxRepository,
  buildBrokerEnvelope,
  type RawOutboxRow,
} from "../../src";

describe("PostgresOutboxRepository", () => {
  it("persists normalized outbox messages through the configured schema", async () => {
    const persistedEntities: unknown[] = [];
    const em = {
      create: (_schema: unknown, entity: unknown) => entity,
      persist: (entity: unknown) => {
        persistedEntities.push(entity);
      },
    } as const;

    const repository = new PostgresOutboxRepository(em as never, {
      schema: { name: "WalletOutboxMessageSchema" },
      tableName: "wallet_outbox_messages",
    });

    const record = await repository.insert({
      id: "outbox-1",
      aggregateType: "wallet",
      aggregateId: "wallet-1",
      eventType: "wallet.created",
      exchangeName: "wallets.domain",
      routingKey: "wallet.created",
      idempotencyKey: "wallet-1",
      payload: buildBrokerEnvelope({
        eventType: "wallet.created",
        occurredAt: "2026-04-16T02:30:00.000Z",
        aggregateType: "wallet",
        aggregateId: "wallet-1",
        producer: "wallets",
        idempotencyKey: "wallet-1",
        data: {
          walletId: "wallet-1",
        },
      }),
    });

    expect(record.status).toBe(OutboxStatus.PENDING);
    expect(persistedEntities).toHaveLength(1);
    expect(persistedEntities[0]).toMatchObject({
      id: "outbox-1",
      aggregateType: "wallet",
      aggregateId: "wallet-1",
    });
  });

  it("claims rows from the configured table and maps them back to records", async () => {
    const execute = mock(async (sql: string) => {
      expect(sql).toContain("from wallet_outbox_messages");

      return [
        {
          id: "outbox-1",
          aggregate_type: "wallet",
          aggregate_id: "wallet-1",
          event_type: "wallet.created",
          exchange_name: "wallets.domain",
          routing_key: "wallet.created",
          payload: buildBrokerEnvelope({
            eventType: "wallet.created",
            occurredAt: "2026-04-16T02:30:00.000Z",
            aggregateType: "wallet",
            aggregateId: "wallet-1",
            producer: "wallets",
            idempotencyKey: "wallet-1",
            data: {
              walletId: "wallet-1",
            },
          }),
          headers: {},
          correlation_id: null,
          causation_id: null,
          idempotency_key: "wallet-1",
          partition_key: null,
          status: OutboxStatus.PROCESSING,
          attempts: 0,
          available_at: "2026-04-16T02:30:00.000Z",
          locked_at: "2026-04-16T02:30:00.000Z",
          locked_by: "worker-1",
          published_at: null,
          last_error: null,
          created_at: "2026-04-16T02:30:00.000Z",
          updated_at: "2026-04-16T02:30:00.000Z",
        } satisfies RawOutboxRow,
      ];
    });
    const em = {
      getConnection: () => ({
        execute,
      }),
    } as const;

    const repository = new PostgresOutboxRepository(em as never, {
      schema: {},
      tableName: "wallet_outbox_messages",
    });

    const messages = await repository.claimBatch({
      batchSize: 50,
      claimedAt: new Date("2026-04-16T02:30:00.000Z"),
      expiredLockAt: new Date("2026-04-16T02:29:30.000Z"),
      workerId: "worker-1",
    });

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      id: "outbox-1",
      aggregateType: "wallet",
      status: OutboxStatus.PROCESSING,
    });
  });

  it("returns affected rows when expired locks are released", async () => {
    const execute = mock(async () => ({
      affectedRows: 2,
    }));
    const em = {
      getConnection: () => ({
        execute,
      }),
    } as const;

    const repository = new PostgresOutboxRepository(em as never, {
      schema: {},
      tableName: "wallet_outbox_messages",
    });

    const released = await repository.releaseExpiredLocks({
      expiredLockAt: new Date("2026-04-16T02:29:30.000Z"),
      releasedAt: new Date("2026-04-16T02:30:00.000Z"),
    });

    expect(released).toBe(2);
  });
});
