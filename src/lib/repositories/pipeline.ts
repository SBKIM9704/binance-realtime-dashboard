import { getDb } from "../db";
import type { PipelineEvent, PipelineStatus } from "../types";

interface StatusRow {
  symbol: string;
  ws_connected: number;
  last_message_at: number | null;
  last_kline_open_time: number | null;
  backfilled_count: number;
  gaps_detected: number;
  gaps_filled: number;
  error_count: number;
  reconcile_last_run: number | null;
  updated_at: number;
}

function rowToStatus(r: StatusRow): PipelineStatus {
  return {
    symbol: r.symbol,
    wsConnected: r.ws_connected,
    lastMessageAt: r.last_message_at,
    lastKlineOpenTime: r.last_kline_open_time,
    backfilledCount: r.backfilled_count,
    gapsDetected: r.gaps_detected,
    gapsFilled: r.gaps_filled,
    errorCount: r.error_count,
    reconcileLastRun: r.reconcile_last_run,
    updatedAt: r.updated_at,
  };
}

export function ensureStatus(symbol: string): void {
  getDb()
    .prepare(
      `INSERT INTO pipeline_status (symbol, updated_at)
       VALUES (?, ?) ON CONFLICT (symbol) DO NOTHING`,
    )
    .run(symbol, Date.now());
}

/** Column names allowed for patching, mapped from camelCase status fields. */
const COLUMN_MAP: Record<string, string> = {
  wsConnected: "ws_connected",
  lastMessageAt: "last_message_at",
  lastKlineOpenTime: "last_kline_open_time",
  backfilledCount: "backfilled_count",
  gapsDetected: "gaps_detected",
  gapsFilled: "gaps_filled",
  errorCount: "error_count",
  reconcileLastRun: "reconcile_last_run",
};

/** Patch selected status columns for a symbol. Always bumps updated_at. */
export function updateStatus(symbol: string, patch: Partial<Omit<PipelineStatus, "symbol">>): void {
  const sets: string[] = [];
  const params: Record<string, unknown> = { symbol, updated_at: Date.now() };
  for (const [key, value] of Object.entries(patch)) {
    const col = COLUMN_MAP[key];
    if (!col) continue;
    sets.push(`${col} = @${col}`);
    params[col] = value;
  }
  sets.push("updated_at = @updated_at");
  getDb()
    .prepare(`UPDATE pipeline_status SET ${sets.join(", ")} WHERE symbol = @symbol`)
    .run(params);
}

/** Atomically increment a counter column (e.g. gaps_filled, error_count). */
export function incrementStatus(
  symbol: string,
  column: "backfilledCount" | "gapsDetected" | "gapsFilled" | "errorCount",
  by = 1,
): void {
  const col = COLUMN_MAP[column];
  getDb()
    .prepare(
      `UPDATE pipeline_status SET ${col} = ${col} + ?, updated_at = ? WHERE symbol = ?`,
    )
    .run(by, Date.now(), symbol);
}

export function getAllStatus(): PipelineStatus[] {
  const rows = getDb()
    .prepare("SELECT * FROM pipeline_status ORDER BY symbol ASC")
    .all() as StatusRow[];
  return rows.map(rowToStatus);
}

export function addEvent(event: Omit<PipelineEvent, "id">): void {
  getDb()
    .prepare(
      `INSERT INTO pipeline_events (ts, symbol, type, detail, count)
       VALUES (@ts, @symbol, @type, @detail, @count)`,
    )
    .run(event);
}

export function getRecentEvents(limit: number): PipelineEvent[] {
  return getDb()
    .prepare("SELECT * FROM pipeline_events ORDER BY ts DESC, id DESC LIMIT ?")
    .all(limit) as PipelineEvent[];
}
