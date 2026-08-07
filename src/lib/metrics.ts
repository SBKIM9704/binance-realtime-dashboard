import { ttlMemo } from "./cache";
import { config } from "./config";
import {
  countAllKlines,
  countKlines,
  get24hStats,
  getIntervalStats,
  getRecentCloses,
  getRecentKlines,
  type Stats24h,
} from "./repositories/klines";
import { pickSourceInterval } from "./source-interval";
import { getAllStatus, getEventCountSince, getRecentEvents } from "./repositories/pipeline";
import { getSystemMetrics } from "./repositories/system";
import type {
  DashboardSnapshot,
  Kline,
  MarketMetrics,
  PipelineStatusView,
  SparkPoint,
} from "./types";

const WINDOW_24H_MS = 24 * 60 * 60 * 1000;
const VOL_CANDLES = 60; // volatility lookback (recent candles), interval-agnostic
// Sparkline samples only. The chart reads OHLC from /api/candles, so this ships just
// what a ~340px sparkline can actually draw rather than a full chart window.
const SERIES_POINTS = 60;
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

/**
 * Which stored tier to compute 24h market figures from.
 *
 * The collected 1s tier is the *operational* record: it only holds what the
 * collector was actually running for, so summing it understated 24h volume by
 * 35–60% and missed ETH's 24h low by 1.9% against Binance's published figures.
 * The coarse tiers are REST-backfilled and dense, which drops that error to 0.2%.
 * Precision is irrelevant here — every figure is an aggregate over a whole day.
 */
export function pick24hSource(symbol: string, since: number): string {
  const stats = getIntervalStats(symbol, config.storedIntervals, since);
  return pickSourceInterval(config.storedIntervals, stats, WINDOW_24H_MS, since) ??
    config.KLINE_INTERVAL;
}

/** Fetch + compute a symbol's market metrics using SQL aggregates (interval-safe). */
export function computeMarketMetrics(symbol: string): MarketMetrics {
  const since = Date.now() - WINDOW_24H_MS;
  const source = pick24hSource(symbol, since);
  const stats = get24hStats(symbol, source, since);
  // Volatility reads the same tier, so its window is `VOL_CANDLES × source` rather
  // than a minute of seconds — a far steadier estimate, and the label states it.
  const tail = getRecentKlines(symbol, source, VOL_CANDLES + 1);
  return { ...assembleMarketMetrics(symbol, stats, tail), source };
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
      // Every stored tier, not just the collected one — history tiers are real rows.
      totalRecords: countAllKlines(s.symbol),
      liveRecords: countKlines(s.symbol, interval),
      gapRecoveryRate,
    };
  });

  const statusBySymbol = new Map(status.map((s) => [s.symbol, s]));
  const market: MarketMetrics[] = [];
  const series: Record<string, SparkPoint[]> = {};

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

    series[symbol] = getRecentCloses(symbol, interval, seriesPoints);
  }

  const system = {
    ...getSystemMetrics(),
    errorsLastMin: getEventCountSince(["error"], now - 60_000),
  };

  return {
    ts: now,
    interval,
    symbols: config.symbols,
    status,
    market,
    series,
    events: getRecentEvents(eventLimit),
    system,
  };
}

/** Many SSE clients (tabs) share one compute per ~second, so cost tracks time, not tabs. */
export function getSnapshot(): DashboardSnapshot {
  return ttlMemo("snapshot", SNAPSHOT_CACHE_MS, () => buildSnapshot());
}
