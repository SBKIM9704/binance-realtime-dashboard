import { describe, expect, it } from "vitest";
import { assembleMarketMetrics, stddev, volatilityOf } from "./metrics";
import type { Stats24h } from "./repositories/klines";
import type { Kline } from "./types";

function makeKline(i: number, close: number): Kline {
  const openTime = i * 1000;
  return {
    symbol: "BTCUSDT",
    interval: "1s",
    openTime,
    open: close,
    high: close,
    low: close,
    close,
    volume: 1,
    closeTime: openTime + 999,
    quoteVolume: close,
    trades: 0,
    takerBuyBase: 0,
    takerBuyQuote: 0,
    isFinal: 1,
  };
}

describe("stddev", () => {
  it("returns null for fewer than 2 values", () => {
    expect(stddev([])).toBeNull();
    expect(stddev([5])).toBeNull();
  });
  it("computes sample standard deviation", () => {
    expect(stddev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138, 3);
  });
});

describe("volatilityOf", () => {
  it("is zero for constant-ratio growth (equal log returns)", () => {
    expect(volatilityOf([100, 110, 121])).toBeCloseTo(0, 10);
  });
  it("is null with too few points", () => {
    expect(volatilityOf([100])).toBeNull();
  });
});

describe("assembleMarketMetrics", () => {
  const stats: Stats24h = {
    firstOpen: 100,
    high: 121,
    low: 100,
    volume: 10,
    quoteVolume: 1137,
    count: 3,
  };

  it("returns nulls for an empty tail", () => {
    const m = assembleMarketMetrics("BTCUSDT", { ...stats, count: 0 }, []);
    expect(m.lastPrice).toBeNull();
    expect(m.high24h).toBeNull();
    expect(m.vwap24h).toBeNull();
    expect(m.lastCandle).toBeNull();
  });

  it("merges SQL 24h stats with the recent tail", () => {
    const tail = [makeKline(0, 110), makeKline(1, 115), makeKline(2, 121)];
    const m = assembleMarketMetrics("BTCUSDT", stats, tail);
    expect(m.lastPrice).toBe(121);
    expect(m.changePct24h).toBeCloseTo(21, 6); // (121 - 100) / 100 * 100
    expect(m.volume24h).toBe(10);
    expect(m.vwap24h).toBeCloseTo(113.7, 6); // 1137 / 10
    expect(m.high24h).toBe(121);
    expect(m.low24h).toBe(100);
    expect(m.volatility).not.toBeNull();
  });

  it("guards 24h change when the opening price is missing", () => {
    const tail = [makeKline(0, 105)];
    const m = assembleMarketMetrics("BTCUSDT", { ...stats, firstOpen: null }, tail);
    expect(m.changePct24h).toBeNull();
  });
});
