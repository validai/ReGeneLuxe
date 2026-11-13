import { describe, expect, it, beforeEach } from "vitest";
import {
  beginTick,
  endTick,
  getTickerHealth,
  markTickerStarted,
  resetTickerStateForTests,
} from "./jobTickerState.js";

describe("job ticker overlap protection", () => {
  beforeEach(() => {
    resetTickerStateForTests();
    markTickerStarted({ intervalMs: 15_000 });
  });

  it("skips overlapping ticks", () => {
    expect(beginTick()).toBe(true);
    expect(beginTick()).toBe(false);
    expect(getTickerHealth().skippedOverlap).toBe(1);
    endTick({ ok: true, durationMs: 10 });
    expect(beginTick()).toBe(true);
    endTick({ ok: false, error: new Error("boom sk-secret123") });
    const health = getTickerHealth();
    expect(health.lastTickOk).toBe(false);
    expect(health.lastError).toContain("boom");
    expect(health.lastError).not.toContain("sk-secret123");
    expect(health.tickCount).toBe(2);
  });
});
