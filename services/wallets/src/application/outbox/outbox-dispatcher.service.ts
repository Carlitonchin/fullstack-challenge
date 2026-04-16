import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  WALLET_OUTBOX_REPOSITORY,
  type IWalletOutboxRepository,
} from "@wallets/port/wallet-outbox.repository";
import {
  BROKER_PUBLISHER,
  UnroutableBrokerMessageError,
  type IBrokerPublisher,
} from "@wallets/port/broker-publisher";
import {
  TIME_PROVIDER,
  type ITimeProvider,
} from "@wallets/port/time-provider";
import { OutboxConfigService } from "@wallets/infrastructure/config/outbox.config";
import type { WalletOutboxMessageRecord } from "@wallets/infrastructure/schema/wallet-outbox-message";

@Injectable()
export class OutboxDispatcherService {
  private readonly logger = new Logger(OutboxDispatcherService.name);

  constructor(
    @Inject(WALLET_OUTBOX_REPOSITORY)
    private readonly outboxRepository: IWalletOutboxRepository,
    @Inject(BROKER_PUBLISHER)
    private readonly brokerPublisher: IBrokerPublisher,
    @Inject(TIME_PROVIDER)
    private readonly timeProvider: ITimeProvider,
    private readonly outboxConfigService: OutboxConfigService,
  ) {}

  async dispatchAvailableMessages(workerId: string): Promise<number> {
    const now = this.timeProvider.now();
    const config = this.outboxConfigService.values;
    const expiredLockAt = new Date(now.getTime() - config.lockTimeoutMs);

    await this.outboxRepository.releaseExpiredLocks({
      expiredLockAt,
      releasedAt: now,
    });

    const messages = await this.outboxRepository.claimBatch({
      batchSize: config.batchSize,
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
    message: WalletOutboxMessageRecord,
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
      const nextAttemptNumber = message.attempts + 1;

      if (error instanceof UnroutableBrokerMessageError) {
        if (nextAttemptNumber >= this.outboxConfigService.values.maxAttempts) {
          this.logger.log(
            `Outbox message ${message.id} (${message.eventType}) exhausted retries without RabbitMQ bindings; marking as UNROUTABLE`,
          );

          await this.outboxRepository.markUnroutable({
            messageId: message.id,
            failedAt: now,
            availableAt: this.calculateNextAvailableAt(nextAttemptNumber, now),
            error: reason,
            workerId,
          });
          return;
        }
      }

      this.logger.warn(
        `Outbox publish failed for ${message.id} (${message.eventType}): ${reason}`,
      );

      if (nextAttemptNumber >= this.outboxConfigService.values.maxAttempts) {
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
        availableAt: this.calculateNextAvailableAt(nextAttemptNumber, now),
        error: reason,
        workerId,
      });
    }
  }

  private calculateNextAvailableAt(attemptNumber: number, now: Date): Date {
    const maxBackoffMs = this.outboxConfigService.values.maxBackoffMs;
    const baseDelayMs = Math.min(1000 * 2 ** (attemptNumber - 1), maxBackoffMs);
    const jitterMs = Math.floor(Math.random() * Math.max(250, baseDelayMs / 4));

    return new Date(now.getTime() + Math.min(baseDelayMs + jitterMs, maxBackoffMs));
  }

  private stringifyError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}
