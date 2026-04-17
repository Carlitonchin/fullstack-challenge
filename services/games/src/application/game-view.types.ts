import type { BetStatus } from "@games/domain/bet/bet";
import type { RoundStatus } from "@games/domain/round/round";

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
  payoutAmountInCents: number | null;
  createdAt: string;
  settledAt: string | null;
};

export type GameRoundView = {
  id: string;
  status: RoundStatus;
  bettingOpenedAt: string;
  bettingClosesAt: string;
  startsAt: string;
  startedAt: string | null;
  scheduledCrashAt: string;
  settlesAt: string;
  crashedAt: string | null;
  currentMultiplier: number;
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
