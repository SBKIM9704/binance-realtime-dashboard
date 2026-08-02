import { describe, expect, it } from "vitest";
import { pickSourceInterval, type TierStats } from "./source-interval";

const STORED = ["1s", "1m", "1h"];
const SEC = 1_000;
const MIN = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;
const now = 1_800_000_000_000;

/** A tier reaching `days` back and complete over the whole window. */
function dense(intervalMs: number, days: number): TierStats {
  return { from: now - days * DAY, rows: Math.floor((days * DAY) / intervalMs) };
}

/** The default tier layout: 1s kept 7 days, 1m kept 30, 1h since listing. */
const stats = new Map<string, TierStats>([
  ["1s", dense(SEC, 7)],
  ["1m", dense(MIN, 30)],
  ["1h", dense(HOUR, 3200)],
]);

const pick = (bucketMs: number, rangeStart: number | null, s = stats) =>
  pickSourceInterval(STORED, s, bucketMs, rangeStart, now);

describe("pickSourceInterval", () => {
  it("prefers the finest tier that covers the range", () => {
    expect(pick(15 * SEC, now - HOUR)).toBe("1s");
  });

  it("steps down a tier when the range outruns the finer one", () => {
    expect(pick(HOUR, now - 30 * DAY)).toBe("1m");
  });

  it("uses the deepest tier for an unbounded range", () => {
    expect(pick(7 * DAY, null)).toBe("1h");
  });

  it("never picks a source that does not divide the bucket evenly", () => {
    // 1h does not divide a 90-minute bucket; 1m does.
    expect(pick(90 * MIN, now - 30 * DAY)).toBe("1m");
  });

  it("never picks a source coarser than the bucket", () => {
    expect(pick(SEC, now - HOUR)).toBe("1s");
  });

  it("falls back to the deepest tier when nothing reaches the requested start", () => {
    expect(pick(HOUR, now - 5000 * DAY)).toBe("1h");
  });

  it("ignores intervals with no stored data", () => {
    expect(pick(HOUR, now - DAY, new Map([["1h", dense(HOUR, 100)]]))).toBe("1h");
  });

  it("returns null when no stored interval can serve the bucket", () => {
    expect(pick(MIN, now - DAY, new Map([["1h", dense(HOUR, 100)]]))).toBeNull();
  });

  it("skips a tier that reaches back far enough but is full of holes", () => {
    // The real case: the collector was down for half of the last day, so the 1s
    // tier starts early enough yet only holds 56% of the seconds in range.
    const gappy = new Map(stats);
    gappy.set("1s", { from: now - 7 * DAY, rows: Math.floor((DAY / SEC) * 0.56) });
    expect(pickSourceInterval(STORED, gappy, 5 * MIN, now - DAY, now)).toBe("1m");
  });

  it("still uses a sparse tier when no denser one can serve the bucket", () => {
    const gappy = new Map([["1s", { from: now - 7 * DAY, rows: 100 }]]);
    expect(pickSourceInterval(STORED, gappy, 5 * SEC, now - DAY, now)).toBe("1s");
  });
});
