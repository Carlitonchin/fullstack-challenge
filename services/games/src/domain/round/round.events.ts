type RoundEventBase<TType extends string> = {
  type: TType;
  roundId: string;
  occurredAt: Date;
};

export type RoundCreatedDomainEvent = RoundEventBase<"round.created"> & {
  crashPoint: number;
  bettingClosesAt: Date;
  provablyFairStrategyId: string;
  nonce: string;
  serverSeedHash: string;
};

export type RoundBettingClosedDomainEvent =
  RoundEventBase<"round.betting-closed">;

export type RoundStartedDomainEvent = RoundEventBase<"round.started">;

export type RoundCrashedDomainEvent = RoundEventBase<"round.crashed"> & {
  crashMultiplier: number;
};

export type RoundFailedDomainEvent = RoundEventBase<"round.failed"> & {
  errorReason: string;
  refundRequired: boolean;
};

export type RoundSettledDomainEvent = RoundEventBase<"round.settled">;

export type RoundDomainEvent =
  | RoundCreatedDomainEvent
  | RoundBettingClosedDomainEvent
  | RoundStartedDomainEvent
  | RoundCrashedDomainEvent
  | RoundFailedDomainEvent
  | RoundSettledDomainEvent;
