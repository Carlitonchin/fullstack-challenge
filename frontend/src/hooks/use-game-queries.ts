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
  })
}

export function useCurrentBets() {
  return useQuery({
    queryKey: ["bets", "current"],
    queryFn: fetchCurrentBets,
  })
}

export function useRoundHistory() {
  return useQuery({
    queryKey: ["rounds", "history"],
    queryFn: fetchRoundHistory,
  })
}

export function useWallet() {
  return useQuery({
    queryKey: ["wallet"],
    queryFn: fetchWallet,
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
