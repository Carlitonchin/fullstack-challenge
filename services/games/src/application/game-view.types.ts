import type { BetStatus } from "@games/domain/bet/bet";
import type { RoundStatus } from "@games/domain/round/round";
import type { PublicRoundCurve } from "@games/domain/round/round-timing.strategy";

export type GameRoundCurveView = PublicRoundCurve;

export type GameBetView = {
  id: string;
  roundId: string;
  playerId: string;
  playerUsername: string;
  amountInCents: number;
  currency: "BRL";
  status: BetStatus;
  acceptedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  cashoutMultiplier: number | null;
  roundCrashMultiplier: number | null;
  payoutAmountInCents: number | null;
  createdAt: string;
  settledAt: string | null;
};

export type GameRoundView = {
  id: string;
  status: RoundStatus;
  bettingOpenedAt: string | null;
  bettingClosesAt: string | null;
  startsAt: string | null;
  startedAt: string | null;
  scheduledCrashAt: string | null;
  settlesAt: string | null;
  crashedAt: string | null;
  currentMultiplier: number;
  curve: GameRoundCurveView;
  crashPoint: number | null;
  serverSeedHash: string;
  serverSeed: string | null;
  isServerSeedRevealed: boolean;
  playerCount: number;
};

export type CurrentGameSnapshotView = {
  serverTime: string;
  round: GameRoundView | null;
  bets: GameBetView[];
};

export type GameRoundHistoryEntryView = {
  id: string;
  crashPoint: number;
  crashedAt: string;
  serverSeedHash: string;
  playerCount: number;
};

export type GameCashOutResponseView = {
  multiplier: number;
  payoutAmountInCents: number;
};

export type WalletBalanceUpdatedView = {
  walletId: string;
  playerId: string;
  currency: "BRL";
  balanceInCents: string;
  amountInCents: string;
  direction: "credit" | "debit";
  operationId: string | null;
  occurredAt: string;
};
