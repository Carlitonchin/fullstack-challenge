import type { OutboxRuntimeConfig } from "./types";

export function createOutboxRuntimeConfig(
  overrides: Partial<Pick<OutboxRuntimeConfig, "exchangeType">> = {},
): OutboxRuntimeConfig {
  return {
    rabbitMqUrl: readRequiredString("RABBITMQ_URL"),
    exchangeType: overrides.exchangeType ?? "topic",
    batchSize: readPositiveInteger("OUTBOX_BATCH_SIZE", 50),
    pollingIntervalMs: readPositiveInteger("OUTBOX_POLLING_INTERVAL_MS", 1000),
    maxAttempts: readPositiveInteger("OUTBOX_MAX_ATTEMPTS", 8),
    lockTimeoutMs: readPositiveInteger("OUTBOX_LOCK_TIMEOUT_MS", 30000),
    maxBackoffMs: readPositiveInteger("OUTBOX_MAX_BACKOFF_MS", 300000),
  };
}

function readRequiredString(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

function readPositiveInteger(name: string, defaultValue: number): number {
  const rawValue = process.env[name]?.trim();

  if (!rawValue) {
    return defaultValue;
  }

  const value = Number.parseInt(rawValue, 10);

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return value;
}
