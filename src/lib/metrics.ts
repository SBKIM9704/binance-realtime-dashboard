import { config } from "./config";
import { countKlines, getRecentKlines } from "./repositories/klines";
import { getAllStatus, getRecentEvents } from "./repositories/pipeline";
import type { DashboardSnapshot, Kline, MarketMetrics } from "./types";

const MINUTES_24H = 1440;
const VOLATILITY_WINDOW = 30; // minutes of returns used for volatility

/** Sample standard deviation of an array. */
function stddev(values: number[]): number | null {
  if (values.length < 2) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/** Compute derived market metrics for a symbol from its recent klines. */
export function computeMarketMetrics(symbol: string): MarketMetrics {
  const klines = getRecentKlines(symbol, config.KLINE_INTERVAL, MINUTES_24H);
  if (klines.length === 0) {
    return {
      symbol,
      lastPrice: null,
      changePct24h: null,
      volume24h: null,
      volatility: null,
      lastCandle: null,
    };
  }

  const last = klines[klines.length - 1];
  const lastPrice = last.close;

  // 24h change: compare against the oldest candle in the (up to) 1440-candle window.
  const first = klines[0];
  const changePct24h =
    first.open > 0 ? ((lastPrice - first.open) / first.open) * 100 : null;

  const volume24h = klines.reduce((sum, k) => sum + k.volume, 0);

  // Volatility: stddev of log returns over the most recent window.
  const window = klines.slice(-VOLATILITY_WINDOW - 1);
  const returns: number[] = [];
  for (let i = 1; i < window.length; i++) {
    const prev = window[i - 1].close;
    const cur = window[i].close;
    if (prev > 0 && cur > 0) returns.push(Math.log(cur / prev));
  }
  const volatility = stddev(returns);

  return { symbol, lastPrice, changePct24h, volume24h, volatility, lastCandle: last };
}

/** Build the full dashboard snapshot (status + market + chart series + events). */
export function buildSnapshot(seriesPoints = 120, eventLimit = 20): DashboardSnapshot {
  const now = Date.now();
  const statuses = getAllStatus();

  const status = statuses.map((s) => {
    const lagMs =
      s.lastKlineOpenTime !== null
        ? now - (s.lastKlineOpenTime + config.intervalMs)
        : null;
    return {
      ...s,
      lagMs,
      totalRecords: countKlines(s.symbol, config.KLINE_INTERVAL),
    };
  });

  const market: MarketMetrics[] = [];
  const series: Record<string, { t: number; close: number; volume: number }[]> = {};

  for (const symbol of config.symbols) {
    market.push(computeMarketMetrics(symbol));
    const recent: Kline[] = getRecentKlines(symbol, config.KLINE_INTERVAL, seriesPoints);
    series[symbol] = recent.map((k) => ({
      t: k.openTime,
      close: k.close,
      volume: k.volume,
    }));
  }

  return { ts: now, status, market, series, events: getRecentEvents(eventLimit) };
}
