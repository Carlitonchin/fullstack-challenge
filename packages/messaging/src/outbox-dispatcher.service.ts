import { Inject, Injectable, Logger } from "@nestjs/common";
import { UnroutableBrokerMessageError } from "./errors";
import { calculateNextAttemptAt } from "./outbox-message";
import {
  BROKER_PUBLISHER,
  CLOCK,
  OUTBOX_REPOSITORY,
  OUTBOX_RUNTIME_CONFIG,
} from "./tokens";
import type {
  BrokerPublisher,
  Clock,
  OutboxMessageRecord,
  OutboxRepository,
  OutboxRuntimeConfig,
} from "./types";

@Injectable()
export class OutboxDispatcherService {
  private readonly logger = new Logger(OutboxDispatcherService.name);

  constructor(
    @Inject(OUTBOX_REPOSITORY)
    private readonly outboxRepository: OutboxRepository,
    @Inject(BROKER_PUBLISHER)
    private readonly brokerPublisher: BrokerPublisher,
    @Inject(CLOCK)
    private readonly clock: Clock,
    @Inject(OUTBOX_RUNTIME_CONFIG)
    private readonly outboxConfig: OutboxRuntimeConfig,
  ) {}

  async dispatchAvailableMessages(workerId: string): Promise<number> {
    const now = this.clock.now();
    const expiredLockAt = new Date(
      now.getTime() - this.outboxConfig.lockTimeoutMs,
    );

    await this.outboxRepository.releaseExpiredLocks({
      expiredLockAt,
      releasedAt: now,
    });

    const messages = await this.outboxRepository.claimBatch({
      batchSize: this.outboxConfig.batchSize,
      claimedAt: now,
      expiredLockAt,
      workerId,
    });

    for (const message of messages) {
      await this.dispatchMessage(message, workerId, now);
    }

    return messages.length;
  }

  async shutdown(): Promise<void> {
    await this.brokerPublisher.close();
  }

  private async dispatchMessage(
    message: OutboxMessageRecord,
    workerId: string,
    now: Date,
  ): Promise<void> {
    try {
      await this.brokerPublisher.publish({
        exchangeName: message.exchangeName,
        routingKey: message.routingKey,
        messageId: message.id,
        eventType: message.eventType,
        payload: message.payload as Record<string, unknown>,
        headers: message.headers,
        correlationId: message.correlationId,
        causationId: message.causationId,
      });

      await this.outboxRepository.markPublished({
        messageId: message.id,
        publishedAt: now,
        workerId,
      });
    } catch (error) {
      const reason = this.stringifyError(error);

      if (error instanceof UnroutableBrokerMessageError) {
        this.logger.warn(
          `Outbox message ${message.id} (${message.eventType}) is unroutable in RabbitMQ; marking as UNROUTABLE without retry`,
        );

        await this.outboxRepository.markUnroutable({
          messageId: message.id,
          failedAt: now,
          error: reason,
          workerId,
        });
        return;
      }

      this.logger.warn(
        `Outbox publish failed for ${message.id} (${message.eventType}): ${reason}`,
      );

      const nextAttemptNumber = message.attempts + 1;

      if (nextAttemptNumber >= this.outboxConfig.maxAttempts) {
        await this.outboxRepository.markFailed({
          messageId: message.id,
          failedAt: now,
          error: reason,
          workerId,
        });
        return;
      }

      await this.outboxRepository.markRetry({
        messageId: message.id,
        failedAt: now,
        availableAt: calculateNextAttemptAt(
          nextAttemptNumber,
          now,
          this.outboxConfig.maxBackoffMs,
        ),
        error: reason,
        workerId,
      });
    }
  }

  private stringifyError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}
