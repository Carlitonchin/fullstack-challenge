import type { Round, RoundCurve } from "@/lib/api"

export function multiplierFromRoundCurve(
  curve: RoundCurve,
  elapsedInMs: number,
): number {
  const elapsed = Math.max(0, elapsedInMs)
  const multiplier =
    curve.baseMultiplier * Math.exp(curve.growthRate * elapsed)

  if (!Number.isFinite(multiplier)) {
    return curve.baseMultiplier
  }

  return Number(
    Math.max(curve.baseMultiplier, multiplier).toFixed(curve.precisionDigits),
  )
}

export function getRoundElapsedInMs(round: Round, now: number): number | null {
  if (!round.startedAt && !round.startsAt) {
    return null
  }

  const startedAt = new Date(round.startedAt ?? round.startsAt!).getTime()

  if (!Number.isFinite(startedAt)) {
    return null
  }

  return Math.max(0, now - startedAt)
}

export function getRoundDurationInMs(round: Round): number | null {
  if (!round.scheduledCrashAt || (!round.startedAt && !round.startsAt)) {
    return null
  }

  const startedAt = new Date(round.startedAt ?? round.startsAt!).getTime()
  const scheduledCrashAt = new Date(round.scheduledCrashAt).getTime()

  if (!Number.isFinite(startedAt) || !Number.isFinite(scheduledCrashAt)) {
    return null
  }

  return Math.max(0, scheduledCrashAt - startedAt)
}

export function resolveDisplayedRoundMultiplier(
  round: Round | undefined,
  now: number,
): number {
  if (!round) {
    return 1
  }

  if (round.status === "CRASHED" || round.status === "SETTLED") {
    return round.crashPoint ?? round.currentMultiplier
  }

  if (round.status !== "IN_PROGRESS") {
    return round.currentMultiplier
  }

  const elapsedInMs = getRoundElapsedInMs(round, now)

  if (elapsedInMs === null) {
    return round.currentMultiplier
  }

  return multiplierFromRoundCurve(round.curve, elapsedInMs)
}
