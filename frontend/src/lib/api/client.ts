import type {
  Round,
  Bet,
  Wallet,
  Player,
  RoundHistoryEntry,
} from "./types"
import {
  MOCK_CURRENT_ROUND,
  MOCK_CURRENT_BETS,
  MOCK_ROUND_HISTORY,
  MOCK_WALLET,
  MOCK_PLAYER,
  MOCK_MY_BETS,
} from "./mock-data"

/**
 * Simulates network latency with a randomized delay.
 */
function simulateLatency(minMs = 200, maxMs = 600): Promise<void> {
  const delay = Math.floor(Math.random() * (maxMs - minMs)) + minMs
  return new Promise((resolve) => setTimeout(resolve, delay))
}

export async function fetchCurrentRound(): Promise<Round> {
  await simulateLatency()
  return { ...MOCK_CURRENT_ROUND }
}

export async function fetchCurrentBets(): Promise<Bet[]> {
  await simulateLatency()
  return [...MOCK_CURRENT_BETS]
}

export async function fetchRoundHistory(): Promise<RoundHistoryEntry[]> {
  await simulateLatency()
  return [...MOCK_ROUND_HISTORY]
}

export async function fetchWallet(): Promise<Wallet> {
  await simulateLatency()
  return { ...MOCK_WALLET }
}

export async function fetchPlayer(): Promise<Player> {
  await simulateLatency(100, 300)
  return { ...MOCK_PLAYER }
}

export async function fetchMyBets(): Promise<Bet[]> {
  await simulateLatency()
  return [...MOCK_MY_BETS]
}

export async function placeBet(amountCents: number): Promise<Bet> {
  await simulateLatency(300, 800)

  if (amountCents < 100) {
    throw new Error("Minimum bet is $1.00")
  }
  if (amountCents > 100_000) {
    throw new Error("Maximum bet is $1,000.00")
  }
  if (amountCents > MOCK_WALLET.balanceCents) {
    throw new Error("Insufficient balance")
  }

  return {
    id: `bet_${Date.now()}`,
    roundId: MOCK_CURRENT_ROUND.id,
    playerId: MOCK_PLAYER.id,
    playerName: MOCK_PLAYER.username,
    amountCents,
    status: "ACTIVE",
    cashoutMultiplier: null,
    payoutCents: null,
    createdAt: new Date().toISOString(),
  }
}

export async function cashOut(): Promise<{ multiplier: number; payoutCents: number }> {
  await simulateLatency(200, 500)
  const multiplier = 2.35
  const payoutCents = 117_50
  return { multiplier, payoutCents }
}
