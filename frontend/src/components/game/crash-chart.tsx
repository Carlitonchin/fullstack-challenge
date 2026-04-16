import { useEffect, useRef, useCallback, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { truncateHash, formatMultiplier } from "@/lib/format"
import type { Round } from "@/lib/api"

interface CrashChartProps {
  round: Round | undefined
  isLoading: boolean
}

/**
 * Renders the crash multiplier curve on a <canvas>.
 * The curve anchors to server state (round.multiplier) and interpolates
 * locally for smooth animation — when real WS is wired in, the server
 * tick will replace the local RAF loop.
 */
export function CrashChart({ round, isLoading }: CrashChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const animationRef = useRef<number>(0)

  // Local multiplier for smooth client-side interpolation
  const [displayMultiplier, setDisplayMultiplier] = useState(1.0)
  const startTimeRef = useRef<number>(Date.now())

  // Countdown state for betting phase
  const [countdown, setCountdown] = useState<number | null>(null)

  // Track round status for animation
  useEffect(() => {
    if (round?.status === "RUNNING") {
      startTimeRef.current = Date.now()
    }
    if (round?.status === "BETTING" || round?.status === "WAITING") {
      setDisplayMultiplier(1.0)
    }
  }, [round?.status])

  // Countdown ticker for betting phase
  useEffect(() => {
    if (round?.status !== "BETTING" || !round.bettingEndsAt) {
      setCountdown(null)
      return
    }

    const tick = () => {
      const remaining = Math.max(
        0,
        Math.ceil((new Date(round.bettingEndsAt!).getTime() - Date.now()) / 1000)
      )
      setCountdown(remaining)
    }

    tick()
    const interval = setInterval(tick, 100)
    return () => clearInterval(interval)
  }, [round?.status, round?.bettingEndsAt])

  // Simulated multiplier growth for the RUNNING phase
  useEffect(() => {
    if (round?.status !== "RUNNING") return

    const tick = () => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000
      // Exponential curve: 1.0 * e^(0.06t) — mimics a realistic crash curve
      const nextMultiplier = Math.exp(0.06 * elapsed)
      setDisplayMultiplier(nextMultiplier)
      animationRef.current = requestAnimationFrame(tick)
    }

    animationRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animationRef.current)
  }, [round?.status])

  // Canvas drawing
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const dpr = window.devicePixelRatio || 1
    const rect = container.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.scale(dpr, dpr)
    const w = rect.width
    const h = rect.height

    // Clear
    ctx.clearRect(0, 0, w, h)

    // Grid lines
    const gridColor = "rgba(255, 255, 255, 0.04)"
    ctx.strokeStyle = gridColor
    ctx.lineWidth = 1

    const gridSpacingX = 60
    const gridSpacingY = 40

    for (let x = gridSpacingX; x < w; x += gridSpacingX) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, h)
      ctx.stroke()
    }
    for (let y = gridSpacingY; y < h; y += gridSpacingY) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(w, y)
      ctx.stroke()
    }

    if (round?.status === "RUNNING" || round?.status === "CRASHED") {
      const multiplier = round.status === "CRASHED"
        ? (round.crashPoint ?? displayMultiplier)
        : displayMultiplier

      // Curve parameters
      const padding = 40
      const curveW = w - padding * 2
      const curveH = h - padding * 2

      // Y scale: normalize the multiplier range (1.0 to current)
      const maxY = Math.max(multiplier, 2.0)
      const steps = 200

      // Determine color based on multiplier
      const isCrashed = round.status === "CRASHED"
      let curveColor: string

      if (isCrashed) {
        curveColor = "oklch(0.704 0.191 22.216)" // destructive red
      } else if (multiplier >= 5) {
        curveColor = "oklch(0.768 0.233 130.85)" // primary green — high
      } else if (multiplier >= 2) {
        curveColor = "oklch(0.897 0.196 126.665)" // chart-1 lime
      } else {
        curveColor = "oklch(0.768 0.233 130.85)" // primary green
      }

      // Draw the gradient fill under curve
      const gradient = ctx.createLinearGradient(0, h, 0, 0)
      gradient.addColorStop(0, "transparent")
      gradient.addColorStop(1, isCrashed ? "rgba(239, 68, 68, 0.08)" : "rgba(132, 204, 22, 0.08)")

      ctx.beginPath()
      ctx.moveTo(padding, h - padding)

      for (let i = 0; i <= steps; i++) {
        const t = i / steps
        const x = padding + t * curveW
        // Exponential curve shape
        const yVal = Math.exp(Math.log(maxY) * t)
        const yNorm = (yVal - 1) / (maxY - 1)
        const y = h - padding - yNorm * curveH
        ctx.lineTo(x, y)
      }

      ctx.lineTo(padding + curveW, h - padding)
      ctx.closePath()
      ctx.fillStyle = gradient
      ctx.fill()

      // Draw the curve line
      ctx.beginPath()
      ctx.moveTo(padding, h - padding)

      for (let i = 0; i <= steps; i++) {
        const t = i / steps
        const x = padding + t * curveW
        const yVal = Math.exp(Math.log(maxY) * t)
        const yNorm = (yVal - 1) / (maxY - 1)
        const y = h - padding - yNorm * curveH
        ctx.lineTo(x, y)
      }

      ctx.strokeStyle = curveColor
      ctx.lineWidth = 2.5
      ctx.lineCap = "round"
      ctx.lineJoin = "round"
      ctx.stroke()

      // Draw endpoint glow
      const endX = padding + curveW
      const endYVal = Math.exp(Math.log(maxY))
      const endYNorm = (endYVal - 1) / (maxY - 1)
      const endY = h - padding - endYNorm * curveH

      if (!isCrashed) {
        // Pulsing glow at end point
        const glowGradient = ctx.createRadialGradient(endX, endY, 0, endX, endY, 12)
        glowGradient.addColorStop(0, curveColor)
        glowGradient.addColorStop(1, "transparent")
        ctx.fillStyle = glowGradient
        ctx.beginPath()
        ctx.arc(endX, endY, 12, 0, Math.PI * 2)
        ctx.fill()

        // Solid dot
        ctx.fillStyle = curveColor
        ctx.beginPath()
        ctx.arc(endX, endY, 4, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }, [round?.status, round?.crashPoint, displayMultiplier])

  // Animation loop for canvas
  useEffect(() => {
    let rafId: number

    const loop = () => {
      draw()
      rafId = requestAnimationFrame(loop)
    }

    rafId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafId)
  }, [draw])

  if (isLoading) {
    return (
      <Card className="col-span-full">
        <CardContent className="flex items-center justify-center" style={{ minHeight: 340 }}>
          <Skeleton className="h-60 w-full rounded-lg" />
        </CardContent>
      </Card>
    )
  }

  const isBetting = round?.status === "BETTING"
  const isRunning = round?.status === "RUNNING"
  const isCrashed = round?.status === "CRASHED"
  const isWaiting = round?.status === "WAITING"

  return (
    <Card className="relative col-span-full overflow-hidden">
      {/* Hash seed bar */}
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-2">
        <div className="flex items-center gap-2">
          <div className="size-1.5 rounded-full bg-primary/60 animate-pulse" />
          <span className="text-[10px] tracking-widest uppercase text-muted-foreground">
            Round #{round?.id.split("_")[1] ?? "—"}
          </span>
        </div>
        {round?.hashSeed && (
          <code className="text-[10px] text-muted-foreground/60 font-mono">
            SHA256: {truncateHash(round.hashSeed, 8)}
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

          {/* Center overlay — multiplier or status */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
            {isBetting && (
              <>
                <Badge variant="outline" className="text-xs animate-pulse">
                  Accepting bets
                </Badge>
                <span className="text-5xl font-heading font-bold tracking-tighter text-foreground tabular-nums">
                  {countdown !== null ? `${countdown}s` : "—"}
                </span>
                <span className="text-xs text-muted-foreground uppercase tracking-widest">
                  Place your bet
                </span>
              </>
            )}

            {isRunning && (
              <span
                className={`text-6xl font-heading font-bold tracking-tighter tabular-nums transition-colors duration-200 ${
                  displayMultiplier >= 5
                    ? "text-primary drop-shadow-[0_0_24px_oklch(0.768_0.233_130.85/0.5)]"
                    : displayMultiplier >= 2
                      ? "text-chart-1"
                      : "text-foreground"
                }`}
              >
                {formatMultiplier(displayMultiplier)}
              </span>
            )}

            {isCrashed && (
              <>
                <Badge variant="destructive" className="text-xs mb-1">
                  Crashed
                </Badge>
                <span className="text-6xl font-heading font-bold tracking-tighter tabular-nums text-destructive">
                  {formatMultiplier(round?.crashPoint ?? 0)}
                </span>
              </>
            )}

            {isWaiting && (
              <span className="text-lg text-muted-foreground uppercase tracking-widest">
                Starting…
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
