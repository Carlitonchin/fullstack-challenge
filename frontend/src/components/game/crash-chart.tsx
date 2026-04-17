import { useEffect, useMemo, useRef } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useSyncedNow } from "@/hooks/use-synced-now"
import type { Round } from "@/lib/api"
import { formatMultiplier, truncateHash } from "@/lib/format"
import {
  getRoundDurationInMs,
  getRoundElapsedInMs,
  multiplierFromRoundCurve,
  resolveDisplayedRoundMultiplier,
} from "@/lib/round-curve"

interface CrashChartProps {
  round: Round | undefined
  serverTime: string | undefined
  isLoading: boolean
}

export function CrashChart({ round, serverTime, isLoading }: CrashChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const displayNow = useSyncedNow(serverTime, round?.id)

  const presentState = useMemo(() => {
    if (!round) {
      return {
        multiplier: 1,
        countdownSeconds: null as number | null,
        elapsedInMs: 0,
      }
    }

    switch (round.status) {
      case "BETTING_OPEN":
        return {
          multiplier: 1,
          countdownSeconds: Math.max(
            0,
            Math.ceil((new Date(round.bettingClosesAt).getTime() - displayNow) / 1000),
          ),
          elapsedInMs: 0,
        }
      case "BETTING_CLOSED":
        return {
          multiplier: 1,
          countdownSeconds: Math.max(
            0,
            Math.ceil((new Date(round.startsAt).getTime() - displayNow) / 1000),
          ),
          elapsedInMs: 0,
        }
      case "IN_PROGRESS":
        return {
          multiplier: resolveDisplayedRoundMultiplier(round, displayNow),
          countdownSeconds: null,
          elapsedInMs: getRoundElapsedInMs(round, displayNow) ?? 0,
        }
      case "CRASHED":
      case "SETTLED":
        return {
          multiplier: round.crashPoint ?? round.currentMultiplier,
          countdownSeconds: null,
          elapsedInMs: getRoundDurationInMs(round) ?? 0,
        }
      case "ERROR":
      default:
        return {
          multiplier: 1,
          countdownSeconds: null,
          elapsedInMs: 0,
        }
    }
  }, [displayNow, round])

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current

    if (!canvas || !container) {
      return
    }

    const dpr = window.devicePixelRatio || 1
    const rect = container.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr

    const ctx = canvas.getContext("2d")

    if (!ctx) {
      return
    }

    ctx.resetTransform()
    ctx.scale(dpr, dpr)

    const width = rect.width
    const height = rect.height
    ctx.clearRect(0, 0, width, height)

    const gridColor = "rgba(255, 255, 255, 0.04)"
    ctx.strokeStyle = gridColor
    ctx.lineWidth = 1

    for (let x = 60; x < width; x += 60) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
    }

    for (let y = 40; y < height; y += 40) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }

    if (
      !round ||
      round.status === "BETTING_OPEN" ||
      round.status === "BETTING_CLOSED" ||
      round.status === "ERROR"
    ) {
      return
    }

    const padding = 40
    const curveWidth = width - padding * 2
    const curveHeight = height - padding * 2
    const pathPoints = buildCurvePath({
      round,
      elapsedInMs: presentState.elapsedInMs,
      width: curveWidth,
      height: curveHeight,
      padding,
      steps: 200,
    })

    if (pathPoints.length === 0) {
      return
    }

    const isCrashed = round.status === "CRASHED" || round.status === "SETTLED"
    const multiplier = presentState.multiplier
    const curveColor = isCrashed
      ? "oklch(0.704 0.191 22.216)"
      : multiplier >= 5
        ? "oklch(0.768 0.233 130.85)"
        : multiplier >= 2
          ? "oklch(0.897 0.196 126.665)"
          : "oklch(0.768 0.233 130.85)"

    const gradient = ctx.createLinearGradient(0, height, 0, 0)
    gradient.addColorStop(0, "transparent")
    gradient.addColorStop(
      1,
      isCrashed ? "rgba(239, 68, 68, 0.08)" : "rgba(132, 204, 22, 0.08)",
    )

    ctx.beginPath()
    ctx.moveTo(padding, height - padding)

    for (const point of pathPoints) {
      ctx.lineTo(point.x, point.y)
    }

    ctx.lineTo(pathPoints[pathPoints.length - 1]!.x, height - padding)
    ctx.closePath()
    ctx.fillStyle = gradient
    ctx.fill()

    ctx.beginPath()
    ctx.moveTo(padding, height - padding)

    for (const point of pathPoints) {
      ctx.lineTo(point.x, point.y)
    }

    ctx.strokeStyle = curveColor
    ctx.lineWidth = 2.5
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.stroke()

    const head = pathPoints[pathPoints.length - 1]!
    const glowRadius = isCrashed ? 14 : 18

    ctx.beginPath()
    ctx.fillStyle = isCrashed ? "rgba(239, 68, 68, 0.28)" : "rgba(132, 204, 22, 0.24)"
    ctx.arc(head.x, head.y, glowRadius, 0, Math.PI * 2)
    ctx.fill()

    ctx.beginPath()
    ctx.fillStyle = curveColor
    ctx.arc(head.x, head.y, 4.5, 0, Math.PI * 2)
    ctx.fill()
  }, [presentState.elapsedInMs, presentState.multiplier, round])

  if (isLoading) {
    return (
      <Card className="col-span-full">
        <CardContent className="flex items-center justify-center" style={{ minHeight: 340 }}>
          <Skeleton className="h-60 w-full rounded-lg" />
        </CardContent>
      </Card>
    )
  }

  const isBettingOpen = round?.status === "BETTING_OPEN"
  const isBettingClosed = round?.status === "BETTING_CLOSED"
  const isRunning = round?.status === "IN_PROGRESS"
  const isCrashed = round?.status === "CRASHED" || round?.status === "SETTLED"
  const isError = round?.status === "ERROR"

  return (
    <Card className="relative col-span-full overflow-hidden">
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-2">
        <div className="flex items-center gap-2">
          <div className="size-1.5 rounded-full bg-primary/60 animate-pulse" />
          <span className="text-[10px] tracking-widest uppercase text-muted-foreground">
            Round {round ? round.id.slice(0, 8) : "—"}
          </span>
        </div>
        {round?.serverSeedHash && (
          <code className="text-[10px] text-muted-foreground/60 font-mono">
            SHA256: {truncateHash(round.serverSeedHash, 8)}
          </code>
        )}
      </div>

      <CardContent className="relative p-0">
        <div ref={containerRef} className="relative" style={{ height: 340 }}>
          <canvas
            ref={canvasRef}
            className="absolute inset-0 size-full"
            style={{ width: "100%", height: "100%" }}
          />

          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3">
            {isBettingOpen && (
              <>
                <Badge variant="outline" className="animate-pulse text-xs">
                  Betting open
                </Badge>
                <span className="font-heading text-5xl font-bold tracking-tighter tabular-nums text-foreground">
                  {presentState.countdownSeconds ?? "—"}s
                </span>
                <span className="text-xs uppercase tracking-widest text-muted-foreground">
                  Place your bet
                </span>
              </>
            )}

            {isBettingClosed && (
              <>
                <Badge variant="outline" className="text-xs">
                  Betting closed
                </Badge>
                <span className="font-heading text-4xl font-bold tracking-tighter tabular-nums text-foreground">
                  {presentState.countdownSeconds ?? "—"}s
                </span>
                <span className="text-xs uppercase tracking-widest text-muted-foreground">
                  Round starting
                </span>
              </>
            )}

            {isRunning && (
              <span
                className={`font-heading text-6xl font-bold tracking-tighter tabular-nums transition-colors duration-200 ${
                  presentState.multiplier >= 5
                    ? "text-primary drop-shadow-[0_0_24px_oklch(0.768_0.233_130.85/0.5)]"
                    : presentState.multiplier >= 2
                      ? "text-chart-1"
                      : "text-foreground"
                }`}
              >
                {formatMultiplier(presentState.multiplier)}
              </span>
            )}

            {isCrashed && (
              <>
                <Badge variant="destructive" className="mb-1 text-xs">
                  Crashed
                </Badge>
                <span className="font-heading text-6xl font-bold tracking-tighter tabular-nums text-destructive">
                  {formatMultiplier(round?.crashPoint ?? 1)}
                </span>
              </>
            )}

            {isError && (
              <>
                <Badge variant="destructive" className="mb-1 text-xs">
                  Manual review
                </Badge>
                <span className="text-sm uppercase tracking-widest text-muted-foreground">
                  Game paused
                </span>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function buildCurvePath(params: {
  round: Round
  elapsedInMs: number
  width: number
  height: number
  padding: number
  steps: number
}): Array<{ x: number; y: number }> {
  const maxElapsedInMs = Math.max(params.elapsedInMs, 1)
  const finalMultiplier = Math.max(
    params.round.crashPoint ?? multiplierFromRoundCurve(params.round.curve, maxElapsedInMs),
    2,
  )
  const points: Array<{ x: number; y: number }> = []

  for (let index = 0; index <= params.steps; index += 1) {
    const ratio = index / params.steps
    const elapsedInMs = ratio * maxElapsedInMs
    const curveMultiplier = multiplierFromRoundCurve(params.round.curve, elapsedInMs)
    const yValue =
      params.round.status === "CRASHED" || params.round.status === "SETTLED"
        ? Math.min(curveMultiplier, params.round.crashPoint ?? curveMultiplier)
        : curveMultiplier
    const normalizedY =
      finalMultiplier === 1 ? 0 : (yValue - 1) / (finalMultiplier - 1)

    points.push({
      x: params.padding + ratio * params.width,
      y: params.height + params.padding - normalizedY * params.height,
    })
  }

  return points
}
