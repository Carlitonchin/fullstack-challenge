import {
  type Channel,
  type ChannelModel,
  type ConsumeMessage,
  connect,
} from "amqplib";
import { Logger } from "@nestjs/common";
import { PoisonMessageError, isPoisonMessageError } from "./consumer-errors";
import { assertConsumerQueueTopology } from "./consumer-topology";
import type { BrokerEnvelope } from "./types";

const DEFAULT_INITIAL_RECONNECT_DELAY_MS = 1000;
const DEFAULT_MAX_RECONNECT_DELAY_MS = 30000;
const DEFAULT_EXCHANGE_TYPE = "topic";

export type ConsumerExchangeBinding = {
  exchangeName: string;
  routingKeys: string[];
  exchangeType?: "topic";
};

export type ResilientAmqpConsumerOptions = {
  name: string;
  rabbitMqUrl: string;
  queueName: string;
  prefetch: number;
  bindings: ConsumerExchangeBinding[];
  supportedEventTypes: readonly string[];
  logger?: Logger;
  initialReconnectDelayMs?: number;
  maxReconnectDelayMs?: number;
  handleMessage: (
    envelope: BrokerEnvelope,
    message: ConsumeMessage,
  ) => Promise<void>;
};

export class ResilientAmqpConsumer {
  private readonly logger: Logger;
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelayMs: number;
  private isStarting = false;
  private stopped = false;

  constructor(private readonly options: ResilientAmqpConsumerOptions) {
    this.logger = options.logger ?? new Logger(ResilientAmqpConsumer.name);
    this.reconnectDelayMs =
      options.initialReconnectDelayMs ?? DEFAULT_INITIAL_RECONNECT_DELAY_MS;
  }

  async start(): Promise<void> {
    if (this.stopped || this.isStarting || this.channel) {
      return;
    }

    this.isStarting = true;

    try {
      const connection = await connect(this.options.rabbitMqUrl);
      const channel = await connection.createChannel();

      this.connection = connection;
      this.channel = channel;

      this.registerConnectionListeners(connection);
      this.registerChannelListeners(channel);

      await this.configureTopology(channel);
      await channel.prefetch(this.options.prefetch);

      await channel.consume(this.options.queueName, (message) => {
        void this.handleDelivery(channel, message);
      });

      this.reconnectDelayMs =
        this.options.initialReconnectDelayMs ??
        DEFAULT_INITIAL_RECONNECT_DELAY_MS;
      this.logger.log(`AMQP consumer connected for ${this.options.name}`);
    } catch (error) {
      await this.closeStaleResources();
      this.scheduleReconnect(error);
    } finally {
      this.isStarting = false;
    }
  }

  async stop(): Promise<void> {
    this.stopped = true;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    await this.closeStaleResources();
  }

  private async configureTopology(channel: Channel): Promise<void> {
    for (const binding of this.options.bindings) {
      await channel.assertExchange(
        binding.exchangeName,
        binding.exchangeType ?? DEFAULT_EXCHANGE_TYPE,
        { durable: true },
      );
    }

    const queue = await assertConsumerQueueTopology(
      channel,
      this.options.queueName,
    );

    for (const binding of this.options.bindings) {
      for (const routingKey of binding.routingKeys) {
        await channel.bindQueue(queue, binding.exchangeName, routingKey);
      }
    }
  }

  private registerConnectionListeners(connection: ChannelModel): void {
    connection.on("close", () => {
      this.logger.warn(
        `AMQP consumer connection closed for ${this.options.name}`,
      );
      this.handleTransportClosed();
    });

    connection.on("error", (error) => {
      this.logger.error(
        `AMQP consumer connection error for ${this.options.name}: ${error.message}`,
      );
    });
  }

  private registerChannelListeners(channel: Channel): void {
    channel.on("close", () => {
      this.logger.warn(`AMQP consumer channel closed for ${this.options.name}`);
      this.handleTransportClosed();
    });

    channel.on("error", (error) => {
      this.logger.error(
        `AMQP consumer channel error for ${this.options.name}: ${error.message}`,
      );
    });
  }

  private handleTransportClosed(): void {
    this.connection = null;
    this.channel = null;
    this.scheduleReconnect();
  }

  private scheduleReconnect(error?: unknown): void {
    if (this.stopped || this.reconnectTimer) {
      return;
    }

    const reason = formatErrorReason(error);

    if (reason) {
      this.logger.error(
        `AMQP consumer start failed for ${this.options.name}: ${reason}`,
      );
    }

    const delayMs = this.reconnectDelayMs;

    this.logger.warn(
      `AMQP consumer reconnect scheduled for ${this.options.name} in ${delayMs}ms`,
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.start();
    }, delayMs);

    this.reconnectDelayMs = Math.min(
      delayMs * 2,
      this.options.maxReconnectDelayMs ?? DEFAULT_MAX_RECONNECT_DELAY_MS,
    );
  }

  private async closeStaleResources(): Promise<void> {
    const channel = this.channel;
    const connection = this.connection;

    this.channel = null;
    this.connection = null;

    if (channel) {
      await channel.close().catch(() => undefined);
    }

    if (connection) {
      await connection.close().catch(() => undefined);
    }
  }

  private async handleDelivery(
    channel: Channel,
    message: ConsumeMessage | null,
  ): Promise<void> {
    if (!message) {
      return;
    }

    try {
      const envelope = this.parseEnvelope(message);
      await this.options.handleMessage(envelope, message);
      this.ack(channel, message);
    } catch (error) {
      const reason = formatErrorReason(error);

      if (isPoisonMessageError(error)) {
        this.logger.error(
          `Dead-lettering poison message on ${this.options.queueName}: ${reason}`,
        );
        this.nack(channel, message, false);
        return;
      }

      this.logger.error(
        `Requeueing transient failure on ${this.options.queueName}: ${reason}`,
      );
      this.nack(channel, message, true);
    }
  }

  private ack(channel: Channel, message: ConsumeMessage): void {
    try {
      channel.ack(message);
    } catch (error) {
      this.logger.error(
        `Failed to ack message on ${this.options.queueName}: ${formatErrorReason(error)}`,
      );
    }
  }

  private nack(
    channel: Channel,
    message: ConsumeMessage,
    requeue: boolean,
  ): void {
    try {
      channel.nack(message, false, requeue);
    } catch (error) {
      this.logger.error(
        `Failed to nack message on ${this.options.queueName}: ${formatErrorReason(error)}`,
      );
    }
  }

  private parseEnvelope(message: ConsumeMessage): BrokerEnvelope {
    let parsed: unknown;

    try {
      parsed = JSON.parse(message.content.toString());
    } catch (error) {
      throw new PoisonMessageError("invalid JSON", { cause: error });
    }

    if (!isBrokerEnvelopeLike(parsed)) {
      throw new PoisonMessageError("missing required envelope fields");
    }

    if (!this.options.supportedEventTypes.includes(parsed.eventType)) {
      throw new PoisonMessageError(`unsupported event type ${parsed.eventType}`);
    }

    return parsed;
  }
}

function isBrokerEnvelopeLike(value: unknown): value is BrokerEnvelope {
  if (!value || typeof value !== "object") {
    return false;
  }

  const envelope = value as Partial<BrokerEnvelope>;

  return (
    typeof envelope.eventType === "string" &&
    envelope.eventType.trim().length > 0 &&
    typeof envelope.occurredAt === "string" &&
    envelope.data !== null &&
    typeof envelope.data === "object" &&
    envelope.metadata !== null &&
    typeof envelope.metadata === "object"
  );
}

function formatErrorReason(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "unknown error";
}
