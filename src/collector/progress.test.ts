import { describe, expect, it } from "vitest";
import type { BackfillTask } from "../lib/types";
import { bar, renderProgress } from "./progress";

const HOUR = 60 * 60 * 1000;
const NOW = 1_700_000_000_000;

/** Colour is a terminal detail; the tests care about the text under it. */
const plain = (s: string) => s.replace(/\u001b\[[0-9;]*m/g, "");

function task(patch: Partial<BackfillTask> = {}): BackfillTask {
  return {
    symbol: "BTCUSDT",
    interval: "1s",
    kind: "live",
    phase: "running",
    reason: "first-run",
    rangeStart: NOW - 24 * HOUR,
    rangeEnd: NOW,
    cursorTime: NOW - 12 * HOUR,
    written: 43_200,
    pages: 44,
    startedAt: NOW,
    updatedAt: NOW,
    ...patch,
  };
}

describe("bar", () => {
  it("is empty at 0 and full at 100", () => {
    expect(bar(0, 8)).toBe("░░░░░░░░");
    expect(bar(100, 8)).toBe("████████");
  });

  it("fills proportionally", () => {
    expect(bar(50, 8)).toBe("████░░░░");
  });

  it("clamps out-of-range input instead of drawing a wider bar", () => {
    expect(bar(140, 8)).toHaveLength(8);
    expect(bar(-20, 8)).toBe("░░░░░░░░");
  });
});

describe("renderProgress", () => {
  it("draws nothing when there is no plan yet", () => {
    expect(renderProgress([], 0)).toEqual([]);
  });

  it("draws one line per task plus a summary line", () => {
    const lines = renderProgress([task(), task({ symbol: "ETHUSDT" })], 5_000);
    expect(lines).toHaveLength(3);
    expect(plain(lines[0])).toContain("BTCUSDT");
    expect(plain(lines[1])).toContain("ETHUSDT");
    expect(plain(lines[2])).toContain("elapsed 5.0s");
  });

  it("labels each task with its interval and shows its percentage", () => {
    const [line] = renderProgress([task()], 0);
    expect(plain(line)).toContain("1s  BTCUSDT");
    expect(plain(line)).toContain("50%");
  });

  it("says a queued task is waiting rather than showing it as 0% stalled", () => {
    const [line] = renderProgress([task({ phase: "pending", rangeStart: 0, rangeEnd: 0 })], 0);
    expect(plain(line)).toContain("waiting");
  });

  it("reports what landed once a task is done, and drops the pages-to-go note", () => {
    const lines = renderProgress([task({ phase: "done" })], 12_340);
    expect(plain(lines[0])).toContain("100%");
    expect(plain(lines[0])).toContain("43,200 candles");
    expect(plain(lines[1])).toBe("              elapsed 12.3s");
  });

  it("calls an empty finished fill up to date rather than showing zero candles", () => {
    const [line] = renderProgress([task({ phase: "done", written: 0 })], 0);
    expect(plain(line)).toContain("up to date");
  });

  it("counts the pages still to fetch across every unfinished task", () => {
    const lines = renderProgress([task(), task({ symbol: "ETHUSDT" })], 0);
    // 12h of 1s candles is 43,200 → 44 pages, and both symbols are half done.
    expect(plain(lines[2])).toContain("88 page(s) to go");
  });

  it("keeps every line the same width so the block does not jitter as it redraws", () => {
    const lines = renderProgress(
      [task(), task({ symbol: "ETHUSDT", interval: "1h", kind: "history", written: 8 })],
      0,
    );
    const widths = new Set(lines.slice(0, -1).map((l) => plain(l).indexOf("%")));
    expect(widths.size).toBe(1);
  });
});
