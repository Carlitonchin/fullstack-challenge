import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { OutboxDispatcherService } from "@wallets/application/outbox/outbox-dispatcher.service";
import { OutboxConfigService } from "../config/outbox.config";

@Injectable()
export class OutboxPublisherWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxPublisherWorker.name);
  private readonly workerId = `wallets:${Bun.randomUUIDv7()}`;
  private running = false;
  private loopPromise: Promise<void> | null = null;

  constructor(
    private readonly outboxDispatcherService: OutboxDispatcherService,
    private readonly outboxConfigService: OutboxConfigService,
  ) {}

  onModuleInit(): void {
    this.running = true;
    this.loopPromise = this.runLoop();
  }

  async onModuleDestroy(): Promise<void> {
    this.running = false;
    await this.loopPromise;
    await this.outboxDispatcherService.shutdown();
  }

  private async runLoop(): Promise<void> {
    while (this.running) {
      try {
        const dispatchedMessages = await this.outboxDispatcherService.dispatchAvailableMessages(
          this.workerId,
        );

        const delayMs =
          dispatchedMessages > 0
            ? 25
            : this.outboxConfigService.values.pollingIntervalMs;

        await this.sleep(delayMs);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        this.logger.error(`Outbox worker loop failed: ${reason}`);
        await this.sleep(this.outboxConfigService.values.pollingIntervalMs);
      }
    }
  }

  private async sleep(delayMs: number): Promise<void> {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, delayMs);
    });
  }
}
