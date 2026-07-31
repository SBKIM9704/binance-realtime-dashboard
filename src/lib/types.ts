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

/** Derived market metrics for a symbol, computed from stored klines. */
export interface MarketMetrics {
  symbol: string;
  lastPrice: number | null;
  changePct24h: number | null;
  volume24h: number | null;
  volatility: number | null;
  lastCandle: Kline | null;
}

/** Payload pushed over SSE / returned by /api/health. */
export interface DashboardSnapshot {
  ts: number;
  status: (PipelineStatus & { lagMs: number | null; totalRecords: number })[];
  market: MarketMetrics[];
  series: Record<string, { t: number; close: number; volume: number }[]>;
  events: PipelineEvent[];
}
