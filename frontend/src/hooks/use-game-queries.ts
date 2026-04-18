import { useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { io } from "socket.io-client"
import {
  fetchCurrentSnapshot,
  fetchRoundHistory,
  fetchWallet,
  fetchPlayer,
  fetchMyBets,
  getApiBaseUrl,
} from "@/lib/api"
import type {
  Bet,
  CurrentGameSnapshot,
  RoundHistoryEntry,
  Wallet,
  WalletBalanceUpdated,
} from "@/lib/api"
import { ensureValidAccessToken, redirectToLogin } from "@/lib/auth"

const SNAPSHOT_QUERY_KEY = ["game", "snapshot"] as const
const HISTORY_QUERY_KEY = ["game", "history"] as const
const MY_BETS_QUERY_KEY = ["bets", "mine"] as const
const WALLET_QUERY_KEY = ["wallet"] as const

export function useCurrentGameSnapshot() {
  return useQuery({
    queryKey: SNAPSHOT_QUERY_KEY,
    queryFn: fetchCurrentSnapshot
  })
}

export function useRoundHistory() {
  return useQuery({
    queryKey: HISTORY_QUERY_KEY,
    queryFn: fetchRoundHistory,
  })
}

export function useWallet() {
  return useQuery({
    queryKey: WALLET_QUERY_KEY,
    queryFn: fetchWallet
  })
}

export function usePlayer() {
  return useQuery({
    queryKey: ["player"],
    queryFn: fetchPlayer,
    staleTime: Infinity,
  })
}

export function useMyBets() {
  return useQuery({
    queryKey: MY_BETS_QUERY_KEY,
    queryFn: fetchMyBets
  })
}

export function useGameRealtime(playerId?: string) {
  const queryClient = useQueryClient()

  useEffect(() => {
    let socket: ReturnType<typeof io> | null = null
    let cancelled = false
    let reconnectingWithFreshToken = false

    function reconcilePrivateState() {
      void queryClient.invalidateQueries({ queryKey: WALLET_QUERY_KEY })
      void queryClient.invalidateQueries({ queryKey: MY_BETS_QUERY_KEY })
    }

    function applyBetUpdated(bet: Bet) {
      queryClient.setQueryData<CurrentGameSnapshot | undefined>(
        SNAPSHOT_QUERY_KEY,
        (current) => {
          if (!current || current.round?.id !== bet.roundId) {
            return current
          }

          const currentBets = current.bets.filter((item) => item.id !== bet.id)
          const nextBets = isPublicBetStatus(bet.status)
            ? [...currentBets, bet].sort((left, right) => {
                if (right.amountInCents !== left.amountInCents) {
                  return right.amountInCents - left.amountInCents
                }

                return left.createdAt.localeCompare(right.createdAt)
              })
            : currentBets

          return {
            ...current,
            bets: nextBets,
          }
        },
      )

      if (playerId && bet.playerId === playerId) {
        queryClient.setQueryData<Bet[] | undefined>(MY_BETS_QUERY_KEY, (current) => {
          const nextBets = (current ?? []).filter((item) => item.id !== bet.id)
          return [bet, ...nextBets].sort((left, right) =>
            right.createdAt.localeCompare(left.createdAt),
          )
        })
      }
    }

    async function updateSocketAuthToken(): Promise<boolean> {
      const token = await ensureValidAccessToken()

      if (cancelled || !socket) {
        return false
      }

      socket.auth = { token }
      return true
    }

    async function reconnectWithFreshToken() {
      if (reconnectingWithFreshToken) {
        return
      }

      reconnectingWithFreshToken = true

      try {
        const canReconnect = await updateSocketAuthToken()

        if (!cancelled && canReconnect) {
          socket?.connect()
        }
      } catch {
        if (!cancelled) {
          redirectToLogin()
        }
      } finally {
        reconnectingWithFreshToken = false
      }
    }

    async function connectRealtime() {
      const token = await ensureValidAccessToken()

      if (cancelled || !token) {
        return
      }

      socket = io(getApiBaseUrl(), {
        path: "/games/socket.io",
        transports: ["websocket"],
        withCredentials: true,
        auth: {
          token,
        },
      })

      socket.on("connect", reconcilePrivateState)

      socket.on("disconnect", (reason) => {
        if (reason === "io server disconnect") {
          void reconnectWithFreshToken()
        }
      })

      socket.io.on("reconnect_attempt", () => {
        void updateSocketAuthToken().catch(() => undefined)
      })

      socket.io.on("reconnect", reconcilePrivateState)

      socket.on("game.snapshot", (snapshot: CurrentGameSnapshot) => {
        queryClient.setQueryData(SNAPSHOT_QUERY_KEY, snapshot)
      })

      socket.on("history.updated", (history: RoundHistoryEntry[]) => {
        queryClient.setQueryData(HISTORY_QUERY_KEY, history)
      })

      socket.on("bet.updated", applyBetUpdated)

      socket.on("player.bet.updated", applyBetUpdated)

      socket.on("wallet.balance-updated", (event: WalletBalanceUpdated) => {
        if (playerId && event.playerId !== playerId) {
          return
        }

        queryClient.setQueryData<Wallet | null | undefined>(
          WALLET_QUERY_KEY,
          (current) => ({
            id: current?.id ?? event.walletId,
            playerId: current?.playerId ?? event.playerId,
            balanceCents: Number(event.balanceInCents),
          }),
        )
      })
    }

    void connectRealtime().catch(() => {
      if (!cancelled) {
        redirectToLogin()
      }
    })

    return () => {
      cancelled = true
      socket?.close()
    }
  }, [playerId, queryClient])
}

function isPublicBetStatus(status: Bet["status"]): boolean {
  return (
    status === "ACCEPTED" ||
    status === "CASHED_OUT" ||
    status === "LOST" ||
    status === "SETTLED"
  )
}
