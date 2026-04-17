/// <reference types="bun-types" />

import { describe, expect, it, mock } from "bun:test";
import { OutboxStatus } from "@crash/persistence";
import {
  OutboxDispatcherService,
  UnroutableBrokerMessageError,
  type BrokerPublisher,
  type Clock,
  type MarkOutboxRetryParams,
  type OutboxMessageRecord,
  type OutboxRepository,
  type OutboxRuntimeConfig,
} from "../../src";

describe("OutboxDispatcherService", () => {
  const FIXED_NOW = new Date("2026-04-16T12:00:00.000Z");

  function createMessage(
    overrides: Partial<OutboxMessageRecord> = {},
  ): OutboxMessageRecord {
    return {
      id: "outbox-1",
      aggregateType: "wallet",
      aggregateId: "wallet-1",
      eventType: "wallet.created",
      exchangeName: "wallets.domain",
      routingKey: "wallet.created",
      payload: {
        eventType: "wallet.created",
        occurredAt: FIXED_NOW.toISOString(),
        version: 1,
        aggregate: {
          type: "wallet",
          id: "wallet-1",
        },
        metadata: {
          idempotencyKey: "wallet-1",
          producer: "wallets",
          aggregateType: "wallet",
          aggregateId: "wallet-1",
        },
        data: {
          walletId: "wallet-1",
        },
      },
      headers: {},
      correlationId: null,
      causationId: null,
      idempotencyKey: "wallet-1",
      partitionKey: null,
      status: OutboxStatus.PROCESSING,
      attempts: 0,
      availableAt: FIXED_NOW,
      lockedAt: FIXED_NOW,
      lockedBy: "worker-1",
      publishedAt: null,
      lastError: null,
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
      ...overrides,
    };
  }

  function createConfig(
    overrides: Partial<OutboxRuntimeConfig> = {},
  ): OutboxRuntimeConfig {
    return {
      rabbitMqUrl: "amqp://admin:admin@rabbitmq:5672",
      exchangeType: "topic",
      batchSize: 50,
      pollingIntervalMs: 1000,
      maxAttempts: 3,
      lockTimeoutMs: 30000,
      maxBackoffMs: 60000,
      ...overrides,
    };
  }

  function createRepository(
    overrides: Partial<OutboxRepository> = {},
  ): OutboxRepository {
    return {
      insert: mock(async () => createMessage()),
      releaseExpiredLocks: mock(async () => 0),
      claimBatch: mock(async () => [createMessage()]),
      markPublished: mock(async () => undefined),
      markRetry: mock(async () => undefined),
      markUnroutable: mock(async () => undefined),
      markFailed: mock(async () => undefined),
      ...overrides,
    };
  }

  function createPublisher(
    overrides: Partial<BrokerPublisher> = {},
  ): BrokerPublisher {
    return {
      publish: mock(async () => undefined),
      close: mock(async () => undefined),
      ...overrides,
    };
  }

  function createClock(): Clock {
    return {
      now: () => FIXED_NOW,
    };
  }

  function createService(params?: {
    repository?: OutboxRepository;
    publisher?: BrokerPublisher;
    config?: Partial<OutboxRuntimeConfig>;
  }): OutboxDispatcherService {
    return new OutboxDispatcherService(
      params?.repository ?? createRepository(),
      params?.publisher ?? createPublisher(),
      createClock(),
      createConfig(params?.config),
    );
  }

  it("marks messages as published only after broker publish succeeds", async () => {
    const publish = mock(async () => undefined);
    const markPublished = mock(async () => undefined);
    const service = createService({
      repository: createRepository({ markPublished }),
      publisher: createPublisher({ publish }),
    });

    const dispatched = await service.dispatchAvailableMessages("worker-1");

    expect(dispatched).toBe(1);
    expect(publish).toHaveBeenCalledTimes(1);
    expect(markPublished).toHaveBeenCalledTimes(1);
  });

  it("retries a failed publish with a future availability date", async () => {
    let receivedRetryParams: MarkOutboxRetryParams | null = null;
    const markRetry = mock(async (params: MarkOutboxRetryParams) => {
      receivedRetryParams = params;
    });
    const service = createService({
      repository: createRepository({
        claimBatch: mock(async () => [createMessage({ attempts: 1 })]),
        markRetry,
      }),
      publisher: createPublisher({
        publish: mock(async () => {
          throw new Error("broker unavailable");
        }),
      }),
    });

    await service.dispatchAvailableMessages("worker-1");

    expect(receivedRetryParams).not.toBeNull();
    expect(receivedRetryParams!.availableAt).toBeInstanceOf(Date);
    expect(receivedRetryParams!.availableAt.getTime()).toBeGreaterThan(
      FIXED_NOW.getTime(),
    );
  });

  it("keeps retrying unroutable messages before max attempts is reached", async () => {
    const markRetry = mock(async () => undefined);
    const markUnroutable = mock(async () => undefined);
    const service = createService({
      repository: createRepository({
        claimBatch: mock(async () => [createMessage({ attempts: 0 })]),
        markRetry,
        markUnroutable,
      }),
      publisher: createPublisher({
        publish: mock(async () => {
          throw new UnroutableBrokerMessageError(
            "outbox-1",
            "wallets.domain",
            "wallet.created",
          );
        }),
      }),
      config: { maxAttempts: 3 },
    });

    await service.dispatchAvailableMessages("worker-1");

    expect(markRetry).toHaveBeenCalledTimes(1);
    expect(markUnroutable).toHaveBeenCalledTimes(0);
  });

  it("marks unroutable messages as UNROUTABLE only after retries are exhausted", async () => {
    const markFailed = mock(async () => undefined);
    const markUnroutable = mock(async () => undefined);
    const service = createService({
      repository: createRepository({
        claimBatch: mock(async () => [createMessage({ attempts: 0 })]),
        markFailed,
        markUnroutable,
      }),
      publisher: createPublisher({
        publish: mock(async () => {
          throw new UnroutableBrokerMessageError(
            "outbox-1",
            "wallets.domain",
            "wallet.created",
          );
        }),
      }),
      config: { maxAttempts: 1 },
    });

    await service.dispatchAvailableMessages("worker-1");

    expect(markUnroutable).toHaveBeenCalledTimes(1);
    expect(markFailed).toHaveBeenCalledTimes(0);
  });

  it("marks the message as failed when max attempts is reached for non-routing errors", async () => {
    const markFailed = mock(async () => undefined);
    const service = createService({
      repository: createRepository({
        claimBatch: mock(async () => [createMessage({ attempts: 2 })]),
        markFailed,
      }),
      publisher: createPublisher({
        publish: mock(async () => {
          throw new Error("unavailable channel");
        }),
      }),
      config: { maxAttempts: 3 },
    });

    await service.dispatchAvailableMessages("worker-1");

    expect(markFailed).toHaveBeenCalledTimes(1);
  });
});
