import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { toast } from "sonner"
import { useSyncedNow } from "@/hooks/use-synced-now"
import type { Round } from "@/lib/api"
import { formatMultiplier, truncateHash } from "@/lib/format"
import { VerificationModal } from "./verification-modal"

interface RoundTransparencyPanelProps {
  round: Round | undefined
  serverTime: string | undefined
}

export function RoundTransparencyPanel({
  round,
  serverTime,
}: RoundTransparencyPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null)
  const displayNow = useSyncedNow(serverTime, round?.id)

  if (!round || !isPreRoundStatus(round.status)) {
    return null
  }

  const fairness = round.fairness
  const countdown = resolveCountdownLabel(round, displayNow)
  const previousRoundProof = fairness.previousRoundProof

  return (
    <Card className="col-span-full overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border/50 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="size-1.5 rounded-full bg-primary/60 animate-pulse" />
            <span className="text-[10px] tracking-widest uppercase text-muted-foreground">
              Fairness
            </span>
          </div>
          <FairnessStatusBadge
            isRevealed={fairness.commitment.isSeedRevealed}
            status={round.status}
          />
        </div>
        <div className="flex items-center gap-2">
          <CopyableHash
            hash={fairness.commitment.serverSeedHash}
            label="Seed Hash"
          />
          <span className="text-[10px] text-muted-foreground/50">|</span>
          <CopyableValue value={fairness.nonce} label="Nonce" />
          <span className="text-[10px] text-muted-foreground/50">|</span>
          <code className="text-[10px] text-muted-foreground/80 font-mono tabular-nums">
            {countdown}
          </code>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
          >
            How this round is fixed
            <svg
              className={`ml-1 size-3 transition-transform duration-200 ${
                isExpanded ? "rotate-180" : ""
              }`}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </Button>

          {previousRoundProof && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedRoundId(previousRoundProof.roundId)}
              className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
            >
              Previous round proof
              <svg
                className="ml-1 size-3"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </Button>
          )}
        </div>

        {isExpanded && (
          <>
            <div className="grid grid-cols-4 gap-4 rounded-md border border-border/30 bg-muted/20 p-3">
              <div className="col-span-2 grid grid-cols-2 gap-3">
                <FairnessInfoItem
                  label="Strategy"
                  value={fairness.strategy.strategyDisplayName}
                />
                <FairnessInfoItem
                  label="Algorithm"
                  value={fairness.strategy.algorithm}
                />
                <FairnessInfoItem
                  label="Hash"
                  value={fairness.strategy.hashAlgorithm}
                />
                <FairnessInfoItem
                  label="Outcome"
                  value={fairness.strategy.outcomeAlgorithm}
                />
              </div>
              <div className="col-span-2 flex flex-col gap-3">
                <FairnessInfoItem
                  label="Curve"
                  value={`${fairness.curve.kind} v${fairness.curve.version}`}
                />
                <FairnessInfoItem
                  label="Base"
                  value={`${fairness.curve.baseMultiplier.toFixed(2)}x`}
                />
                <FairnessInfoItem
                  label="Growth"
                  value={`${fairness.curve.growthRate.toFixed(4)}/ms`}
                />
                <FairnessInfoItem
                  label="House Edge"
                  value={fairness.strategy.houseEdgeDescription}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 rounded-md bg-muted/20 p-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Verification Formula
                </span>
                <span className="text-[10px] text-muted-foreground/60">
                  Published {new Date(fairness.timeline.publishedAt).toLocaleTimeString()}
                </span>
              </div>
              <code className="break-all text-xs font-mono text-chart-1">
                {fairness.strategy.verificationFormula}
              </code>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Verification Steps
              </span>
              <div className="flex flex-col gap-1">
                {fairness.strategy.verificationSteps.map((step) => (
                  <div
                    key={step.order}
                    className="flex items-start gap-2 text-xs"
                  >
                    <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-muted text-[9px] font-medium">
                      {step.order}
                    </span>
                    <span className="text-muted-foreground">{step.instruction}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-md bg-destructive/5 p-2.5">
              <p className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <svg
                  className="size-3 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4M12 8h.01" />
                </svg>
                The crash point is already determined but remains hidden
                until the round crashes
              </p>
            </div>
          </>
        )}

        {previousRoundProof && (
          <>
            <Separator className="my-1" />
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Previous Round Verified
                </span>
                <Badge
                  variant="secondary"
                  className="bg-emerald-500/10 text-[10px] text-emerald-600"
                >
                  Verified
                </Badge>
              </div>
              <div className="grid grid-cols-5 gap-2 rounded-md bg-muted/20 p-2.5 text-xs">
                <div className="col-span-2 flex flex-col gap-0.5">
                  <span className="text-[9px] text-muted-foreground/60">Round</span>
                  <CopyableValue
                    value={previousRoundProof.roundId.slice(0, 8)}
                    label={previousRoundProof.roundId}
                  />
                </div>
                <div className="col-span-2 flex flex-col gap-0.5">
                  <span className="text-[9px] text-muted-foreground/60">Seed</span>
                  <CopyableValue
                    value={truncateHash(previousRoundProof.serverSeed, 6)}
                    label={previousRoundProof.serverSeed}
                  />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] text-muted-foreground/60">Crash</span>
                  <span className="font-semibold text-primary">
                    {formatMultiplier(previousRoundProof.crashPoint)}
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>

      <VerificationModal
        roundId={selectedRoundId ?? ""}
        open={!!selectedRoundId}
        onOpenChange={(open) => !open && setSelectedRoundId(null)}
      />
    </Card>
  )
}

function isPreRoundStatus(status: Round["status"]): boolean {
  return (
    status === "WAITING_FOR_FIRST_BET" ||
    status === "BETTING_OPEN" ||
    status === "BETTING_CLOSED"
  )
}

function resolveCountdownLabel(round: Round, displayNow: number): string {
  if (round.status === "BETTING_OPEN" && round.bettingClosesAt) {
    return formatRemainingTime(
      new Date(round.bettingClosesAt).getTime() - displayNow,
    )
  }

  if (round.status === "BETTING_CLOSED" && round.startsAt) {
    return formatRemainingTime(new Date(round.startsAt).getTime() - displayNow)
  }

  if (round.status === "WAITING_FOR_FIRST_BET") {
    return "Awaiting first bet"
  }

  return ""
}

function formatRemainingTime(remainingInMs: number): string {
  const seconds = Math.max(0, Math.ceil(remainingInMs / 1000))
  return `${seconds}s`
}

function FairnessStatusBadge({
  isRevealed,
  status,
}: {
  isRevealed: boolean
  status: Round["status"]
}) {
  if (isRevealed || status === "CRASHED" || status === "SETTLED") {
    return (
      <Badge variant="secondary" className="bg-emerald-500/10 text-[9px] text-emerald-600">
        Seed revealed
      </Badge>
    )
  }

  return (
    <Badge variant="outline" className="text-[9px]">
      Seed hidden
    </Badge>
  )
}

function CopyableHash({
  hash,
  label,
}: {
  hash: string
  label: string
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(hash)
    setCopied(true)
    toast.success("Copied to clipboard")
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 text-left"
        >
          <span className="text-[10px] text-muted-foreground/70">{label}:</span>
          <code className="cursor-pointer text-[10px] font-mono text-chart-1 hover:underline">
            {truncateHash(hash, 8)}
          </code>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <div className="flex flex-col gap-1">
          <p className="font-mono text-xs break-all">{hash}</p>
          <p className="text-[10px] text-muted-foreground">
            {copied ? "✓ Copied!" : "Click to copy"}
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

function CopyableValue({
  value,
  label,
}: {
  value: string
  label: string
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(label)
    setCopied(true)
    toast.success("Copied to clipboard")
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={handleCopy}
          className="cursor-pointer text-left hover:underline"
        >
          <span className="text-[10px] font-mono text-chart-1">{value}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p className="text-[10px] text-muted-foreground">
          {copied ? "✓ Copied!" : "Click to copy"}
        </p>
      </TooltipContent>
    </Tooltip>
  )
}

function FairnessInfoItem({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60">
        {label}
      </span>
      <span className="text-xs">{value}</span>
    </div>
  )
}