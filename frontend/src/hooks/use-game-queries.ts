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
import type { Bet, CurrentGameSnapshot, RoundHistoryEntry } from "@/lib/api"

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
    const socket = io(getApiBaseUrl(), {
      path: "/games/socket.io",
      transports: ["websocket"],
      withCredentials: true,
    })

    socket.on("game.snapshot", (snapshot: CurrentGameSnapshot) => {
      queryClient.setQueryData(SNAPSHOT_QUERY_KEY, snapshot)
    })

    socket.on("history.updated", (history: RoundHistoryEntry[]) => {
      queryClient.setQueryData(HISTORY_QUERY_KEY, history)
    })

    socket.on("bet.updated", (bet: Bet) => {
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
    })

    return () => {
      socket.close()
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
