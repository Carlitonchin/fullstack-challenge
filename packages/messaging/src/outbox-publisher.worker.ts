import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { OutboxDispatcherService } from "./outbox-dispatcher.service";
import { OUTBOX_RUNTIME_CONFIG } from "./tokens";
import type { OutboxRuntimeConfig } from "./types";

@Injectable()
export class OutboxPublisherWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxPublisherWorker.name);
  private running = false;
  private loopPromise: Promise<void> | null = null;
  private workerId = `outbox:${Bun.randomUUIDv7()}`;

  constructor(
    private readonly outboxDispatcherService: OutboxDispatcherService,
    @Inject(OUTBOX_RUNTIME_CONFIG)
    private readonly outboxConfig: OutboxRuntimeConfig,
  ) {}

  setWorkerIdPrefix(prefix: string): void {
    this.workerId = `${prefix}:${Bun.randomUUIDv7()}`;
  }

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
        const dispatchedMessages =
          await this.outboxDispatcherService.dispatchAvailableMessages(
            this.workerId,
          );

        const delayMs =
          dispatchedMessages > 0 ? 25 : this.outboxConfig.pollingIntervalMs;

        await this.sleep(delayMs);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        this.logger.error(`Outbox worker loop failed: ${reason}`);
        await this.sleep(this.outboxConfig.pollingIntervalMs);
      }
    }
  }

  private async sleep(delayMs: number): Promise<void> {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, delayMs);
    });
  }
}
