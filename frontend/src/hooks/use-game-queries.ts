import { useQuery } from "@tanstack/react-query"
import {
  fetchCurrentRound,
  fetchCurrentBets,
  fetchRoundHistory,
  fetchWallet,
  fetchPlayer,
  fetchMyBets,
} from "@/lib/api"

export function useCurrentRound() {
  return useQuery({
    queryKey: ["round", "current"],
    queryFn: fetchCurrentRound,
    refetchInterval: 1000,
  })
}

export function useCurrentBets() {
  return useQuery({
    queryKey: ["bets", "current"],
    queryFn: fetchCurrentBets,
    refetchInterval: 1000,
  })
}

export function useRoundHistory() {
  return useQuery({
    queryKey: ["rounds", "history"],
    queryFn: fetchRoundHistory,
    refetchInterval: 5000,
  })
}

export function useWallet() {
  return useQuery({
    queryKey: ["wallet"],
    queryFn: fetchWallet,
    refetchInterval: 3000,
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
    queryKey: ["bets", "mine"],
    queryFn: fetchMyBets,
  })
}
