type RoundEventBase<TType extends string> = {
  type: TType;
  roundId: string;
  occurredAt: Date;
};

export type RoundCreatedDomainEvent = RoundEventBase<"round.created"> & {
  crashPoint: number;
  provablyFairStrategyId: string;
  nonce: string;
  serverSeedHash: string;
};

export type RoundBettingOpenedDomainEvent =
  RoundEventBase<"round.betting-opened"> & {
    bettingOpenedAt: Date;
    bettingClosesAt: Date;
    startsAt: Date;
    scheduledCrashAt: Date;
    settlesAt: Date;
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
  | RoundBettingOpenedDomainEvent
  | RoundBettingClosedDomainEvent
  | RoundStartedDomainEvent
  | RoundCrashedDomainEvent
  | RoundFailedDomainEvent
  | RoundSettledDomainEvent;
