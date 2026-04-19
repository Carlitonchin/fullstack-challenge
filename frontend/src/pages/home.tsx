import { useMemo } from "react"
import {
  CrashChart,
  BetControls,
  CurrentBets,
  RoundHistory,
  PlayerInfo,
  MyBets,
  RoundTransparencyPanel,
} from "@/components/game"
import {
  useCurrentGameSnapshot,
  useRoundHistory,
  useWallet,
  usePlayer,
  useMyBets,
  useGameRealtime,
} from "@/hooks/use-game-queries"
import { logoutToLogin } from "@/lib/auth"

export default function HomePage() {
  const snapshotQuery = useCurrentGameSnapshot()
  const historyQuery = useRoundHistory(1, 20)
  const walletQuery = useWallet()
  const playerQuery = usePlayer()
  const myBetsQuery = useMyBets()
  useGameRealtime(playerQuery.data?.id)

  const currentRound = snapshotQuery.data?.round ?? undefined
  const currentBets = snapshotQuery.data?.bets
  const myBets = useMemo(
    () => myBetsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [myBetsQuery.data],
  )

  return (
    <div className="relative min-h-svh bg-background">
      {/* Background grid — same as login for visual consistency */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* Top glow */}
      <div className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-primary/4 blur-[140px]" />

      {/* Header */}
      <header className="relative z-10 border-b border-border/50">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 lg:px-6">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-20 items-center justify-center rounded-lg bg-primary/[0.08] px-2 ring-1 ring-primary/[0.15]">
              <img
                src="/icon.png"
                alt="Crash Game"
                className="h-full w-full object-contain"
              />
            </div>
          </div>

          {/* Player info */}
          <PlayerInfo
            player={playerQuery.data}
            wallet={walletQuery.data}
            isLoadingPlayer={playerQuery.isLoading}
            isLoadingWallet={walletQuery.isLoading}
            onLogout={logoutToLogin}
          />
        </div>
      </header>

      {/* Round History bar */}
      <div className="relative z-10 border-b border-border/30 bg-card/30 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-2 lg:px-6">
          <RoundHistory
            rounds={historyQuery.data?.items}
            isLoading={historyQuery.isLoading}
          />
        </div>
      </div>

      {/* Main content */}
      <main className="relative z-10 mx-auto max-w-7xl px-4 py-4 lg:px-6 lg:py-6">
        <div className="mx-auto w-full max-w-2xl lg:max-w-none">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-6">
            <div className="lg:col-span-8 flex flex-col gap-4 lg:gap-6">
              <div className="order-2 lg:order-1">
                <CrashChart
                  round={currentRound}
                  serverTime={snapshotQuery.data?.serverTime}
                  isLoading={snapshotQuery.isLoading}
                />
              </div>

              <div className="order-1 lg:order-2">
                <RoundTransparencyPanel
                  round={currentRound}
                />
              </div>
            </div>

            <div className="lg:col-span-4 flex flex-col gap-4 lg:gap-6">
              <BetControls
                round={currentRound}
                serverTime={snapshotQuery.data?.serverTime}
                myBets={myBets}
                wallet={walletQuery.data}
                isLoadingRound={snapshotQuery.isLoading}
                isLoadingWallet={walletQuery.isLoading}
                isLoadingMyBets={myBetsQuery.isLoading}
              />

              <MyBets
                bets={myBets}
                isLoading={myBetsQuery.isLoading}
                hasNextPage={myBetsQuery.hasNextPage}
                isFetchingNextPage={myBetsQuery.isFetchingNextPage}
                onLoadMore={() => void myBetsQuery.fetchNextPage()}
              />

              <CurrentBets
                bets={currentBets}
                isLoading={snapshotQuery.isLoading}
              />
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/30">
        <div className="mx-auto max-w-7xl px-4 py-4 lg:px-6">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-muted-foreground/60">
              Provably fair · Open source
            </p>
            <p className="text-[10px] text-muted-foreground/40 tabular-nums">
              v0.1.0
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
