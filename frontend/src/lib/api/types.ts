export type RoundStatus =
  | "WAITING_FOR_FIRST_BET"
  | "BETTING_OPEN"
  | "BETTING_CLOSED"
  | "IN_PROGRESS"
  | "CRASHED"
  | "SETTLED"
  | "ERROR"

export type BetStatus =
  | "PENDING"
  | "ACCEPTED"
  | "CASHED_OUT"
  | "LOST"
  | "SETTLED"
  | "REJECTED"

export interface RoundCurve {
  kind: "exponential"
  version: 1
  baseMultiplier: number
  growthRate: number
  precisionDigits: number
}

export interface Round {
  id: string
  status: RoundStatus
  bettingOpenedAt: string | null
  bettingClosesAt: string | null
  startsAt: string | null
  startedAt: string | null
  scheduledCrashAt: string | null
  settlesAt: string | null
  crashedAt: string | null
  currentMultiplier: number
  curve: RoundCurve
  crashPoint: number | null
  serverSeedHash: string
  serverSeed: string | null
  isServerSeedRevealed: boolean
  playerCount: number
}

export interface Bet {
  id: string
  roundId: string
  playerId: string
  playerUsername: string
  amountInCents: number
  currency: "BRL"
  status: BetStatus
  acceptedAt: string | null
  rejectedAt: string | null
  rejectionReason: string | null
  cashoutMultiplier: number | null
  roundCrashMultiplier: number | null
  payoutAmountInCents: number | null
  createdAt: string
  settledAt: string | null
}

export interface CurrentGameSnapshot {
  serverTime: string
  round: Round | null
  bets: Bet[]
}

export interface RoundHistoryEntry {
  id: string
  crashPoint: number
  crashedAt: string
  serverSeedHash: string
  playerCount: number
}

export interface Wallet {
  id: string
  playerId: string
  balanceCents: number
}

export interface Player {
  id: string
  username: string
}

export interface CashOutResponse {
  multiplier: number
  payoutAmountInCents: number
}
