import { config } from "./config";
import { countKlines, getRecentKlines } from "./repositories/klines";
import { getAllStatus, getEventCountSince, getRecentEvents } from "./repositories/pipeline";
import { getSystemMetrics } from "./repositories/system";
import type { DashboardSnapshot, Kline, MarketMetrics, PipelineStatusView } from "./types";

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

/** Fetch a symbol's recent klines from storage and compute its market metrics. */
export function computeMarketMetrics(symbol: string): MarketMetrics {
  const klines = getRecentKlines(symbol, config.KLINE_INTERVAL, MINUTES_24H);
  return deriveMarketMetrics(symbol, klines);
}

/**
 * Pure market-metric derivation from an ascending (oldest→newest) kline array.
 * Live ticker fields (bid/ask/spread) are merged separately in buildSnapshot.
 */
export function deriveMarketMetrics(symbol: string, klines: Kline[]): MarketMetrics {
  if (klines.length === 0) return EMPTY_METRICS(symbol);

  const last = klines[klines.length - 1];
  const lastPrice = last.close;

  const first = klines[0];
  const changePct24h =
    first.open > 0 ? ((lastPrice - first.open) / first.open) * 100 : null;

  let volume24h = 0;
  let quoteVolume24h = 0;
  let high24h = klines[0].high;
  let low24h = klines[0].low;
  for (const k of klines) {
    volume24h += k.volume;
    quoteVolume24h += k.quoteVolume;
    if (k.high > high24h) high24h = k.high;
    if (k.low < low24h) low24h = k.low;
  }
  // VWAP proxy: quote volume (≈ price·volume) divided by base volume.
  const vwap24h = volume24h > 0 ? quoteVolume24h / volume24h : null;

  // Volatility: stddev of log returns over the most recent window.
  const window = klines.slice(-VOLATILITY_WINDOW - 1);
  const returns: number[] = [];
  for (let i = 1; i < window.length; i++) {
    const prev = window[i - 1].close;
    const cur = window[i].close;
    if (prev > 0 && cur > 0) returns.push(Math.log(cur / prev));
  }
  const volatility = stddev(returns);

  return {
    symbol,
    lastPrice,
    changePct24h,
    volume24h,
    volatility,
    vwap24h,
    high24h,
    low24h,
    bid: null,
    ask: null,
    spreadPct: null,
    lastCandle: last,
  };
}

/** Build the full dashboard snapshot (status + market + system + series + events). */
export function buildSnapshot(seriesPoints = 120, eventLimit = 20): DashboardSnapshot {
  const now = Date.now();
  const statuses = getAllStatus();

  const status: PipelineStatusView[] = statuses.map((s) => {
    const lagMs =
      s.lastKlineOpenTime !== null
        ? now - (s.lastKlineOpenTime + config.intervalMs)
        : null;
    const gapRecoveryRate =
      s.gapsDetected > 0 ? (s.gapsFilled / s.gapsDetected) * 100 : 100;
    return {
      ...s,
      lagMs,
      totalRecords: countKlines(s.symbol, config.KLINE_INTERVAL),
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

    const recent: Kline[] = getRecentKlines(symbol, config.KLINE_INTERVAL, seriesPoints);
    series[symbol] = recent.map((k) => ({ t: k.openTime, close: k.close, volume: k.volume }));
  }

  const system = {
    ...getSystemMetrics(),
    errorsLastMin: getEventCountSince(["error"], now - 60_000),
  };

  return { ts: now, status, market, series, events: getRecentEvents(eventLimit), system };
}
