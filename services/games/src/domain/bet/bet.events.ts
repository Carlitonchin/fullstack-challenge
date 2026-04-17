import { BetCurrency } from "./bet-amount";

type BetEventBase<TType extends string> = {
  type: TType;
  betId: string;
  roundId: string;
  playerId: string;
  playerUsername: string;
  occurredAt: Date;
};

export type BetCreatedDomainEvent = BetEventBase<"bet.created"> & {
  amountInCents: number;
  currency: "BRL";
};

export type BetAcceptedDomainEvent = BetEventBase<"bet.accepted">;

export type BetRejectedDomainEvent = BetEventBase<"bet.rejected"> & {
  rejectionReason: string;
};

export type BetCashedOutDomainEvent = BetEventBase<"bet.cashed-out"> & {
  cashoutMultiplier: number;
  payoutAmountInCents: number;
  currency: BetCurrency;
};

export type BetLostDomainEvent = BetEventBase<"bet.lost">;

export type BetSettledDomainEvent = BetEventBase<"bet.settled">;

export type BetDomainEvent =
  | BetCreatedDomainEvent
  | BetAcceptedDomainEvent
  | BetRejectedDomainEvent
  | BetCashedOutDomainEvent
  | BetLostDomainEvent
  | BetSettledDomainEvent;
