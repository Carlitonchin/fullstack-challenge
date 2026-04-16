/// <reference types="bun-types" />

import { describe, expect, it, mock } from "bun:test";
import { OutboxDispatcherService } from "../../src/application/outbox/outbox-dispatcher.service";
import { type OutboxRuntimeConfig } from "../../src/infrastructure/config/outbox.config";
import {
  WalletOutboxStatus,
  type WalletOutboxMessageRecord,
} from "../../src/infrastructure/schema/wallet-outbox-message";
import {
  UnroutableBrokerMessageError,
  type IBrokerPublisher,
} from "../../src/port/broker-publisher";
import {
  type IWalletOutboxRepository,
  type MarkWalletOutboxRetryParams,
  type MarkWalletOutboxUnroutableParams,
} from "../../src/port/wallet-outbox.repository";
import { type ITimeProvider } from "../../src/port/time-provider";

describe("OutboxDispatcherService", () => {
  const FIXED_NOW = new Date("2026-04-16T12:00:00.000Z");

  function createMessage(
    overrides: Partial<WalletOutboxMessageRecord> = {},
  ): WalletOutboxMessageRecord {
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
      status: WalletOutboxStatus.PROCESSING,
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
    overrides: Partial<IWalletOutboxRepository> = {},
  ): IWalletOutboxRepository {
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

  function createPublisher(overrides: Partial<IBrokerPublisher> = {}): IBrokerPublisher {
    return {
      publish: mock(async () => undefined),
      close: mock(async () => undefined),
      ...overrides,
    };
  }

  function createTimeProvider(): ITimeProvider {
    return {
      now: () => FIXED_NOW,
    };
  }

  function createService(params?: {
    repository?: IWalletOutboxRepository;
    publisher?: IBrokerPublisher;
    config?: Partial<OutboxRuntimeConfig>;
  }): OutboxDispatcherService {
    return new OutboxDispatcherService(
      params?.repository ?? createRepository(),
      params?.publisher ?? createPublisher(),
      createTimeProvider(),
      { values: createConfig(params?.config) },
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
    let receivedRetryParams: MarkWalletOutboxRetryParams | null = null;
    const service = createService({
      repository: createRepository({
        claimBatch: mock(async () => [createMessage({ attempts: 1 })]),
        markRetry: mock(async (params: MarkWalletOutboxRetryParams) => {
          receivedRetryParams = params;
        }),
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
    let receivedRetryParams: MarkWalletOutboxRetryParams | null = null;
    let receivedUnroutableParams: MarkWalletOutboxUnroutableParams | null = null;
    const service = createService({
      repository: createRepository({
        claimBatch: mock(async () => [createMessage({ attempts: 0 })]),
        markRetry: mock(async (params: MarkWalletOutboxRetryParams) => {
          receivedRetryParams = params;
        }),
        markUnroutable: mock(async (params: MarkWalletOutboxUnroutableParams) => {
          receivedUnroutableParams = params;
        }),
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

    expect(receivedRetryParams).not.toBeNull();
    expect(receivedUnroutableParams).toBeNull();
  });

  it("marks unroutable messages as UNROUTABLE only after retries are exhausted", async () => {
    let receivedUnroutableParams: MarkWalletOutboxUnroutableParams | null = null;
    const markFailed = mock(async () => undefined);
    const service = createService({
      repository: createRepository({
        claimBatch: mock(async () => [createMessage({ attempts: 0 })]),
        markFailed,
        markUnroutable: mock(async (params: MarkWalletOutboxUnroutableParams) => {
          receivedUnroutableParams = params;
        }),
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

    expect(receivedUnroutableParams).not.toBeNull();
    expect(receivedUnroutableParams!.availableAt).toBeInstanceOf(Date);
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
