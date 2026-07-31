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
  errorCount: number;
  reconcileLastRun: number | null;
  updatedAt: number;
  messageCount: number;
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
  | "reconcile"
  | "error";

export interface PipelineEvent {
  id?: number;
  ts: number;
  symbol: string;
  type: PipelineEventType;
  detail: string;
  count: number;
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
}

/** Per-symbol pipeline status augmented with derived fields for the dashboard. */
export type PipelineStatusView = PipelineStatus & {
  lagMs: number | null;
  totalRecords: number;
  gapRecoveryRate: number | null;
};

/** Payload pushed over SSE / returned by /api/health. */
export interface DashboardSnapshot {
  ts: number;
  status: PipelineStatusView[];
  market: MarketMetrics[];
  series: Record<string, { t: number; close: number; volume: number }[]>;
  events: PipelineEvent[];
  system: SystemMetrics & { errorsLastMin: number };
}
