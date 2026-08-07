/** A single OHLCV candle as stored in SQLite. Times are epoch milliseconds. */
export interface Kline {
  symbol: string;
  interval: string;
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
  quoteVolume: number;
  trades: number;
  takerBuyBase: number;
  takerBuyQuote: number;
  /** 1 if the candle is closed/final, 0 if it is the still-forming current candle. */
  isFinal: number;
}

/** Current snapshot of a symbol's collection pipeline. */
export interface PipelineStatus {
  symbol: string;
  wsConnected: number;
  lastMessageAt: number | null;
  lastKlineOpenTime: number | null;
  backfilledCount: number;
  gapsDetected: number;
  gapsFilled: number;
  reconcileLastRun: number | null;
  /** When the collector last wrote this row — its heartbeat. */
  updatedAt: number;
  wsMsgRate: number;
  reconnectCount: number;
  bestBid: number | null;
  bestAsk: number | null;
  tickerUpdatedAt: number | null;
}

/** Collector process + REST usage snapshot (single row). */
export interface SystemMetrics {
  cpuPct: number;
  rssBytes: number;
  uptimeSec: number;
  restCallsTotal: number;
  restCallsRate: number;
  restRetryCount: number;
  rateLimitedCount: number;
  serverErrorCount: number;
  usedWeight: number;
  weightLimit: number;
  updatedAt: number;
}

export type PipelineEventType =
  | "ws_connect"
  | "ws_disconnect"
  | "backfill_start"
  | "backfill_done"
  | "gap_filled"
  | "error";

export interface PipelineEvent {
  id?: number;
  ts: number;
  symbol: string;
  type: PipelineEventType;
  detail: string;
  count: number;
}

/** Which tier a backfill is filling: the collected interval, or a coarse history tier. */
export type BackfillKind = "live" | "history";

export type BackfillPhase = "pending" | "running" | "done";

/**
 * Progress of one REST backfill range, one per (symbol, interval).
 *
 * Backfill is the longest opaque stretch of a cold start — a day of 1s candles is
 * 87 paginated REST calls per symbol — so the collector records where it is as it
 * goes. It lives in SQLite rather than in the collector's memory because the row
 * outlives the async call that is filling it: the console renderer paints on its
 * own timer, and reads the table rather than being threaded through every fill.
 */
export interface BackfillTask {
  symbol: string;
  interval: string;
  kind: BackfillKind;
  phase: BackfillPhase;
  /** Why this fill started: first-run, restart-gap, extend-back, catch-up. */
  reason: string;
  /** The window being filled, epoch ms. Both 0 while the task is still pending. */
  rangeStart: number;
  rangeEnd: number;
  /** Open time of the last candle fetched — the position inside the window. */
  cursorTime: number;
  written: number;
  pages: number;
  startedAt: number;
  updatedAt: number;
}

/** Derived market metrics for a symbol. Kline-derived + live ticker fields. */
export interface MarketMetrics {
  symbol: string;
  lastPrice: number | null;
  changePct24h: number | null;
  volume24h: number | null;
  volatility: number | null;
  vwap24h: number | null;
  high24h: number | null;
  low24h: number | null;
  bid: number | null;
  ask: number | null;
  spreadPct: number | null;
  lastCandle: Kline | null;
  /**
   * Which stored interval the 24h figures and volatility were aggregated from.
   * Shown to the reader, because a figure's provenance is part of the figure here.
   */
  source?: string;
}

/** Per-symbol pipeline status augmented with derived fields for the dashboard. */
export type PipelineStatusView = PipelineStatus & {
  lagMs: number | null;
  /** Rows across every stored interval. */
  totalRecords: number;
  /** Rows at the collected (live) interval only. */
  liveRecords: number;
  gapRecoveryRate: number | null;
};

/** One chart candle — OHLCV keyed by open time, at whatever interval produced it. */
export interface Candle {
  t: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** A single sparkline sample: the closing price at a point in time. */
export type SparkPoint = Pick<Candle, "t" | "close">;

/**
 * Payload pushed over SSE / returned by /api/health.
 *
 * `series` stays deliberately thin (it ships every second, to every open tab) and
 * only feeds the card sparklines. The chart pulls full OHLC from /api/candles.
 */
export interface DashboardSnapshot {
  ts: number;
  interval: string;
  /** Collected symbols, in configured order — the roster both views tab through. */
  symbols: string[];
  status: PipelineStatusView[];
  market: MarketMetrics[];
  series: Record<string, SparkPoint[]>;
  events: PipelineEvent[];
  system: SystemMetrics & { errorsLastMin: number };
}
