// All money amounts are in integer cents (e.g. 1000 = $10.00)
// This aligns with the project rule: never use floating-point for money.

export type RoundStatus =
  | "BETTING"
  | "RUNNING"
  | "CRASHED"
  | "WAITING"

export type BetStatus =
  | "PENDING"
  | "ACTIVE"
  | "CASHED_OUT"
  | "LOST"

export interface Round {
  id: string
  status: RoundStatus
  crashPoint: number | null // multiplier e.g. 2.35
  multiplier: number // current multiplier during RUNNING
  hashSeed: string // pre-round public hash
  bettingEndsAt: string | null // ISO timestamp
  startedAt: string | null
  crashedAt: string | null
}

export interface Bet {
  id: string
  roundId: string
  playerId: string
  playerName: string
  amountCents: number
  status: BetStatus
  cashoutMultiplier: number | null
  payoutCents: number | null
  createdAt: string
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

export interface RoundHistoryEntry {
  id: string
  crashPoint: number
  hashSeed: string
  createdAt: string
  playerCount: number
}
