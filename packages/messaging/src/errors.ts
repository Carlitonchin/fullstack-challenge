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
