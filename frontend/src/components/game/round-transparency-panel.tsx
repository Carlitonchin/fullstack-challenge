import { useState } from "react"
import { EyeIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
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

  if (!round) {
    return null
  }

  const isPreRound = isPreRoundStatus(round.status)
  const isRunning = round.status === "IN_PROGRESS"
  const isSettled = round.status === "CRASHED" || round.status === "SETTLED"

  if (round.status === "ERROR" || (round.status === "WAITING_FOR_FIRST_BET" && !round.serverSeedHash)) {
    return null
  }

  const fairness = round.fairness
  const previousRoundProof = fairness.previousRoundProof

  return (
    <Card className="col-span-full overflow-hidden">
      <CardHeader className="flex flex-col gap-2 border-b border-border/50 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2">
            <div className="size-1.5 rounded-full bg-primary/60 animate-pulse" />
            <span className="text-[10px] tracking-widest uppercase text-muted-foreground">
              Fairness
            </span>
          </div>
          <FairnessStatusBadge
            isRevealed={fairness.commitment.isSeedRevealed}
            isRunning={isRunning}
            isSettled={isSettled}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-1 lg:items-end">
          <div className="flex min-w-0 flex-col gap-1 lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-2 lg:gap-y-1 lg:justify-end">
            <CopyableHash
              hash={fairness.commitment.serverSeedHash}
              label="Seed Hash"
            />
            <span className="hidden text-[10px] text-muted-foreground/50 lg:inline">
              |
            </span>
            <CopyableValueWithLabel value={fairness.nonce} label="Nonce" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-auto w-fit p-0 text-left text-xs text-muted-foreground hover:text-foreground"
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

        </div>

        {isExpanded && (
          <>
            <div className="grid gap-4 rounded-md border border-border/30 bg-muted/20 p-3 lg:grid-cols-2">
              <div className="grid gap-3 sm:grid-cols-2">
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
              <div className="grid gap-3 sm:grid-cols-2">
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
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Verification Formula
                </span>
                <span className="text-[10px] text-muted-foreground/60 sm:text-right">
                  Published {new Date(fairness.timeline.publishedAt).toLocaleTimeString()}
                </span>
              </div>
              <code className="overflow-x-auto whitespace-pre-wrap break-all text-xs font-mono text-chart-1">
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
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setSelectedRoundId(previousRoundProof.roundId)}
                      className="order-1 w-fit sm:order-2"
                    >
                      <Badge
                        variant="secondary"
                        className="flex w-fit cursor-pointer items-center gap-1 bg-emerald-500/10 text-[10px] text-emerald-600 transition-colors hover:bg-emerald-500/15"
                      >
                        Verified
                        <EyeIcon className="size-3.5" />
                        <span className="sr-only">View previous round proof details</span>
                      </Badge>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    View previous round proof details
                  </TooltipContent>
                </Tooltip>
                <span className="order-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:order-1">
                  Previous Round Verified
                </span>
              </div>
              <div className="grid gap-2 rounded-md bg-muted/20 p-2.5 text-xs sm:grid-cols-2 lg:grid-cols-5">
                <div className="flex flex-col gap-0.5 sm:col-span-1 lg:col-span-2">
                  <span className="text-[9px] text-muted-foreground/60">Nonce</span>
                  <CopyableValue
                    value={previousRoundProof.nonce}
                    label={previousRoundProof.nonce}
                  />
                </div>
                <div className="flex flex-col gap-0.5 sm:col-span-1 lg:col-span-2">
                  <span className="text-[9px] text-muted-foreground/60">Seed</span>
                  <CopyableValue
                    value={truncateHash(previousRoundProof.serverSeed, 6)}
                    label={previousRoundProof.serverSeed}
                    tooltipValue={previousRoundProof.serverSeed}
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

function FairnessStatusBadge({
  isRevealed,
  isRunning,
  isSettled,
}: {
  isRevealed: boolean
  isRunning: boolean
  isSettled: boolean
}) {
  if (isRevealed && isSettled) {
    return (
      <Badge variant="secondary" className="bg-emerald-500/10 text-[9px] text-emerald-600">
        Seed revealed
      </Badge>
    )
  }

  if (isRunning) {
    return (
      <Badge variant="outline" className="animate-pulse text-[9px]">
        Running
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
    <div className="flex min-w-0 items-center gap-1 leading-none">
      <span className="text-[10px] leading-none text-muted-foreground/70">{label}:</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex min-w-0 max-w-full items-center text-left leading-none"
          >
            <code className="max-w-full truncate cursor-pointer text-[10px] font-mono leading-none text-chart-1 hover:underline">
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
    </div>
  )
}

function CopyableValue({
  value,
  label,
  tooltipValue,
}: {
  value: string
  label: string
  tooltipValue?: string
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
          className="inline-flex min-w-0 max-w-full cursor-pointer items-center text-left leading-none hover:underline"
        >
          <span className="max-w-full truncate text-[10px] font-mono leading-none text-chart-1">
            {value}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <div className="flex flex-col gap-1">
          {tooltipValue ? (
            <p className="font-mono text-xs break-all">{tooltipValue}</p>
          ) : null}
          <p className="text-[10px] text-muted-foreground">
            {copied ? "✓ Copied!" : "Click to copy"}
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

function CopyableValueWithLabel({
  value,
  label,
  tooltipValue,
}: {
  value: string
  label: string
  tooltipValue?: string
}) {
  return (
    <div className="flex min-w-0 items-center gap-1 leading-none">
      <span className="text-[10px] leading-none text-muted-foreground/70">{label}:</span>
      <CopyableValue
        value={value}
        label={value}
        tooltipValue={tooltipValue}
      />
    </div>
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
