import { fetchKlines, sleep } from "../lib/binance";
import { config } from "../lib/config";
import { getMaxOpenTime, upsertKlines } from "../lib/repositories/klines";
import { addEvent, incrementStatus, updateStatus } from "../lib/repositories/pipeline";
import { log } from "./logger";

const REST_PAGE_LIMIT = 1000;

/**
 * Fetch every closed candle in [start, end] (inclusive of start) and upsert it.
 * Paginates through the REST API 1000 candles at a time. Returns rows written.
 * Candles that are still forming (closeTime > now) are skipped — WS handles those.
 */
export async function fetchAndStoreRange(
  symbol: string,
  start: number,
  end: number,
): Promise<number> {
  const interval = config.KLINE_INTERVAL;
  let cursor = start;
  let written = 0;
  const now = Date.now();

  while (cursor <= end) {
    const batch = await fetchKlines(symbol, interval, {
      startTime: cursor,
      endTime: end,
      limit: REST_PAGE_LIMIT,
    });
    if (batch.length === 0) break;

    const closed = batch.filter((k) => k.closeTime <= now);
    written += upsertKlines(closed);

    const lastOpen = batch[batch.length - 1].openTime;
    const nextCursor = lastOpen + config.intervalMs;
    if (nextCursor <= cursor) break; // safety: no forward progress
    cursor = nextCursor;

    // Fewer than a full page means we've reached the end of available history.
    if (batch.length < REST_PAGE_LIMIT) break;

    // Throttle between pages so a large backfill spreads out and never bursts
    // against the Binance IP weight budget.
    if (config.REST_THROTTLE_MS > 0) await sleep(config.REST_THROTTLE_MS);
  }

  return written;
}

/**
 * Startup / restart backfill for a single symbol. One unified mechanism:
 *   - empty DB   → backfill the last BACKFILL_DAYS days (first-run case)
 *   - existing DB → backfill from the last stored candle to now (downtime gap)
 */
export async function backfillSymbol(symbol: string): Promise<number> {
  const interval = config.KLINE_INTERVAL;
  const now = Date.now();
  const maxOpen = getMaxOpenTime(symbol, interval);

  const start =
    maxOpen !== null
      ? maxOpen + config.intervalMs
      : now - config.BACKFILL_DAYS * 24 * 60 * 60 * 1000;

  const reason = maxOpen !== null ? "restart-gap" : "first-run";
  addEvent({ ts: now, symbol, type: "backfill_start", detail: reason, count: 0 });

  if (start > now) {
    log(`[backfill] ${symbol}: already up to date (${reason})`);
    addEvent({ ts: Date.now(), symbol, type: "backfill_done", detail: reason, count: 0 });
    return 0;
  }

  log(
    `[backfill] ${symbol}: ${reason}, from ${new Date(start).toISOString()} to now`,
  );
  const written = await fetchAndStoreRange(symbol, start, now);

  incrementStatus(symbol, "backfilledCount", written);
  const newMax = getMaxOpenTime(symbol, interval);
  if (newMax !== null) updateStatus(symbol, { lastKlineOpenTime: newMax });
  addEvent({ ts: Date.now(), symbol, type: "backfill_done", detail: reason, count: written });
  log(`[backfill] ${symbol}: wrote ${written} candles (${reason})`);
  return written;
}
