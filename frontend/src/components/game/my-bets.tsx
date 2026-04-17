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
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full rounded-lg" />
          ))}
        </CardContent>
      </Card>
    )
  }

  const allBets = bets ?? []
  const openBets = allBets.filter((bet) =>
    ["PENDING", "ACCEPTED", "CASHED_OUT"].includes(bet.status),
  )
  const resolvedBets = allBets.filter((bet) =>
    ["LOST", "SETTLED", "REJECTED"].includes(bet.status),
  )

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
              <TabsTrigger value="open" className="flex-1 text-xs">
                Open ({openBets.length})
              </TabsTrigger>
              <TabsTrigger value="resolved" className="flex-1 text-xs">
                Resolved ({resolvedBets.length})
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="all" className="mt-0">
            <BetList bets={allBets} />
          </TabsContent>
          <TabsContent value="open" className="mt-0">
            <BetList bets={openBets} />
          </TabsContent>
          <TabsContent value="resolved" className="mt-0">
            <BetList bets={resolvedBets} />
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
        {bets.map((bet) => (
          <div
            key={bet.id}
            className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2"
          >
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium tabular-nums">
                  {formatCents(bet.amountInCents)}
                </span>
                <BetStatusBadge bet={bet} />
              </div>
              <span className="text-[10px] text-muted-foreground">
                {formatTimeAgo(bet.createdAt)}
              </span>
            </div>

            <BetValue bet={bet} />
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}

function BetStatusBadge({ bet }: { bet: Bet }) {
  if ((bet.status === "CASHED_OUT" || bet.status === "SETTLED") && bet.cashoutMultiplier) {
    return (
      <Badge variant="outline" className="border-primary/30 text-[10px] text-primary">
        {formatMultiplier(bet.cashoutMultiplier)}
      </Badge>
    )
  }

  if (bet.status === "LOST") {
    return <Badge variant="destructive" className="text-[10px]">Lost</Badge>
  }

  if (bet.status === "REJECTED") {
    return <Badge variant="outline" className="text-[10px]">Rejected</Badge>
  }

  return <Badge variant="secondary" className="text-[10px]">{bet.status.toLowerCase()}</Badge>
}

function BetValue({ bet }: { bet: Bet }) {
  if (bet.status === "CASHED_OUT" || bet.status === "SETTLED") {
    const profit = (bet.payoutAmountInCents ?? 0) - bet.amountInCents

    return (
      <span className="text-xs font-semibold text-primary tabular-nums">
        +{formatCents(profit)}
      </span>
    )
  }

  if (bet.status === "LOST") {
    return (
      <span className="text-xs font-semibold text-destructive tabular-nums">
        -{formatCents(bet.amountInCents)}
      </span>
    )
  }

  if (bet.status === "REJECTED") {
    return (
      <span className="text-right text-[10px] text-muted-foreground">
        {bet.rejectionReason ?? "Rejected"}
      </span>
    )
  }

  return (
    <span className="text-xs font-semibold text-muted-foreground tabular-nums">
      {bet.status.toLowerCase()}
    </span>
  )
}
