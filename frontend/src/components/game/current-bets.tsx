import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCents, formatMultiplier } from "@/lib/format"
import type { Bet } from "@/lib/api"

interface CurrentBetsProps {
  bets: Bet[] | undefined
  isLoading: boolean
}

function getInitials(name: string): string {
  return name.slice(0, 2).toUpperCase()
}

function getAvatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `oklch(0.65 0.15 ${hue})`
}

export function CurrentBets({ bets, isLoading }: CurrentBetsProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-28" />
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="size-8 rounded-full" />
              <div className="flex flex-col gap-1.5 flex-1">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-14" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  const sortedBets = [...(bets ?? [])].sort((a, b) => b.amountCents - a.amountCents)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Live Bets</CardTitle>
          <Badge variant="secondary" className="text-[10px] tabular-nums">
            {sortedBets.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[320px]">
          <div className="flex flex-col gap-0.5 px-4 pb-4">
            {sortedBets.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">
                No bets yet
              </p>
            ) : (
              sortedBets.map((bet) => (
                <div
                  key={bet.id}
                  className={`flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors ${
                    bet.status === "CASHED_OUT" ? "bg-primary/5" : "hover:bg-muted/50"
                  }`}
                >
                  <Avatar className="size-7">
                    <AvatarFallback
                      className="text-[10px] font-bold text-white"
                      style={{ backgroundColor: getAvatarColor(bet.playerName) }}
                    >
                      {getInitials(bet.playerName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{bet.playerName}</p>
                    <p className="text-[10px] text-muted-foreground tabular-nums">
                      {formatCents(bet.amountCents)}
                    </p>
                  </div>
                  <div className="text-right">
                    {bet.status === "CASHED_OUT" ? (
                      <div className="flex flex-col items-end">
                        <Badge variant="outline" className="text-[10px] text-primary border-primary/30">
                          {formatMultiplier(bet.cashoutMultiplier ?? 0)}
                        </Badge>
                        <span className="text-[10px] text-primary/80 tabular-nums mt-0.5">
                          +{formatCents(bet.payoutCents ?? 0)}
                        </span>
                      </div>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">Playing</Badge>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
