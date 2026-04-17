import {
  ensureValidAccessToken,
  getAuthenticatedPlayer,
  redirectToLogin,
  refreshAuthSession,
} from "@/lib/auth"
import type {
  Bet,
  CashOutResponse,
  CurrentGameSnapshot,
  Player,
  RoundHistoryEntry,
  Wallet,
} from "./types"

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000"

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

type WalletResponse = {
  id: string
  playerId: string
  balanceInCents: string
}

export function getApiBaseUrl(): string {
  return API_BASE_URL
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

function mapWallet(response: WalletResponse): Wallet {
  return {
    id: response.id,
    playerId: response.playerId,
    balanceCents: Number(response.balanceInCents),
  }
}

export async function fetchCurrentSnapshot(): Promise<CurrentGameSnapshot> {
  return sendRequest<CurrentGameSnapshot>("/games/rounds/current")
}

export async function fetchRoundHistory(): Promise<RoundHistoryEntry[]> {
  return sendRequest<RoundHistoryEntry[]>("/games/rounds/history")
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
  return sendRequest<Bet[]>("/games/bets/me", {
    auth: true,
  })
}

export async function placeBet(amountInCents: number): Promise<Bet> {
  return sendRequest<Bet>("/games/bets", {
    method: "POST",
    auth: true,
    body: {
      amount: (amountInCents / 100).toFixed(2),
    },
  })
}

export async function cashOut(): Promise<CashOutResponse> {
  return sendRequest<CashOutResponse>("/games/bets/cashout", {
    method: "POST",
    auth: true,
  })
}
