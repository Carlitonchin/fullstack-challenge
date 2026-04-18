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

export interface FairnessCommitment {
  serverSeedHash: string
  isSeedRevealed: boolean
}

export interface FairnessStrategy {
  strategyId: string
  strategyDisplayName: string
  algorithm: string
  hashAlgorithm: string
  outcomeAlgorithm: string
  houseEdgeDescription: string
  verificationFormula: string
  verificationSteps: { order: number; instruction: string }[]
}

export interface FairnessTimeline {
  publishedAt: string
  bettingOpenedAt: string | null
  bettingClosesAt: string | null
  startsAt: string | null
  serverTime: string
}

export interface PreviousRoundProof {
  roundId: string
  serverSeedHash: string
  serverSeed: string
  nonce: string
  crashPoint: number
  verified: boolean
}

export interface RoundFairness {
  nonce: string
  commitment: FairnessCommitment
  strategy: FairnessStrategy
  timeline: FairnessTimeline
  curve: RoundCurve
  previousRoundProof: PreviousRoundProof | null
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
  fairness: RoundFairness
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

export interface WalletBalanceUpdated {
  walletId: string
  playerId: string
  currency: "BRL"
  balanceInCents: string
  amountInCents: string
  direction: "credit" | "debit"
  operationId: string | null
  occurredAt: string
}

export interface Player {
  id: string
  username: string
}

export interface CashOutResponse {
  multiplier: number
  payoutAmountInCents: number
}

export interface RoundVerification {
  roundId: string
  publishedAt: string
  strategyId: string
  strategyDisplayName: string
  strategyDescription: string
  algorithm: string
  hashAlgorithm: string
  outcomeAlgorithm: string
  nonce: string
  serverSeedHash: string
  serverSeed: string | null
  isServerSeedRevealed: boolean
  crashPoint: number | null
  crashMultiplier: number | null
  houseEdgeDescription: string
  verificationFormula: string
  verificationSteps: { order: number; instruction: string }[]
}
