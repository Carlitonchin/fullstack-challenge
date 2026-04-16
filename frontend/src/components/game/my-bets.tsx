import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatCents, formatMultiplier, formatTimeAgo } from "@/lib/format"
import type { Bet } from "@/lib/api"

interface MyBetsProps {
  bets: Bet[] | undefined
  isLoading: boolean
}

export function MyBets({ bets, isLoading }: MyBetsProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-20" />
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </CardContent>
      </Card>
    )
  }

  const allBets = bets ?? []
  const wonBets = allBets.filter((b) => b.status === "CASHED_OUT")
  const lostBets = allBets.filter((b) => b.status === "LOST")

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">My Bets</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Tabs defaultValue="all" className="w-full">
          <div className="px-4">
            <TabsList className="w-full">
              <TabsTrigger value="all" className="flex-1 text-xs">
                All ({allBets.length})
              </TabsTrigger>
              <TabsTrigger value="won" className="flex-1 text-xs">
                Won ({wonBets.length})
              </TabsTrigger>
              <TabsTrigger value="lost" className="flex-1 text-xs">
                Lost ({lostBets.length})
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="all" className="mt-0">
            <BetList bets={allBets} />
          </TabsContent>
          <TabsContent value="won" className="mt-0">
            <BetList bets={wonBets} />
          </TabsContent>
          <TabsContent value="lost" className="mt-0">
            <BetList bets={lostBets} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

function BetList({ bets }: { bets: Bet[] }) {
  if (bets.length === 0) {
    return (
      <p className="py-8 text-center text-xs text-muted-foreground">
        No bets to show
      </p>
    )
  }

  return (
    <ScrollArea className="h-[240px]">
      <div className="flex flex-col gap-1 p-4 pt-2">
        {bets.map((bet) => {
          const isWon = bet.status === "CASHED_OUT"
          const profitCents = isWon
            ? (bet.payoutCents ?? 0) - bet.amountCents
            : -bet.amountCents

          return (
            <div
              key={bet.id}
              className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2"
            >
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium tabular-nums">
                    {formatCents(bet.amountCents)}
                  </span>
                  {isWon && bet.cashoutMultiplier && (
                    <Badge variant="outline" className="text-[10px] text-primary border-primary/30">
                      {formatMultiplier(bet.cashoutMultiplier)}
                    </Badge>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {formatTimeAgo(bet.createdAt)}
                </span>
              </div>

              <span
                className={`text-xs font-semibold tabular-nums ${
                  isWon ? "text-primary" : "text-destructive"
                }`}
              >
                {isWon ? "+" : ""}
                {formatCents(profitCents)}
              </span>
            </div>
          )
        })}
      </div>
    </ScrollArea>
  )
}
