import { describe, expect, it } from "vitest";
import { deriveMarketMetrics } from "./metrics";
import type { Kline } from "./types";

/** Build a minimal kline; only OHLCV fields matter for the metrics under test. */
function makeKline(i: number, o: number, c: number, v: number): Kline {
  const openTime = i * 60_000;
  return {
    symbol: "BTCUSDT",
    interval: "1m",
    openTime,
    open: o,
    high: Math.max(o, c),
    low: Math.min(o, c),
    close: c,
    volume: v,
    closeTime: openTime + 59_999,
    quoteVolume: 0,
    trades: 0,
    takerBuyBase: 0,
    takerBuyQuote: 0,
    isFinal: 1,
  };
}

describe("deriveMarketMetrics", () => {
  it("returns nulls for an empty series", () => {
    const m = deriveMarketMetrics("BTCUSDT", []);
    expect(m).toEqual({
      symbol: "BTCUSDT",
      lastPrice: null,
      changePct24h: null,
      volume24h: null,
      volatility: null,
      lastCandle: null,
    });
  });

  it("computes last price, 24h change and total volume", () => {
    const klines = [
      makeKline(0, 100, 110, 5),
      makeKline(1, 110, 115, 3),
      makeKline(2, 115, 121, 2),
    ];
    const m = deriveMarketMetrics("BTCUSDT", klines);
    expect(m.lastPrice).toBe(121);
    // (121 - first.open 100) / 100 * 100
    expect(m.changePct24h).toBeCloseTo(21, 6);
    expect(m.volume24h).toBe(10);
    expect(m.lastCandle?.openTime).toBe(2 * 60_000);
  });

  it("computes zero volatility for a constant-growth series (equal log returns)", () => {
    // closes 100 → 110 → 121: ln(110/100) == ln(121/110), so stddev of returns is 0
    const klines = [
      makeKline(0, 100, 100, 1),
      makeKline(1, 100, 110, 1),
      makeKline(2, 110, 121, 1),
    ];
    const m = deriveMarketMetrics("BTCUSDT", klines);
    expect(m.volatility).toBeCloseTo(0, 10);
  });

  it("returns null volatility when there are too few points", () => {
    const m = deriveMarketMetrics("BTCUSDT", [makeKline(0, 100, 105, 1)]);
    expect(m.lastPrice).toBe(105);
    expect(m.changePct24h).toBeCloseTo(5, 6);
    expect(m.volatility).toBeNull();
  });

  it("guards against divide-by-zero when the opening price is 0", () => {
    const m = deriveMarketMetrics("BTCUSDT", [makeKline(0, 0, 105, 1)]);
    expect(m.changePct24h).toBeNull();
  });
});
