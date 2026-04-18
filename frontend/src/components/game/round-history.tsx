import { useState } from "react"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Skeleton } from "@/components/ui/skeleton"
import { formatMultiplier, formatTimeAgo, truncateHash } from "@/lib/format"
import type { RoundHistoryEntry } from "@/lib/api"
import { VerificationModal } from "./verification-modal"

interface RoundHistoryProps {
  rounds: RoundHistoryEntry[] | undefined
  isLoading: boolean
}

function getCrashColor(point: number): string {
  if (point < 1.5) return "text-destructive"
  if (point < 2.0) return "text-orange-400"
  if (point < 5.0) return "text-chart-1"
  return "text-primary"
}

function getCrashBg(point: number): string {
  if (point < 1.5) return "bg-destructive/10 border-destructive/20 hover:bg-destructive/15"
  if (point < 2.0) return "bg-orange-500/10 border-orange-500/20 hover:bg-orange-500/15"
  if (point < 5.0) return "bg-chart-1/10 border-chart-1/20 hover:bg-chart-1/15"
  return "bg-primary/10 border-primary/20 hover:bg-primary/15"
}

export function RoundHistory({ rounds, isLoading }: RoundHistoryProps) {
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null)

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setSelectedRoundId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex gap-1.5 px-1">
        {Array.from({ length: 12 }).map((_, index) => (
          <Skeleton key={index} className="h-7 w-14 shrink-0 rounded-md" />
        ))}
      </div>
    )
  }

  if (!rounds || rounds.length === 0) {
    return (
      <p className="py-2 text-center text-xs text-muted-foreground">
        No history yet
      </p>
    )
  }

  return (
    <>
      <ScrollArea className="w-full">
        <div className="flex gap-1.5 px-1 py-1">
          {rounds.map((round) => (
            <Tooltip key={round.id}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setSelectedRoundId(round.id)}
                  className={`shrink-0 cursor-pointer rounded-md border px-2.5 py-1 text-xs font-semibold tabular-nums transition-colors ${getCrashBg(round.crashPoint)} ${getCrashColor(round.crashPoint)}`}
                >
                  {formatMultiplier(round.crashPoint)}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                <div className="flex flex-col gap-1">
                  <span>Round {round.id.slice(0, 8)}</span>
                  <span className="text-muted-foreground">
                    {round.playerCount} players
                  </span>
                  <span className="text-muted-foreground">
                    {formatTimeAgo(round.crashedAt)}
                  </span>
                  <code className="text-[10px] text-muted-foreground/70">
                    {truncateHash(round.serverSeedHash, 4)}
                  </code>
                </div>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      <VerificationModal
        roundId={selectedRoundId ?? ""}
        open={!!selectedRoundId}
        onOpenChange={handleOpenChange}
      />
    </>
  )
}
