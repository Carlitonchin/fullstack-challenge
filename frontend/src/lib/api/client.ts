import {
  ensureValidAccessToken,
  getAuthenticatedPlayer,
  redirectToLogin,
  refreshAuthSession,
} from "@/lib/auth"
import type { Round, Bet, Wallet, Player, RoundHistoryEntry } from "./types"
import {
  MOCK_CURRENT_ROUND,
  MOCK_CURRENT_BETS,
  MOCK_ROUND_HISTORY,
  MOCK_WALLET,
  MOCK_PLAYER,
  MOCK_MY_BETS,
} from "./mock-data"

const DEFAULT_API_BASE_URL = import.meta.env.DEV ? "" : "http://localhost:8000"
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE_URL

class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

type RequestOptions = {
  method?: "GET" | "POST"
  auth?: boolean
  body?: unknown
}

async function parseError(response: Response): Promise<ApiError> {
  try {
    const payload = (await response.json()) as {
      message?: string | string[]
      error?: string
    }

    const message = Array.isArray(payload.message)
      ? payload.message.join(", ")
      : payload.message || payload.error || "Request failed"

    return new ApiError(message, response.status)
  } catch {
    return new ApiError(response.statusText || "Request failed", response.status)
  }
}

async function parseJson<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

async function sendRequest<T>(
  path: string,
  { method = "GET", auth = false, body }: RequestOptions = {},
  retried = false,
): Promise<T> {
  const headers = new Headers()

  if (body !== undefined) {
    headers.set("Content-Type", "application/json")
  }

  if (auth) {
    const accessToken = await getAccessTokenOrRedirect()
    headers.set("Authorization", `Bearer ${accessToken}`)
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (auth && response.status === 401 && !retried) {
    try {
      await refreshAuthSession()
      return sendRequest<T>(path, { method, auth, body }, true)
    } catch {
      redirectToLogin()
      throw new Error("Authentication required")
    }
  }

  if (!response.ok) {
    throw await parseError(response)
  }

  return parseJson<T>(response)
}

async function getAccessTokenOrRedirect(): Promise<string> {
  try {
    return await ensureValidAccessToken()
  } catch {
    redirectToLogin()
    throw new Error("Authentication required")
  }
}

type WalletResponse = {
  id: string
  playerId: string
  balanceInCents: string
}

function mapWallet(response: WalletResponse): Wallet {
  return {
    id: response.id,
    playerId: response.playerId,
    balanceCents: Number(response.balanceInCents),
  }
}

export async function fetchCurrentRound(): Promise<Round> {
  return { ...MOCK_CURRENT_ROUND }
}

export async function fetchCurrentBets(): Promise<Bet[]> {
  return [...MOCK_CURRENT_BETS]
}

export async function fetchRoundHistory(): Promise<RoundHistoryEntry[]> {
  return [...MOCK_ROUND_HISTORY]
}

export async function fetchWallet(): Promise<Wallet | null> {
  try {
    const wallet = await sendRequest<WalletResponse>("/wallets/me", {
      auth: true,
    })

    return mapWallet(wallet)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null
    }

    throw error
  }
}

export async function createWallet(): Promise<Wallet> {
  const wallet = await sendRequest<WalletResponse>("/wallets", {
    method: "POST",
    auth: true,
  })

  return mapWallet(wallet)
}

export async function fetchPlayer(): Promise<Player> {
  const player = getAuthenticatedPlayer()

  if (!player) {
    throw new Error("Missing authenticated player")
  }

  return {
    id: player.id,
    username: player.username,
  }
}

export async function fetchMyBets(): Promise<Bet[]> {
  return [...MOCK_MY_BETS]
}

export async function placeBet(amountCents: number): Promise<Bet> {
  await getAccessTokenOrRedirect()
  const player = getAuthenticatedPlayer() ?? MOCK_PLAYER

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
    playerId: player.id,
    playerName: player.username,
    amountCents,
    status: "ACTIVE",
    cashoutMultiplier: null,
    payoutCents: null,
    createdAt: new Date().toISOString(),
  }
}

export async function cashOut(): Promise<{ multiplier: number; payoutCents: number }> {
  await getAccessTokenOrRedirect()
  const multiplier = 2.35
  const payoutCents = 117_50
  return { multiplier, payoutCents }
}
