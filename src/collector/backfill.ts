import { fetchKlines, sleep } from "../lib/binance";
import { BACKFILL_PAGE_SIZE } from "../lib/backfill-progress";
import { config, type HistoryTier } from "../lib/config";
import { INTERVAL_TO_MS } from "../lib/intervals";
import { getMaxOpenTime, getMinOpenTime, upsertKlines } from "../lib/repositories/klines";
import {
  advanceBackfill,
  beginBackfill,
  finishBackfill,
  skipBackfill,
} from "../lib/repositories/backfill";
import { addEvent, incrementStatus, updateStatus } from "../lib/repositories/pipeline";
import type { BackfillKind } from "../lib/types";
import { log } from "./logger";

const REST_PAGE_LIMIT = BACKFILL_PAGE_SIZE;

/** Publish this range's progress as it paginates. Omitted for fills too short to watch. */
export interface BackfillTracking {
  kind: BackfillKind;
  reason: string;
}

/**
 * Fetch every closed candle in [start, end] (inclusive of start) and upsert it.
 * Paginates through the REST API 1000 candles at a time. Returns rows written.
 * Candles that are still forming (closeTime > now) are skipped — WS handles those.
 *
 * With `track`, each page also updates `backfill_progress` — one write per REST
 * call, which is free next to the call itself, and the only place that knows how
 * far along a fill is.
 */
export async function fetchAndStoreRange(
  symbol: string,
  start: number,
  end: number,
  interval: string = config.KLINE_INTERVAL,
  track?: BackfillTracking,
): Promise<number> {
  const stepMs = INTERVAL_TO_MS[interval];
  let cursor = start;
  let written = 0;
  let pages = 0;
  const now = Date.now();

  if (track) {
    beginBackfill({ symbol, interval, ...track, rangeStart: start, rangeEnd: end });
  }

  while (cursor <= end) {
    const batch = await fetchKlines(symbol, interval, {
      startTime: cursor,
      endTime: end,
      limit: REST_PAGE_LIMIT,
    });
    if (batch.length === 0) break;

    const closed = batch.filter((k) => k.closeTime <= now);
    written += upsertKlines(closed);
    pages += 1;

    const lastOpen = batch[batch.length - 1].openTime;
    if (track) {
      advanceBackfill(symbol, interval, {
        cursorTime: lastOpen,
        written,
        pages,
        // A tier that asked for "everything" requested a start older than the
        // symbol itself; the first page is where its history really begins.
        ...(pages === 1 && batch[0].openTime > start ? { rangeStart: batch[0].openTime } : {}),
      });
    }

    const nextCursor = lastOpen + stepMs;
    if (nextCursor <= cursor) break; // safety: no forward progress
    cursor = nextCursor;

    // Fewer than a full page means we've reached the end of available history.
    if (batch.length < REST_PAGE_LIMIT) break;

    // Throttle between pages so a large backfill spreads out and never bursts
    // against the Binance IP weight budget.
    if (config.REST_THROTTLE_MS > 0) await sleep(config.REST_THROTTLE_MS);
  }

  if (track) finishBackfill(symbol, interval, written);
  return written;
}

/**
 * Startup / restart backfill for a single symbol. One unified mechanism:
 *   - history doesn't reach back BACKFILL_DAYS → backfill the full window
 *     (first run, OR a live WS candle already landed before backfill ran)
 *   - history reaches back far enough → fill only the gap from the last candle
 *
 * We key off the EARLIEST stored candle, not the latest, so a single live candle
 * that arrived first (live-first ordering) doesn't fool us into "already up to date".
 */
export async function backfillSymbol(symbol: string): Promise<number> {
  const interval = config.KLINE_INTERVAL;
  const now = Date.now();
  const desiredStart = now - config.BACKFILL_DAYS * 24 * 60 * 60 * 1000;
  const maxOpen = getMaxOpenTime(symbol, interval);
  const minOpen = getMinOpenTime(symbol, interval);

  const needsFullWindow = minOpen === null || minOpen > desiredStart;
  const start = needsFullWindow ? desiredStart : (maxOpen ?? desiredStart) + config.intervalMs;
  const reason = needsFullWindow ? "first-run" : "restart-gap";
  addEvent({ ts: now, symbol, type: "backfill_start", detail: reason, count: 0 });

  if (start > now) {
    log(`[backfill] ${symbol}: already up to date (${reason})`);
    skipBackfill(symbol, interval, reason);
    addEvent({ ts: Date.now(), symbol, type: "backfill_done", detail: reason, count: 0 });
    return 0;
  }

  log(
    `[backfill] ${symbol}: ${reason}, from ${new Date(start).toISOString()} to now`,
  );
  const written = await fetchAndStoreRange(symbol, start, now, interval, { kind: "live", reason });

  incrementStatus(symbol, "backfilledCount", written);
  const newMax = getMaxOpenTime(symbol, interval);
  if (newMax !== null) updateStatus(symbol, { lastKlineOpenTime: newMax });
  addEvent({ ts: Date.now(), symbol, type: "backfill_done", detail: reason, count: written });
  log(`[backfill] ${symbol}: wrote ${written} candles (${reason})`);
  return written;
}

/**
 * Fill one coarse history tier for a symbol, then keep it current.
 *
 * These tiers exist because the 1s operational data cannot span real history:
 * nine years of BTCUSDT at 1s is ~283M candles. A coarse tier covers the same
 * span for a rounding error — 1h since listing is ~78k rows — and long chart
 * ranges are served from it instead.
 *
 * Extends backwards to the requested depth and forwards to now, so restarts and
 * a deepened `HISTORY_TIERS` both converge without a separate migration.
 */
export async function backfillHistoryTier(symbol: string, tier: HistoryTier): Promise<number> {
  const { interval, days } = tier;
  const stepMs = INTERVAL_TO_MS[interval];
  const now = Date.now();
  // `null` days means "everything"; 0 is a safe floor since Binance clamps to listing.
  const desiredStart = days === null ? 0 : now - days * 24 * 60 * 60 * 1000;

  const minOpen = getMinOpenTime(symbol, interval);
  const maxOpen = getMaxOpenTime(symbol, interval);
  let written = 0;
  let fetched = false;
  const track = (reason: string): BackfillTracking => {
    fetched = true;
    return { kind: "history", reason };
  };

  // Older history first, so the deepest range becomes usable soonest.
  if (minOpen === null) {
    written += await fetchAndStoreRange(symbol, desiredStart, now, interval, track("first-run"));
  } else {
    if (desiredStart < minOpen) {
      written += await fetchAndStoreRange(
        symbol,
        desiredStart,
        minOpen - stepMs,
        interval,
        track("extend-back"),
      );
    }
    // Only reach forward once a bucket has actually closed. Without this guard a
    // frequent top-up spends a REST call per pass re-fetching the in-progress
    // bucket, which `fetchAndStoreRange` discards anyway.
    const lastClosedBucket = Math.floor(now / stepMs) * stepMs - stepMs;
    if (maxOpen !== null && lastClosedBucket >= maxOpen + stepMs) {
      written += await fetchAndStoreRange(
        symbol,
        maxOpen + stepMs,
        now,
        interval,
        track("catch-up"),
      );
    }
  }

  // Nothing to fetch is still an outcome: the row would otherwise sit at "waiting"
  // for the life of the process and hold the progress display open.
  if (!fetched) skipBackfill(symbol, interval, "up-to-date");

  if (written > 0) log(`[history] ${symbol} ${interval}: wrote ${written} candles`);
  return written;
}
