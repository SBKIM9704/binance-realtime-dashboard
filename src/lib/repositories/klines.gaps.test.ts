import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { GapRange } from "./klines";

/**
 * `findGapRanges` decides what a restart refetches, so it is tested against a real
 * SQLite file rather than a stub — the window function it leans on is the part that
 * could silently stop finding holes.
 */
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "klines-gaps-"));
process.env.DB_PATH = path.join(dir, "test.db");

const STEP = 1000;
const T0 = 1_700_000_000_000; // aligned to the second

let findGapRanges: (
  symbol: string,
  interval: string,
  from: number,
  to: number,
  stepMs: number,
) => GapRange[];

/** Store candles at every `openTime` given, so the holes are the ones left out. */
let seed: (symbol: string, openTimes: number[]) => void;

beforeAll(async () => {
  const { getDb } = await import("../db");
  ({ findGapRanges } = await import("./klines"));

  const db = getDb();
  const insert = db.prepare(
    `INSERT OR REPLACE INTO klines
       (symbol, interval, open_time, open, high, low, close, volume, close_time,
        quote_volume, trades, taker_buy_base, taker_buy_quote, is_final)
     VALUES (?, '1s', ?, 1, 1, 1, 1, 1, ?, 1, 1, 1, 1, 1)`,
  );
  seed = (symbol, openTimes) => {
    const tx = db.transaction((times: number[]) => {
      for (const t of times) insert.run(symbol, t, t + STEP - 1);
    });
    tx(openTimes);
  };
});

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

/** Open times for `count` consecutive candles starting at `from`. */
const run = (from: number, count: number) =>
  Array.from({ length: count }, (_, i) => from + i * STEP);

describe("findGapRanges", () => {
  it("reports an empty window as one hole covering all of it", () => {
    expect(findGapRanges("EMPTY", "1s", T0, T0 + 9 * STEP, STEP)).toEqual([
      { start: T0, end: T0 + 9 * STEP },
    ]);
  });

  it("finds nothing when the window is complete", () => {
    seed("FULL", run(T0, 10));
    expect(findGapRanges("FULL", "1s", T0, T0 + 9 * STEP, STEP)).toEqual([]);
  });

  it("finds an interior hole and reports the missing buckets, not the stored edges", () => {
    // 5 candles, a 3-candle hole, then 2 more.
    seed("MID", [...run(T0, 5), ...run(T0 + 8 * STEP, 2)]);
    expect(findGapRanges("MID", "1s", T0, T0 + 9 * STEP, STEP)).toEqual([
      { start: T0 + 5 * STEP, end: T0 + 7 * STEP },
    ]);
  });

  it("finds a missing head and a missing tail", () => {
    seed("EDGES", run(T0 + 3 * STEP, 4));
    expect(findGapRanges("EDGES", "1s", T0, T0 + 9 * STEP, STEP)).toEqual([
      { start: T0, end: T0 + 2 * STEP },
      { start: T0 + 7 * STEP, end: T0 + 9 * STEP },
    ]);
  });

  it("finds every hole in one pass, in order", () => {
    seed("MANY", [...run(T0, 2), ...run(T0 + 4 * STEP, 1), ...run(T0 + 8 * STEP, 2)]);
    expect(findGapRanges("MANY", "1s", T0, T0 + 9 * STEP, STEP)).toEqual([
      { start: T0 + 2 * STEP, end: T0 + 3 * STEP },
      { start: T0 + 5 * STEP, end: T0 + 7 * STEP },
    ]);
  });

  it("catches the case that used to be called 'already up to date'", () => {
    // The live stream wrote the newest candle before backfill ran, and older
    // history exists — so first and last candle both look fine while days are gone.
    seed("LIVEFIRST", [...run(T0, 3), T0 + 9 * STEP]);
    expect(findGapRanges("LIVEFIRST", "1s", T0, T0 + 9 * STEP, STEP)).toEqual([
      { start: T0 + 3 * STEP, end: T0 + 8 * STEP },
    ]);
  });

  it("ignores candles outside the scanned window", () => {
    seed("BOUNDED", run(T0 - 5 * STEP, 20));
    expect(findGapRanges("BOUNDED", "1s", T0, T0 + 9 * STEP, STEP)).toEqual([]);
  });

  it("refuses a window that runs backwards or a step that cannot advance", () => {
    expect(findGapRanges("FULL", "1s", T0 + STEP, T0, STEP)).toEqual([]);
    expect(findGapRanges("FULL", "1s", T0, T0 + 9 * STEP, 0)).toEqual([]);
  });

  it("scales a coarse interval by its own step", () => {
    // A 1s grid would call every minute boundary a hole; the step is the unit.
    const minute = 60 * STEP;
    seed("COARSE", [T0, T0 + minute, T0 + 3 * minute]);
    expect(findGapRanges("COARSE", "1s", T0, T0 + 3 * minute, minute)).toEqual([
      { start: T0 + 2 * minute, end: T0 + 2 * minute },
    ]);
  });
});
