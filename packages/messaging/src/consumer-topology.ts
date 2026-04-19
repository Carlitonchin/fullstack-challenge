import type { Channel } from "amqplib";

export const CONSUMER_DEAD_LETTER_EXCHANGE = "consumer.dead-letter";

export function buildDeadLetterQueueName(queueName: string): string {
  return `${queueName}.dlq`;
}

export async function assertConsumerQueueTopology(
  channel: Channel,
  queueName: string,
): Promise<string> {
  await channel.assertExchange(CONSUMER_DEAD_LETTER_EXCHANGE, "topic", {
    durable: true,
  });

  const deadLetterQueueName = buildDeadLetterQueueName(queueName);

  await channel.assertQueue(deadLetterQueueName, { durable: true });
  await channel.bindQueue(
    deadLetterQueueName,
    CONSUMER_DEAD_LETTER_EXCHANGE,
    queueName,
  );

  const { queue } = await channel.assertQueue(queueName, {
    durable: true,
    deadLetterExchange: CONSUMER_DEAD_LETTER_EXCHANGE,
    deadLetterRoutingKey: queueName,
  });

  return queue;
}
