import { config } from "../lib/config";
import { getOpenTimesInRange } from "../lib/repositories/klines";
import { addEvent, incrementStatus, updateStatus } from "../lib/repositories/pipeline";
import { fetchAndStoreRange } from "./backfill";
import { log, logError } from "./logger";

/**
 * Scan the recent window for missing 1m buckets and refill them from REST.
 * This self-healing loop covers transient WS drops that the reconnect backfill
 * might miss, and guarantees data completeness independent of the live stream.
 */
export async function reconcileSymbol(symbol: string): Promise<void> {
  const interval = config.KLINE_INTERVAL;
  const step = config.intervalMs;
  const now = Date.now();

  // Only consider fully-closed buckets: the last one whose close_time <= now.
  const end = Math.floor(now / step) * step - step;
  const start = end - config.RECONCILE_WINDOW_MS;
  if (end < start) return;

  const existing = new Set(getOpenTimesInRange(symbol, interval, start, end));
  const missing: number[] = [];
  for (let t = start; t <= end; t += step) {
    if (!existing.has(t)) missing.push(t);
  }

  updateStatus(symbol, { reconcileLastRun: now });

  if (missing.length === 0) return;

  log(`[reconcile] ${symbol}: ${missing.length} missing candle(s) in window`);
  incrementStatus(symbol, "gapsDetected", missing.length);

  // Refetch the whole window (idempotent upsert). Cheaper than many tiny calls
  // and covers scattered gaps in one shot.
  const before = existing.size;
  await fetchAndStoreRange(symbol, missing[0], end);
  const after = getOpenTimesInRange(symbol, interval, start, end).length;
  const filled = Math.max(0, after - before);

  if (filled > 0) {
    incrementStatus(symbol, "gapsFilled", filled);
    addEvent({
      ts: Date.now(),
      symbol,
      type: "gap_filled",
      detail: `filled ${filled}/${missing.length} missing candle(s)`,
      count: filled,
    });
  }
  log(`[reconcile] ${symbol}: filled ${filled}/${missing.length}`);
}

/** Run one reconciliation pass across all symbols. */
export async function reconcileAll(): Promise<void> {
  for (const symbol of config.symbols) {
    try {
      await reconcileSymbol(symbol);
    } catch (err) {
      logError(`[reconcile] ${symbol} failed:`, err);
      incrementStatus(symbol, "errorCount");
      addEvent({
        ts: Date.now(),
        symbol,
        type: "error",
        detail: `reconcile: ${(err as Error).message}`,
        count: 0,
      });
    }
  }
}
