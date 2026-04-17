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

  for (let index = 0; index < name.length; index += 1) {
    hash = name.charCodeAt(index) + ((hash << 5) - hash)
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
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3">
              <Skeleton className="size-8 rounded-full" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-14" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  const sortedBets = [...(bets ?? [])].sort((left, right) => {
    if (right.amountInCents !== left.amountInCents) {
      return right.amountInCents - left.amountInCents
    }

    return left.createdAt.localeCompare(right.createdAt)
  })

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
                No public bets yet
              </p>
            ) : (
              sortedBets.map((bet) => (
                <div
                  key={bet.id}
                  className={`flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors ${
                    bet.status === "CASHED_OUT" || bet.status === "SETTLED"
                      ? "bg-primary/5"
                      : bet.status === "LOST"
                        ? "bg-destructive/5"
                        : "hover:bg-muted/50"
                  }`}
                >
                  <Avatar className="size-7">
                    <AvatarFallback
                      className="text-[10px] font-bold text-white"
                      style={{ backgroundColor: getAvatarColor(bet.playerUsername) }}
                    >
                      {getInitials(bet.playerUsername)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{bet.playerUsername}</p>
                    <p className="text-[10px] text-muted-foreground tabular-nums">
                      {formatCents(bet.amountInCents)}
                    </p>
                  </div>
                  <div className="text-right">
                    {bet.status === "CASHED_OUT" || bet.status === "SETTLED" ? (
                      <div className="flex flex-col items-end">
                        <Badge variant="outline" className="border-primary/30 text-[10px] text-primary">
                          {formatMultiplier(bet.cashoutMultiplier ?? 1)}
                        </Badge>
                        <span className="mt-0.5 text-[10px] text-primary/80 tabular-nums">
                          +{formatCents(bet.payoutAmountInCents ?? 0)}
                        </span>
                      </div>
                    ) : bet.status === "LOST" ? (
                      <Badge variant="destructive" className="text-[10px]">
                        Lost
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">
                        Playing
                      </Badge>
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
