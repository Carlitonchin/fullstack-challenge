import { connect, type ChannelModel, type ConfirmChannel, type Message } from "amqplib";
import { Injectable, Logger } from "@nestjs/common";
import {
  UnroutableBrokerMessageError,
  type IBrokerPublisher,
  type PublishBrokerMessageCommand,
} from "@wallets/port/broker-publisher";
import { OutboxConfigService } from "../config/outbox.config";

@Injectable()
export class AmqpBrokerPublisher implements IBrokerPublisher {
  private readonly logger = new Logger(AmqpBrokerPublisher.name);
  private connection: ChannelModel | null = null;
  private channel: ConfirmChannel | null = null;
  private readonly assertedExchanges = new Set<string>();
  private readonly pendingMessages = new Map<string, PendingMessage>();

  constructor(private readonly outboxConfigService: OutboxConfigService) {}

  async publish(command: PublishBrokerMessageCommand): Promise<void> {
    const channel = await this.getChannel();
    await this.assertExchange(channel, command.exchangeName);

    const payloadBuffer = Buffer.from(JSON.stringify(command.payload));

    await new Promise<void>((resolve, reject) => {
      this.pendingMessages.set(command.messageId, {
        exchangeName: command.exchangeName,
        routingKey: command.routingKey,
        resolve,
        reject,
      });

      channel.publish(
        command.exchangeName,
        command.routingKey,
        payloadBuffer,
        {
          persistent: true,
          mandatory: true,
          contentType: "application/json",
          deliveryMode: 2,
          messageId: command.messageId,
          type: command.eventType,
          correlationId: command.correlationId ?? undefined,
          headers: {
            ...command.headers,
            causationId: command.causationId ?? "",
          },
        },
        (error) => {
          queueMicrotask(() => {
            const pendingMessage = this.pendingMessages.get(command.messageId);

            if (!pendingMessage) {
              return;
            }

            this.pendingMessages.delete(command.messageId);

            if (error) {
              pendingMessage.reject(error);
              return;
            }

            pendingMessage.resolve();
          });
        },
      );
    });
  }

  async close(): Promise<void> {
    this.rejectPendingMessages(new Error("AMQP publisher is closing"));

    if (this.channel) {
      await this.channel.close().catch(() => undefined);
      this.channel = null;
    }

    if (this.connection) {
      await this.connection.close().catch(() => undefined);
      this.connection = null;
    }

    this.assertedExchanges.clear();
  }

  private async getChannel(): Promise<ConfirmChannel> {
    if (this.channel) {
      return this.channel;
    }

    const connection = await connect(this.outboxConfigService.values.rabbitMqUrl);
    const channel = await connection.createConfirmChannel();

    connection.on("close", () => {
      this.logger.warn("AMQP connection closed");
      this.connection = null;
      this.channel = null;
      this.assertedExchanges.clear();
      this.rejectPendingMessages(new Error("AMQP connection closed"));
    });

    connection.on("error", (error) => {
      this.logger.error(`AMQP connection error: ${error.message}`);
    });

    channel.on("close", () => {
      this.logger.warn("AMQP channel closed");
      this.channel = null;
      this.assertedExchanges.clear();
      this.rejectPendingMessages(new Error("AMQP channel closed"));
    });

    channel.on("error", (error) => {
      this.logger.error(`AMQP channel error: ${error.message}`);
    });

    channel.on("return", (message) => {
      this.rejectReturnedMessage(message);
    });

    this.connection = connection;
    this.channel = channel;

    return channel;
  }

  private async assertExchange(
    channel: ConfirmChannel,
    exchangeName: string,
  ): Promise<void> {
    if (this.assertedExchanges.has(exchangeName)) {
      return;
    }

    await channel.assertExchange(
      exchangeName,
      this.outboxConfigService.values.exchangeType,
      { durable: true },
    );

    this.assertedExchanges.add(exchangeName);
  }

  private rejectReturnedMessage(message: Message): void {
    const messageId = message.properties.messageId;

    if (!messageId) {
      this.logger.warn("RabbitMQ returned an unroutable message without messageId");
      return;
    }

    const pendingMessage = this.pendingMessages.get(messageId);

    if (!pendingMessage) {
      return;
    }

    this.pendingMessages.delete(messageId);
    pendingMessage.reject(
      new UnroutableBrokerMessageError(
        messageId,
        pendingMessage.exchangeName,
        pendingMessage.routingKey,
      ),
    );
  }

  private rejectPendingMessages(error: Error): void {
    for (const [messageId, pendingMessage] of this.pendingMessages.entries()) {
      pendingMessage.reject(error);
      this.pendingMessages.delete(messageId);
    }
  }
}

type PendingMessage = {
  exchangeName: string;
  routingKey: string;
  resolve: () => void;
  reject: (error: Error) => void;
};
