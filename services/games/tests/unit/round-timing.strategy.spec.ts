import { describe, expect, it } from "bun:test";
import {
  LogarithmicRoundTimingStrategy,
  ROUND_CRASH_REVEAL_IN_MS,
  ROUND_DURATION_MAX_IN_MS,
  ROUND_DURATION_MIN_IN_MS,
  ROUND_START_DELAY_IN_MS,
} from "../../src/domain/round/round-timing.strategy";

describe("LogarithmicRoundTimingStrategy", () => {
  it("returns an instant crash duration for a 1.00x bust", () => {
    const strategy = new LogarithmicRoundTimingStrategy();

    expect(strategy.calculateDurationInMs(1)).toBe(0);
  });

  it("clamps the duration to the supported range", () => {
    const strategy = new LogarithmicRoundTimingStrategy();

    expect(strategy.calculateDurationInMs(1.01)).toBe(ROUND_DURATION_MIN_IN_MS);
    expect(strategy.calculateDurationInMs(500)).toBe(ROUND_DURATION_MAX_IN_MS);
  });

  it("interpolates the multiplier against scheduled crash time", () => {
    const strategy = new LogarithmicRoundTimingStrategy();
    const startedAt = new Date("2026-04-17T00:00:00.000Z");
    const scheduledCrashAt = new Date("2026-04-17T00:00:04.500Z");

    expect(
      strategy.multiplierAt({
        crashPoint: 3,
        startedAt,
        scheduledCrashAt,
        at: startedAt,
      }),
    ).toBe(1);

    const midwayMultiplier = strategy.multiplierAt({
      crashPoint: 3,
      startedAt,
      scheduledCrashAt,
      at: new Date("2026-04-17T00:00:02.250Z"),
    });

    expect(midwayMultiplier).toBeGreaterThan(1);
    expect(midwayMultiplier).toBeLessThan(3);
    expect(
      strategy.multiplierAt({
        crashPoint: 3,
        startedAt,
        scheduledCrashAt,
        at: new Date("2026-04-17T00:00:05.000Z"),
      }),
    ).toBe(3);
  });

  it("builds a schedule with a 30-second pause before the round starts", () => {
    const strategy = new LogarithmicRoundTimingStrategy();
    const bettingClosesAt = new Date("2026-04-17T00:00:10.000Z");

    const schedule = strategy.buildSchedule({
      bettingClosesAt,
      crashPoint: 2,
    });

    expect(schedule.startsAt.getTime() - bettingClosesAt.getTime()).toBe(
      ROUND_START_DELAY_IN_MS,
    );
    expect(
      schedule.settlesAt.getTime() - schedule.scheduledCrashAt.getTime(),
    ).toBe(ROUND_CRASH_REVEAL_IN_MS);
  });
});
