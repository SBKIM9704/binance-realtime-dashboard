import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import type { Kline } from "./types";

// config.ts reads DB_PATH at import time, so point it at a scratch DB before the
// repository (and its db singleton) is loaded.
const dbPath = path.join(os.tmpdir(), `agg-test-${process.pid}.db`);
process.env.DB_PATH = dbPath;

const { getAggregatedCandles, upsertKlines } = await import("./repositories/klines");

// Buckets are keyed to absolute epoch time, so the fixture starts on a minute boundary.
const BASE = 1_700_000_040_000;

/** A 1s candle whose OHLC is derived from `i` so assertions can be written by hand. */
function candle(i: number): Kline {
  const price = 100 + i;
  return {
    symbol: "TESTUSDT",
    interval: "1s",
    openTime: BASE + i * 1_000,
    open: price,
    high: price + 5,
    low: price - 5,
    close: price + 1,
    volume: 2,
    closeTime: BASE + i * 1_000 + 999,
    quoteVolume: 0,
    trades: 1,
    takerBuyBase: 0,
    takerBuyQuote: 0,
    isFinal: 1,
  };
}

afterAll(() => {
  for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(`${dbPath}${suffix}`, { force: true });
});

describe("getAggregatedCandles", () => {
  // 180 one-second candles = exactly three whole minutes.
  upsertKlines(Array.from({ length: 180 }, (_, i) => candle(i)));

  it("rolls 1s candles up into 1m buckets", () => {
    const out = getAggregatedCandles("TESTUSDT", "1s", 60_000, 10);

    expect(out).toHaveLength(3);
    expect(out.map((p) => p.t)).toEqual([BASE, BASE + 60_000, BASE + 120_000]);
  });

  it("takes open from the first row and close from the last row of each bucket", () => {
    const [first, , third] = getAggregatedCandles("TESTUSDT", "1s", 60_000, 10);

    expect(first.open).toBe(candle(0).open);
    expect(first.close).toBe(candle(59).close);
    expect(third.open).toBe(candle(120).open);
    expect(third.close).toBe(candle(179).close);
  });

  it("aggregates high, low and volume across the bucket", () => {
    const [first] = getAggregatedCandles("TESTUSDT", "1s", 60_000, 10);

    expect(first.high).toBe(candle(59).high); // prices rise with i
    expect(first.low).toBe(candle(0).low);
    expect(first.volume).toBe(60 * 2);
  });

  it("returns the newest `limit` buckets, oldest first", () => {
    const out = getAggregatedCandles("TESTUSDT", "1s", 60_000, 2);

    expect(out.map((p) => p.t)).toEqual([BASE + 60_000, BASE + 120_000]);
  });

  it("passes the base interval through unchanged", () => {
    const out = getAggregatedCandles("TESTUSDT", "1s", 1_000, 3);

    expect(out).toHaveLength(3);
    expect(out.at(-1)).toMatchObject({
      t: candle(179).openTime,
      open: candle(179).open,
      high: candle(179).high,
      low: candle(179).low,
      close: candle(179).close,
    });
  });

  it("leaves the trailing partial bucket in progress", () => {
    // One extra second starts a fourth minute that is only 1/60 full.
    upsertKlines([candle(180)]);
    const out = getAggregatedCandles("TESTUSDT", "1s", 60_000, 10);

    expect(out).toHaveLength(4);
    expect(out.at(-1)).toMatchObject({
      t: BASE + 180_000,
      open: candle(180).open,
      close: candle(180).close,
      volume: 2,
    });
  });
});
