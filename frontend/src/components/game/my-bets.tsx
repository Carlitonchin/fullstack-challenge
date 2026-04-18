import { useEffect, useRef } from "react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { formatCents, formatMultiplier, formatTimeAgo } from "@/lib/format"
import type { Bet } from "@/lib/api"

interface MyBetsProps {
  bets: Bet[] | undefined
  isLoading: boolean
  hasNextPage: boolean | undefined
  isFetchingNextPage: boolean
  onLoadMore: () => void
}

export function MyBets({
  bets,
  isLoading,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: MyBetsProps) {
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

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">My Bets</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <BetList
          bets={allBets}
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          onLoadMore={onLoadMore}
        />
      </CardContent>
    </Card>
  )
}

function BetList({
  bets,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: {
  bets: Bet[]
  hasNextPage: boolean | undefined
  isFetchingNextPage: boolean
  onLoadMore: () => void
}) {
  const scrollRootRef = useRef<HTMLDivElement | null>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const rootElement = scrollRootRef.current?.querySelector(
      '[data-slot="scroll-area-viewport"]',
    )
    const sentinelElement = sentinelRef.current

    if (!rootElement || !sentinelElement || !hasNextPage) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting) && !isFetchingNextPage) {
          onLoadMore()
        }
      },
      {
        root: rootElement,
        rootMargin: "120px 0px",
      },
    )

    observer.observe(sentinelElement)

    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, onLoadMore])

  if (bets.length === 0) {
    return (
      <p className="py-8 text-center text-xs text-muted-foreground">
        No bets to show
      </p>
    )
  }

  return (
    <ScrollArea className="h-[240px]" ref={scrollRootRef}>
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
              <BetContext bet={bet} />
            </div>

            <BetValue bet={bet} />
          </div>
        ))}

        <div ref={sentinelRef} className="h-1 w-full" />

        {hasNextPage ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2 w-full text-xs"
            onClick={onLoadMore}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? "Loading more…" : "Load more"}
          </Button>
        ) : null}
      </div>
    </ScrollArea>
  )
}

function BetStatusBadge({ bet }: { bet: Bet }) {
  if (hasWonBet(bet) && bet.cashoutMultiplier) {
    return (
      <Badge variant="outline" className="border-primary/30 text-[10px] text-primary">
        Cashout {formatMultiplier(bet.cashoutMultiplier)}
      </Badge>
    )
  }

  if (hasLostBet(bet)) {
    return (
      <Badge
        variant="outline"
        className="border-destructive/30 text-[10px] text-destructive"
      >
        Lost
      </Badge>
    )
  }

  if (bet.status === "REJECTED") {
    return <Badge variant="outline" className="text-[10px]">Rejected</Badge>
  }

  return <Badge variant="secondary" className="text-[10px]">{bet.status.toLowerCase()}</Badge>
}

function BetContext({ bet }: { bet: Bet }) {
  const crashLabel =
    bet.roundCrashMultiplier !== null
      ? `Crash ${formatMultiplier(bet.roundCrashMultiplier)}`
      : null

  if (hasLostBet(bet)) {
    return (
      <span className="text-[10px] text-muted-foreground">
        {crashLabel ?? formatTimeAgo(bet.createdAt)}
      </span>
    )
  }

  if (hasWonBet(bet) && crashLabel) {
    return (
      <span className="text-[10px] text-muted-foreground">
        {crashLabel}
      </span>
    )
  }

  return (
    <span className="text-[10px] text-muted-foreground">
      {formatTimeAgo(bet.createdAt)}
    </span>
  )
}

function BetValue({ bet }: { bet: Bet }) {
  if (hasWonBet(bet)) {
    const profit = bet.payoutAmountInCents! - bet.amountInCents

    return (
      <span className="text-xs font-semibold text-primary tabular-nums">
        +{formatCents(profit)}
      </span>
    )
  }

  if (hasLostBet(bet)) {
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

function hasWonBet(bet: Bet): boolean {
  return (
    (bet.status === "CASHED_OUT" || bet.status === "SETTLED") &&
    bet.cashoutMultiplier !== null &&
    bet.payoutAmountInCents !== null
  )
}

function hasLostBet(bet: Bet): boolean {
  return (
    bet.status === "LOST" ||
    (bet.status === "SETTLED" &&
      bet.cashoutMultiplier === null &&
      bet.payoutAmountInCents === null)
  )
}