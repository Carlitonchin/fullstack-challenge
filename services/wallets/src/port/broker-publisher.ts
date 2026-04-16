export const BROKER_PUBLISHER = Symbol("BROKER_PUBLISHER");

export class UnroutableBrokerMessageError extends Error {
  constructor(
    readonly messageId: string,
    readonly exchangeName: string,
    readonly routingKey: string,
  ) {
    super(`Message ${messageId} was returned by RabbitMQ as unroutable`);
    this.name = "UnroutableBrokerMessageError";
  }
}

export type PublishBrokerMessageCommand = {
  exchangeName: string;
  routingKey: string;
  messageId: string;
  eventType: string;
  payload: Record<string, unknown>;
  headers: Record<string, string>;
  correlationId?: string | null;
  causationId?: string | null;
};

export interface IBrokerPublisher {
  publish(command: PublishBrokerMessageCommand): Promise<void>;
  close(): Promise<void>;
}
