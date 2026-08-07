import { describe, expect, it } from "vitest";
import { remainingCandles, remainingPages, summariseBackfill, taskPct } from "./backfill-progress";
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

describe("summariseBackfill", () => {
  const big = task({ cursorTime: NOW - 20 * HOUR, startedAt: NOW - 30_000 });
  const pending = task({
    symbol: "ETHUSDT",
    phase: "pending",
    rangeStart: 0,
    rangeEnd: 0,
    startedAt: 0,
  });

  it("says nothing when the collector has published no plan", () => {
    expect(summariseBackfill([])).toBeNull();
  });

  it("keeps finished fills in the list", () => {
    // A symbol that had nothing to fill must still appear, or the reader is left
    // with one bar moving and no account of the other symbol.
    const summary = summariseBackfill([big, task({ symbol: "ETHUSDT", phase: "done" })]);
    expect(summary!.tasks).toHaveLength(2);
    expect(summary!.pct).toBeCloseTo((100 / 6 + 100) / 2, 6);
  });

  it("is inactive once every fill is finished", () => {
    const summary = summariseBackfill([task({ phase: "done" })]);
    expect(summary!.active).toBe(false);
    expect(summary!.worthShowing).toBe(false);
    expect(summary!.pct).toBe(100);
  });

  it("is active but not worth showing while the plan is only pending", () => {
    const summary = summariseBackfill([pending]);
    expect(summary!.active).toBe(true);
    expect(summary!.worthShowing).toBe(false); // nothing is under way yet
  });

  it("does not announce fills too short to be worth reading", () => {
    // A reconnect gap or an hourly top-up is over before a banner can be read.
    expect(summariseBackfill([task({ cursorTime: NOW - 1_000 })])!.worthShowing).toBe(false);
  });

  it("counts the pages left across the unfinished fills only", () => {
    const summary = summariseBackfill([big, pending, task({ phase: "done" })]);
    expect(summary!.worthShowing).toBe(true);
    expect(summary!.remainingPages).toBe(72); // 20h of 1s candles; the done one adds nothing
    // The earliest real start — a pending task has no start time to average in.
    expect(summary!.startedAt).toBe(NOW - 30_000);
  });
});
