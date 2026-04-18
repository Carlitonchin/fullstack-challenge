import { useMemo, useState, type FormEvent } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Separator } from "@/components/ui/separator"
import { placeBet, cashOut, createWallet } from "@/lib/api"
import type { Bet, Round, Wallet } from "@/lib/api"
import { formatCents, formatMultiplier, parseDollarsToCents } from "@/lib/format"
import { useSyncedNow } from "@/hooks/use-synced-now"
import { resolveDisplayedRoundMultiplier } from "@/lib/round-curve"
import { toast } from "sonner"

interface BetControlsProps {
  round: Round | undefined
  serverTime: string | undefined
  myBets: Bet[] | undefined
  wallet: Wallet | null | undefined
  isLoadingRound: boolean
  isLoadingWallet: boolean
  isLoadingMyBets: boolean
}

const QUICK_AMOUNTS = [100, 500, 1000, 2500]

export function BetControls({
  round,
  serverTime,
  myBets,
  wallet,
  isLoadingRound,
  isLoadingWallet,
  isLoadingMyBets,
}: BetControlsProps) {
  const queryClient = useQueryClient()
  const displayNow = useSyncedNow(serverTime, round?.id)
  const [amount, setAmount] = useState("")
  const [error, setError] = useState<string | null>(null)

  const currentRoundBet = useMemo(
    () =>
      myBets?.find(
        (bet) => bet.roundId === round?.id && bet.status !== "REJECTED",
      ),
    [myBets, round?.id],
  )

  const latestRejectedRoundBet = useMemo(
    () =>
      myBets?.find(
        (bet) => bet.roundId === round?.id && bet.status === "REJECTED",
      ),
    [myBets, round?.id],
  )

  const betMutation = useMutation({
    mutationFn: (amountInCents: number) => placeBet(amountInCents),
    onSuccess: () => {
      setAmount("")
      setError(null)
      toast.success("Bet submitted and waiting for wallet confirmation")
      queryClient.invalidateQueries({ queryKey: ["bets", "mine"] })
      queryClient.invalidateQueries({ queryKey: ["game", "snapshot"] })
      queryClient.invalidateQueries({ queryKey: ["wallet"] })
    },
    onError: (err: Error) => {
      setError(err.message)
      toast.error(err.message)
    },
  })

  const cashOutMutation = useMutation({
    mutationFn: () => cashOut(),
    onSuccess: (data) => {
      toast.success(
        `Cashout locked at ${formatMultiplier(data.multiplier)} for ${formatCents(data.payoutAmountInCents)}`,
      )
      queryClient.invalidateQueries({ queryKey: ["bets", "mine"] })
      queryClient.invalidateQueries({ queryKey: ["game", "snapshot"] })
      queryClient.invalidateQueries({ queryKey: ["wallet"] })
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  const createWalletMutation = useMutation({
    mutationFn: () => createWallet(),
    onSuccess: () => {
      toast.success("Wallet created")
      queryClient.invalidateQueries({ queryKey: ["wallet"] })
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    const cents = parseDollarsToCents(amount)

    if (cents === null) {
      setError("Enter a valid amount")
      return
    }

    if (cents < 100) {
      setError("Minimum bet is R$ 1,00")
      return
    }

    if (cents > 100_000) {
      setError("Maximum bet is R$ 1.000,00")
      return
    }

    betMutation.mutate(cents)
  }

  function handleQuickAmount(cents: number) {
    setAmount((cents / 100).toFixed(2))
    setError(null)
  }

  function handleHalfBalance() {
    if (!wallet) return
    const half = Math.floor(wallet.balanceCents / 2)
    setAmount((half / 100).toFixed(2))
    setError(null)
  }

  function handleMaxBalance() {
    if (!wallet) return
    const max = Math.min(wallet.balanceCents, 100_000)
    setAmount((max / 100).toFixed(2))
    setError(null)
  }

  const hasWallet = wallet !== null && wallet !== undefined
  const hasRound = Boolean(round)
  const isRoundAcceptingBets =
    round?.status === "WAITING_FOR_FIRST_BET" || round?.status === "BETTING_OPEN"
  const canBet =
    isRoundAcceptingBets &&
    !currentRoundBet &&
    !isLoadingRound &&
    !isLoadingWallet &&
    !isLoadingMyBets &&
    hasWallet

  const canCashOut =
    round?.status === "IN_PROGRESS" && currentRoundBet?.status === "ACCEPTED"

  const currentMultiplier = resolveDisplayedRoundMultiplier(round, displayNow)
  const lockedBetAmount = currentRoundBet?.amountInCents ?? 0
  const potentialPayout = canCashOut
    ? Math.round(lockedBetAmount * currentMultiplier)
    : null

  if (!isLoadingWallet && !hasWallet) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Place Bet</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 p-4">
            <p className="text-sm font-medium text-foreground">You don&apos;t have a wallet yet.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              A wallet is required to join the round and place bets.
            </p>
          </div>

          <Button
            className="w-full text-sm font-semibold"
            size="lg"
            onClick={() => createWalletMutation.mutate()}
            disabled={createWalletMutation.isPending}
          >
            {createWalletMutation.isPending ? "Creating wallet…" : "Create Wallet"}
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Place Bet</CardTitle>
      </CardHeader>
      <CardContent>
        <form id="bet-form" onSubmit={handleSubmit} noValidate>
          <FieldGroup>
            <Field data-invalid={!!error || undefined}>
              <FieldLabel htmlFor="bet-amount" className="text-xs text-muted-foreground">
                Amount (BRL)
              </FieldLabel>
              <Input
                id="bet-amount"
                name="amount"
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(event) => {
                  setAmount(event.target.value)
                  setError(null)
                }}
                disabled={!canBet}
                aria-invalid={!!error || undefined}
              />
              {error && <FieldError>{error}</FieldError>}
            </Field>
          </FieldGroup>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {QUICK_AMOUNTS.map((cents) => (
              <Button
                key={cents}
                type="button"
                variant="outline"
                size="sm"
                className="flex-1 text-xs tabular-nums"
                disabled={!canBet}
                onClick={() => handleQuickAmount(cents)}
              >
                {formatCents(cents)}
              </Button>
            ))}
          </div>

          <div className="mt-2 flex gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1 text-xs"
              disabled={!canBet}
              onClick={handleHalfBalance}
            >
              ½
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1 text-xs"
              disabled={!canBet}
              onClick={handleMaxBalance}
            >
              Max
            </Button>
          </div>
        </form>

        <Separator className="my-4" />

        {canCashOut ? (
          <Button
            className="w-full text-sm font-semibold"
            size="lg"
            disabled={cashOutMutation.isPending}
            onClick={() => cashOutMutation.mutate()}
          >
            {cashOutMutation.isPending
              ? "Locking cashout…"
              : `Cash Out ${potentialPayout ? formatCents(potentialPayout) : ""}`}
          </Button>
        ) : (
          <Button
            type="submit"
            form="bet-form"
            className="w-full text-sm font-semibold"
            size="lg"
            disabled={!canBet || betMutation.isPending}
          >
            {betMutation.isPending
              ? "Placing…"
              : currentRoundBet
                ? getRoundBetButtonLabel(currentRoundBet.status)
                : !hasRound
                  ? "Waiting for round"
                  : !isRoundAcceptingBets
                    ? "Wait for next round"
                    : round?.status === "WAITING_FOR_FIRST_BET"
                      ? "Place First Bet"
                    : "Place Bet"}
          </Button>
        )}

        {!currentRoundBet && latestRejectedRoundBet?.rejectionReason && (
          <p className="mt-3 text-xs text-destructive">
            {latestRejectedRoundBet.rejectionReason}
          </p>
        )}

        {wallet && (
          <div className="mt-3 text-center">
            <span className="text-[11px] text-muted-foreground">Balance: </span>
            <span className="text-[11px] font-semibold text-foreground tabular-nums">
              {formatCents(wallet.balanceCents)}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function getRoundBetButtonLabel(status: Bet["status"]): string {
  switch (status) {
    case "PENDING":
      return "Bet pending"
    case "ACCEPTED":
      return "Bet active"
    case "CASHED_OUT":
      return "Cashout requested"
    case "SETTLED":
      return "Bet settled"
    case "LOST":
      return "Round lost"
    case "REJECTED":
      return "Bet rejected"
    default:
      return "Bet submitted"
  }
}
