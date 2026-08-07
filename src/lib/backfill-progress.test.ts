import { describe, expect, it } from "vitest";
import { remainingCandles, remainingPages, taskPct } from "./backfill-progress";
import type { BackfillTask } from "./types";

const HOUR = 60 * 60 * 1000;
const NOW = 1_700_000_000_000;

function task(patch: Partial<BackfillTask> = {}): BackfillTask {
  return {
    symbol: "BTCUSDT",
    interval: "1s",
    kind: "live",
    phase: "running",
    reason: "first-run",
    rangeStart: NOW - 24 * HOUR,
    rangeEnd: NOW,
    cursorTime: NOW - 24 * HOUR,
    written: 0,
    pages: 0,
    startedAt: NOW,
    updatedAt: NOW,
    ...patch,
  };
}

describe("taskPct", () => {
  it("reads 0 before the fill starts and 100 once it is done", () => {
    expect(taskPct(task({ phase: "pending", rangeStart: 0, rangeEnd: 0 }))).toBe(0);
    // Done wins over the cursor: a fill that stopped early because history ran out
    // is still finished, and must not sit at 96% forever.
    expect(taskPct(task({ phase: "done", cursorTime: NOW - HOUR }))).toBe(100);
  });

  it("measures the cursor's position in the window, not pages fetched", () => {
    expect(taskPct(task({ cursorTime: NOW - 12 * HOUR }))).toBeCloseTo(50, 6);
    expect(taskPct(task({ cursorTime: NOW - 6 * HOUR }))).toBeCloseTo(75, 6);
  });

  it("clamps a cursor that ran past the window", () => {
    expect(taskPct(task({ cursorTime: NOW + HOUR }))).toBe(100);
    expect(taskPct(task({ cursorTime: NOW - 48 * HOUR }))).toBe(0);
  });

  it("treats a zero-width window as done once the cursor reaches it", () => {
    const single = { rangeStart: NOW, rangeEnd: NOW };
    expect(taskPct(task({ ...single, cursorTime: NOW }))).toBe(100);
    expect(taskPct(task({ ...single, cursorTime: NOW - 1 }))).toBe(0);
  });
});

describe("remaining work", () => {
  it("counts the candles left at the task's own interval", () => {
    expect(remainingCandles(task({ cursorTime: NOW - 10_000 }))).toBe(10);
    expect(remainingCandles(task({ interval: "1h", cursorTime: NOW - 10 * HOUR }))).toBe(10);
  });

  it("is zero for a finished task whatever the cursor says", () => {
    expect(remainingCandles(task({ phase: "done", cursorTime: NOW - 10 * HOUR }))).toBe(0);
  });

  it("converts candles to REST pages, which is what costs time", () => {
    expect(remainingPages(task({ cursorTime: NOW - 3_000_000 }))).toBe(3); // 3000 candles
    expect(remainingPages(task({ cursorTime: NOW - 1_500 }))).toBe(1); // a partial page still costs one
  });

  it("ignores an interval it does not know", () => {
    expect(remainingCandles(task({ interval: "7s" }))).toBe(0);
  });
});
