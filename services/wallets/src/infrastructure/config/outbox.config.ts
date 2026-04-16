import { Injectable } from "@nestjs/common";

export type OutboxRuntimeConfig = {
  rabbitMqUrl: string;
  exchangeType: "topic";
  batchSize: number;
  pollingIntervalMs: number;
  maxAttempts: number;
  lockTimeoutMs: number;
  maxBackoffMs: number;
};

@Injectable()
export class OutboxConfigService {
  private readonly config: OutboxRuntimeConfig = {
    rabbitMqUrl: this.readRequiredString("RABBITMQ_URL"),
    exchangeType: "topic",
    batchSize: this.readPositiveInteger("OUTBOX_BATCH_SIZE", 50),
    pollingIntervalMs: this.readPositiveInteger("OUTBOX_POLLING_INTERVAL_MS", 1000),
    maxAttempts: this.readPositiveInteger("OUTBOX_MAX_ATTEMPTS", 8),
    lockTimeoutMs: this.readPositiveInteger("OUTBOX_LOCK_TIMEOUT_MS", 30000),
    maxBackoffMs: this.readPositiveInteger("OUTBOX_MAX_BACKOFF_MS", 300000),
  };

  get values(): OutboxRuntimeConfig {
    return this.config;
  }

  private readRequiredString(name: string): string {
    const value = process.env[name]?.trim();

    if (!value) {
      throw new Error(`${name} is required`);
    }

    return value;
  }

  private readPositiveInteger(name: string, defaultValue: number): number {
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
}
