import { config } from "./config";
import { countKlines, get24hStats, getRecentKlines, type Stats24h } from "./repositories/klines";
import { getAllStatus, getEventCountSince, getRecentEvents } from "./repositories/pipeline";
import { getSystemMetrics } from "./repositories/system";
import type { DashboardSnapshot, Kline, MarketMetrics, PipelineStatusView } from "./types";

const WINDOW_24H_MS = 24 * 60 * 60 * 1000;
const VOL_CANDLES = 60; // volatility lookback (recent candles), interval-agnostic
const SERIES_POINTS = 240; // chart points (interval-agnostic)
const SNAPSHOT_CACHE_MS = 900; // reuse one computed snapshot within this window

/** Sample standard deviation of an array. */
export function stddev(values: number[]): number | null {
  if (values.length < 2) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/** Stddev of log returns over the given closes (recent short-term volatility). */
export function volatilityOf(closes: number[]): number | null {
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const prev = closes[i - 1];
    const cur = closes[i];
    if (prev > 0 && cur > 0) returns.push(Math.log(cur / prev));
  }
  return stddev(returns);
}

const EMPTY_METRICS = (symbol: string): MarketMetrics => ({
  symbol,
  lastPrice: null,
  changePct24h: null,
  volume24h: null,
  volatility: null,
  vwap24h: null,
  high24h: null,
  low24h: null,
  bid: null,
  ask: null,
  spreadPct: null,
  lastCandle: null,
});

/**
 * Pure assembly of market metrics from a SQL 24h rollup + a small recent tail.
 * Independent of interval and of total row count — cheap even at 1s granularity.
 */
export function assembleMarketMetrics(
  symbol: string,
  stats: Stats24h,
  tail: Kline[],
): MarketMetrics {
  if (tail.length === 0) return EMPTY_METRICS(symbol);

  const last = tail[tail.length - 1];
  const lastPrice = last.close;
  const changePct24h =
    stats.firstOpen != null && stats.firstOpen > 0
      ? ((lastPrice - stats.firstOpen) / stats.firstOpen) * 100
      : null;

  return {
    symbol,
    lastPrice,
    changePct24h,
    volume24h: stats.volume,
    volatility: volatilityOf(tail.map((k) => k.close)),
    vwap24h: stats.volume > 0 ? stats.quoteVolume / stats.volume : null,
    high24h: stats.high,
    low24h: stats.low,
    bid: null,
    ask: null,
    spreadPct: null,
    lastCandle: last,
  };
}

/** Fetch + compute a symbol's market metrics using SQL aggregates (interval-safe). */
export function computeMarketMetrics(symbol: string): MarketMetrics {
  const interval = config.KLINE_INTERVAL;
  const stats = get24hStats(symbol, interval, Date.now() - WINDOW_24H_MS);
  const tail = getRecentKlines(symbol, interval, VOL_CANDLES + 1);
  return assembleMarketMetrics(symbol, stats, tail);
}

/** Build the full dashboard snapshot (status + market + system + series + events). */
export function buildSnapshot(seriesPoints = SERIES_POINTS, eventLimit = 20): DashboardSnapshot {
  const now = Date.now();
  const interval = config.KLINE_INTERVAL;
  const statuses = getAllStatus();

  const status: PipelineStatusView[] = statuses.map((s) => {
    const lagMs =
      s.lastKlineOpenTime !== null ? now - (s.lastKlineOpenTime + config.intervalMs) : null;
    const gapRecoveryRate = s.gapsDetected > 0 ? (s.gapsFilled / s.gapsDetected) * 100 : 100;
    return {
      ...s,
      lagMs,
      totalRecords: countKlines(s.symbol, interval),
      gapRecoveryRate,
    };
  });

  const statusBySymbol = new Map(status.map((s) => [s.symbol, s]));
  const market: MarketMetrics[] = [];
  const series: Record<string, { t: number; close: number; volume: number }[]> = {};

  for (const symbol of config.symbols) {
    const m = computeMarketMetrics(symbol);
    const st = statusBySymbol.get(symbol);
    if (st) {
      m.bid = st.bestBid;
      m.ask = st.bestAsk;
      m.spreadPct =
        st.bestBid != null && st.bestAsk != null && st.bestBid > 0
          ? ((st.bestAsk - st.bestBid) / st.bestBid) * 100
          : null;
    }
    market.push(m);

    const recent: Kline[] = getRecentKlines(symbol, interval, seriesPoints);
    series[symbol] = recent.map((k) => ({ t: k.openTime, close: k.close, volume: k.volume }));
  }

  const system = {
    ...getSystemMetrics(),
    errorsLastMin: getEventCountSince(["error"], now - 60_000),
  };

  return { ts: now, interval, status, market, series, events: getRecentEvents(eventLimit), system };
}

// Shared, time-boxed snapshot cache: many SSE clients (tabs) share one compute
// per ~second, so per-second cost is independent of how many pages are open.
let cache: { ts: number; snap: DashboardSnapshot } | null = null;

export function getSnapshot(): DashboardSnapshot {
  const now = Date.now();
  if (cache && now - cache.ts < SNAPSHOT_CACHE_MS) return cache.snap;
  const snap = buildSnapshot();
  cache = { ts: now, snap };
  return snap;
}
