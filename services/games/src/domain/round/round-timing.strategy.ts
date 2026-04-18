export const BETTING_WINDOW_IN_SECONDS = 10;
export const ROUND_START_DELAY_IN_MS = 5_000;
export const ROUND_CRASH_REVEAL_IN_MS = 2_000;
export const ROUND_DURATION_MIN_IN_MS = 250;
export const ROUND_DURATION_MAX_IN_MS = 20_000;
export const ROUND_DURATION_LOG_SCALE = 4_500;
export const PUBLIC_ROUND_CURVE_KIND = "exponential";
export const PUBLIC_ROUND_CURVE_VERSION = 1;
export const PUBLIC_ROUND_CURVE_PRECISION_DIGITS = 4;

export type PublicRoundCurve = {
  kind: typeof PUBLIC_ROUND_CURVE_KIND;
  version: typeof PUBLIC_ROUND_CURVE_VERSION;
  baseMultiplier: number;
  growthRate: number;
  precisionDigits: typeof PUBLIC_ROUND_CURVE_PRECISION_DIGITS;
};

export type RoundTimingSchedule = {
  durationInMs: number;
  startsAt: Date;
  scheduledCrashAt: Date;
  settlesAt: Date;
};

export interface RoundTimingStrategy {
  calculateDurationInMs(crashPoint: number): number;
  buildSchedule(params: {
    bettingClosesAt: Date;
    crashPoint: number;
  }): RoundTimingSchedule;
  multiplierAt(params: {
    crashPoint: number;
    startedAt: Date;
    scheduledCrashAt: Date;
    at: Date;
  }): number;
}

export class LogarithmicRoundTimingStrategy implements RoundTimingStrategy {
  calculateDurationInMs(crashPoint: number): number {
    if (!Number.isFinite(crashPoint) || crashPoint < 1) {
      throw new Error("crashPoint must be greater than or equal to 1");
    }

    if (crashPoint === 1) {
      return 0;
    }

    const duration = Math.round(Math.log(crashPoint) * ROUND_DURATION_LOG_SCALE);

    return clamp(duration, ROUND_DURATION_MIN_IN_MS, ROUND_DURATION_MAX_IN_MS);
  }

  buildSchedule(params: {
    bettingClosesAt: Date;
    crashPoint: number;
  }): RoundTimingSchedule {
    const durationInMs = this.calculateDurationInMs(params.crashPoint);
    const startsAt = new Date(
      params.bettingClosesAt.getTime() + ROUND_START_DELAY_IN_MS,
    );
    const scheduledCrashAt = new Date(startsAt.getTime() + durationInMs);
    const settlesAt = new Date(
      scheduledCrashAt.getTime() + ROUND_CRASH_REVEAL_IN_MS,
    );

    return {
      durationInMs,
      startsAt,
      scheduledCrashAt,
      settlesAt,
    };
  }

  multiplierAt(params: {
    crashPoint: number;
    startedAt: Date;
    scheduledCrashAt: Date;
    at: Date;
  }): number {
    if (params.crashPoint === 1) {
      return 1;
    }

    const durationInMs = Math.max(
      0,
      params.scheduledCrashAt.getTime() - params.startedAt.getTime(),
    );

    if (durationInMs === 0) {
      return params.crashPoint;
    }

    const curve = buildPublicRoundCurve({
      crashPoint: params.crashPoint,
      startedAt: params.startedAt,
      scheduledCrashAt: params.scheduledCrashAt,
    });
    const elapsedInMs = clamp(
      params.at.getTime() - params.startedAt.getTime(),
      0,
      durationInMs,
    );
    const multiplier = multiplierFromPublicRoundCurve({
      curve,
      elapsedInMs,
    });

    return clampMultiplier(multiplier, params.crashPoint);
  }
}

export function buildPublicRoundCurve(params: {
  crashPoint: number;
  startedAt: Date;
  scheduledCrashAt: Date;
}): PublicRoundCurve {
  const durationInMs = Math.max(
    0,
    params.scheduledCrashAt.getTime() - params.startedAt.getTime(),
  );
  const growthRate =
    params.crashPoint <= 1 || durationInMs === 0
      ? 0
      : Math.log(params.crashPoint) / durationInMs;

  return {
    kind: PUBLIC_ROUND_CURVE_KIND,
    version: PUBLIC_ROUND_CURVE_VERSION,
    baseMultiplier: 1,
    growthRate,
    precisionDigits: PUBLIC_ROUND_CURVE_PRECISION_DIGITS,
  };
}

export function multiplierFromPublicRoundCurve(params: {
  curve: PublicRoundCurve;
  elapsedInMs: number;
}): number {
  const elapsedInMs = Math.max(0, params.elapsedInMs);
  const multiplier =
    params.curve.baseMultiplier *
    Math.exp(params.curve.growthRate * elapsedInMs);

  return roundMultiplier(multiplier, params.curve.precisionDigits);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function roundMultiplier(multiplier: number, precisionDigits: number): number {
  if (!Number.isFinite(multiplier)) {
    return 1;
  }

  if (multiplier < 1) {
    return 1;
  }

  return Number(multiplier.toFixed(precisionDigits));
}

function clampMultiplier(multiplier: number, crashPoint: number): number {
  if (!Number.isFinite(multiplier)) {
    return crashPoint;
  }

  if (multiplier < 1) {
    return 1;
  }

  if (multiplier > crashPoint) {
    return crashPoint;
  }

  return Number(multiplier.toFixed(4));
}
