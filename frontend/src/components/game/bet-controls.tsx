import { useState, type FormEvent } from "react"
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
import type { Round, Wallet } from "@/lib/api"
import { formatCents, formatMultiplier, parseDollarsToCents } from "@/lib/format"
import { toast } from "sonner"

interface BetControlsProps {
  round: Round | undefined
  wallet: Wallet | null | undefined
  isLoadingRound: boolean
  isLoadingWallet: boolean
}

const QUICK_AMOUNTS = [100, 500, 1000, 2500] // cents

export function BetControls({
  round,
  wallet,
  isLoadingRound,
  isLoadingWallet,
}: BetControlsProps) {
  const queryClient = useQueryClient()
  const [amount, setAmount] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [hasBet, setHasBet] = useState(false)

  const betMutation = useMutation({
    mutationFn: (amountCents: number) => placeBet(amountCents),
    onSuccess: () => {
      setHasBet(true)
      setAmount("")
      setError(null)
      toast.success("Bet placed!")
      queryClient.invalidateQueries({ queryKey: ["wallet"] })
      queryClient.invalidateQueries({ queryKey: ["bets"] })
    },
    onError: (err: Error) => {
      setError(err.message)
      toast.error(err.message)
    },
  })

  const cashOutMutation = useMutation({
    mutationFn: () => cashOut(),
    onSuccess: (data) => {
      setHasBet(false)
      toast.success(`Cashed out at ${formatMultiplier(data.multiplier)} — ${formatCents(data.payoutCents)}`)
      queryClient.invalidateQueries({ queryKey: ["wallet"] })
      queryClient.invalidateQueries({ queryKey: ["bets"] })
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

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    const cents = parseDollarsToCents(amount)
    if (cents === null) {
      setError("Enter a valid amount")
      return
    }
    if (cents < 100) {
      setError("Minimum bet is $1.00")
      return
    }
    if (cents > 100_000) {
      setError("Maximum bet is $1,000.00")
      return
    }
    if (wallet && cents > wallet.balanceCents) {
      setError("Insufficient balance")
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

  const isBetting = round?.status === "BETTING"
  const isRunning = round?.status === "RUNNING"
  const hasWallet = wallet !== null && wallet !== undefined
  const canBet = isBetting && !hasBet && !isLoadingRound && !isLoadingWallet && !!wallet
  const canCashOut = isRunning && hasBet

  // Calculate potential payout when running
  const currentCents = parseDollarsToCents(amount)
  const potentialPayout = canCashOut && currentCents ? currentCents * (round?.multiplier ?? 1) : null

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
              A wallet is required to participate in the game and place bets.
            </p>
          </div>

          <Button
            className="w-full text-sm font-semibold"
            size="lg"
            onClick={() => createWalletMutation.mutate()}
            disabled={createWalletMutation.isPending}
          >
            {createWalletMutation.isPending ? (
              <span className="animate-pulse">Creating wallet…</span>
            ) : (
              "Create Wallet"
            )}
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
                Amount (USD)
              </FieldLabel>
              <Input
                id="bet-amount"
                name="amount"
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value)
                  setError(null)
                }}
                disabled={!canBet}
                aria-invalid={!!error || undefined}
              />
              {error && <FieldError>{error}</FieldError>}
            </Field>
          </FieldGroup>

          {/* Quick amount buttons */}
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

        {/* Bet / Cash Out action */}
        {canCashOut ? (
          <Button
            className="w-full text-sm font-semibold"
            size="lg"
            variant="default"
            disabled={cashOutMutation.isPending}
            onClick={() => cashOutMutation.mutate()}
          >
            {cashOutMutation.isPending ? (
              <span className="animate-pulse">Cashing out…</span>
            ) : (
              <>
                Cash Out
                {potentialPayout !== null && (
                  <span className="ml-1.5 opacity-80">
                    {formatCents(Math.round(potentialPayout))}
                  </span>
                )}
              </>
            )}
          </Button>
        ) : (
          <Button
            type="submit"
            form="bet-form"
            className="w-full text-sm font-semibold"
            size="lg"
            disabled={!canBet || betMutation.isPending}
          >
            {betMutation.isPending ? (
              <span className="animate-pulse">Placing…</span>
            ) : hasBet ? (
              "Bet Placed ✓"
            ) : !isBetting ? (
              "Wait for next round"
            ) : (
              "Place Bet"
            )}
          </Button>
        )}

        {/* Balance display */}
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
