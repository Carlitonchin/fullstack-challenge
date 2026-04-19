export class PoisonMessageError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = PoisonMessageError.name;
  }
}

export class RetriableConsumerError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = RetriableConsumerError.name;
  }
}

export function isPoisonMessageError(error: unknown): error is PoisonMessageError {
  return error instanceof PoisonMessageError;
}

export function isRetriableConsumerError(
  error: unknown,
): error is RetriableConsumerError {
  return error instanceof RetriableConsumerError;
}
