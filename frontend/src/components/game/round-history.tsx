import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Skeleton } from "@/components/ui/skeleton"
import { formatMultiplier, truncateHash } from "@/lib/format"
import type { RoundHistoryEntry } from "@/lib/api"

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
  if (isLoading) {
    return (
      <div className="flex gap-1.5 px-1">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-14 rounded-md shrink-0" />
        ))}
      </div>
    )
  }

  if (!rounds || rounds.length === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-2">
        No history yet
      </p>
    )
  }

  return (
    <ScrollArea className="w-full">
      <div className="flex gap-1.5 px-1 py-1">
        {rounds.map((round) => (
          <Tooltip key={round.id}>
            <TooltipTrigger asChild>
              <button
                className={`shrink-0 cursor-pointer rounded-md border px-2.5 py-1 text-xs font-semibold tabular-nums transition-colors ${getCrashBg(round.crashPoint)} ${getCrashColor(round.crashPoint)}`}
              >
                {formatMultiplier(round.crashPoint)}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              <div className="flex flex-col gap-1">
                <span>Round #{round.id.split("_")[1]}</span>
                <span className="text-muted-foreground">
                  {round.playerCount} players
                </span>
                <code className="text-[10px] text-muted-foreground/70">
                  {truncateHash(round.hashSeed, 4)}
                </code>
              </div>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  )
}
