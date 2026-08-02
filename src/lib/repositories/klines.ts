import type { Statement } from "better-sqlite3";
import { getDb } from "../db";
import { INTERVAL_TO_MS } from "../intervals";
import type { TierStats } from "../source-interval";
import type { Candle, Kline, SparkPoint } from "../types";

interface KlineRow {
  symbol: string;
  interval: string;
  open_time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  close_time: number;
  quote_volume: number;
  trades: number;
  taker_buy_base: number;
  taker_buy_quote: number;
  is_final: number;
}

function rowToKline(r: KlineRow): Kline {
  return {
    symbol: r.symbol,
    interval: r.interval,
    openTime: r.open_time,
    open: r.open,
    high: r.high,
    low: r.low,
    close: r.close,
    volume: r.volume,
    closeTime: r.close_time,
    quoteVolume: r.quote_volume,
    trades: r.trades,
    takerBuyBase: r.taker_buy_base,
    takerBuyQuote: r.taker_buy_quote,
    isFinal: r.is_final,
  };
}

const UPSERT_SQL = `
  INSERT INTO klines (
    symbol, interval, open_time, open, high, low, close, volume,
    close_time, quote_volume, trades, taker_buy_base, taker_buy_quote, is_final
  ) VALUES (
    @symbol, @interval, @openTime, @open, @high, @low, @close, @volume,
    @closeTime, @quoteVolume, @trades, @takerBuyBase, @takerBuyQuote, @isFinal
  )
  ON CONFLICT (symbol, interval, open_time) DO UPDATE SET
    open = excluded.open, high = excluded.high, low = excluded.low,
    close = excluded.close, volume = excluded.volume, close_time = excluded.close_time,
    quote_volume = excluded.quote_volume, trades = excluded.trades,
    taker_buy_base = excluded.taker_buy_base, taker_buy_quote = excluded.taker_buy_quote,
    is_final = excluded.is_final
`;

export function upsertKline(k: Kline): void {
  getDb().prepare(UPSERT_SQL).run(k);
}

/** Bulk upsert inside a single transaction. Returns the number of rows written. */
export function upsertKlines(klines: Kline[]): number {
  if (klines.length === 0) return 0;
  const db = getDb();
  const stmt = db.prepare(UPSERT_SQL);
  const tx = db.transaction((rows: Kline[]) => {
    for (const r of rows) stmt.run(r);
    return rows.length;
  });
  return tx(klines);
}

export function getMaxOpenTime(symbol: string, interval: string): number | null {
  const row = getDb()
    .prepare("SELECT MAX(open_time) AS t FROM klines WHERE symbol = ? AND interval = ?")
    .get(symbol, interval) as { t: number | null };
  return row?.t ?? null;
}

export function getMinOpenTime(symbol: string, interval: string): number | null {
  const row = getDb()
    .prepare("SELECT MIN(open_time) AS t FROM klines WHERE symbol = ? AND interval = ?")
    .get(symbol, interval) as { t: number | null };
  return row?.t ?? null;
}

/** Rows stored for a symbol across every interval, including history tiers. */
export function countAllKlines(symbol: string): number {
  const row = getDb()
    .prepare("SELECT COUNT(*) AS c FROM klines WHERE symbol = ?")
    .get(symbol) as { c: number };
  return row.c;
}

export function countKlines(symbol: string, interval: string): number {
  const row = getDb()
    .prepare("SELECT COUNT(*) AS c FROM klines WHERE symbol = ? AND interval = ?")
    .get(symbol, interval) as { c: number };
  return row.c;
}

/** Most recent klines, returned oldest → newest (chart friendly). */
export function getRecentKlines(symbol: string, interval: string, limit: number): Kline[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM klines WHERE symbol = ? AND interval = ?
       ORDER BY open_time DESC LIMIT ?`,
    )
    .all(symbol, interval, limit) as KlineRow[];
  return rows.map(rowToKline).reverse();
}

// better-sqlite3 does not cache prepared statements, and this is the most expensive
// statement in the repo to compile — hoisted so the per-second poll pays it once.
let aggregateStmt: Statement | null = null;
let passthroughStmt: Statement | null = null;

/**
 * Roll stored candles up into larger buckets, in SQL.
 *
 * The collector only ever stores one interval (1s by default); every coarser view
 * the chart offers is derived here rather than collected separately. open/close come
 * from the first/last row inside each bucket (hence the ROW_NUMBER pass), high/low/
 * volume are plain aggregates. The scan is bounded to the newest `limit` buckets so
 * cost is independent of how much history the DB holds.
 *
 * Returns oldest → newest. The final bucket is normally still in progress.
 */
export function getAggregatedCandles(
  symbol: string,
  interval: string,
  bucketMs: number,
  limit: number,
  from?: number,
): Candle[] {
  const newest = getMaxOpenTime(symbol, interval);
  if (newest === null) return [];

  // Align to bucket boundaries so the oldest bucket returned is a whole one.
  const newestBucket = Math.floor(newest / bucketMs) * bucketMs;
  const start = Math.max(from ?? 0, newestBucket - (limit - 1) * bucketMs);

  // At the source interval every bucket holds exactly one row, so the window
  // functions and GROUP BY would be pure overhead over a plain indexed read.
  if (bucketMs === INTERVAL_TO_MS[interval]) {
    passthroughStmt ??= getDb().prepare(
      `SELECT open_time AS t, open, high, low, close, volume
       FROM klines WHERE symbol = ? AND interval = ? AND open_time >= ?
       ORDER BY open_time DESC LIMIT ?`,
    );
    return (passthroughStmt.all(symbol, interval, start, limit) as Candle[]).reverse();
  }

  aggregateStmt ??= getDb().prepare(
    // better-sqlite3 binds JS numbers as REAL, and REAL division would put every
    // source row in its own bucket — the casts keep the floor division integral.
    `WITH params AS (
         SELECT CAST(@bucketMs AS INTEGER) AS bucket_ms
       ),
       ranked AS (
         SELECT (k.open_time / p.bucket_ms) * p.bucket_ms AS bucket,
                k.open, k.high, k.low, k.close, k.volume,
                ROW_NUMBER() OVER (
                  PARTITION BY k.open_time / p.bucket_ms ORDER BY k.open_time ASC
                ) AS first_rn,
                ROW_NUMBER() OVER (
                  PARTITION BY k.open_time / p.bucket_ms ORDER BY k.open_time DESC
                ) AS last_rn
         FROM klines k, params p
         WHERE k.symbol = @symbol AND k.interval = @interval
           AND k.open_time >= @start
       )
       SELECT bucket AS t,
              MAX(CASE WHEN first_rn = 1 THEN open END) AS open,
              MAX(high) AS high,
              MIN(low) AS low,
              MAX(CASE WHEN last_rn = 1 THEN close END) AS close,
              COALESCE(SUM(volume), 0) AS volume
       FROM ranked
       GROUP BY bucket
       ORDER BY bucket ASC`,
  );
  return aggregateStmt.all({ symbol, interval, bucketMs, start }) as Candle[];
}

/**
 * Cached roll-up. Only the newest bucket can still be forming, so a repeat call
 * recomputes that one bucket and reuses the closed ones — turning the expensive
 * views (a 1h roll-up scans the whole symbol partition) into a tail query.
 *
 * Closed buckets are *not* permanently immutable here: the reconciler backfills
 * missing source candles, which retroactively changes the bucket that contained
 * them. `gapsFilled` is the collector's own counter for exactly that event, so a
 * change in it drops the cache. Collector and web are separate processes, which
 * is why the signal has to come through the database rather than a function call.
 */
const rollupCache = new Map<
  string,
  { gapsFilled: number; builtAt: number; from: number; candles: Candle[] }
>();
const ROLLUP_MAX_AGE_MS = 5 * 60 * 1000; // floor under retention pruning the oldest bucket

export function getCachedCandles(
  symbol: string,
  interval: string,
  bucketMs: number,
  limit: number,
  from?: number,
): Candle[] {
  const key = `${symbol}|${interval}|${bucketMs}|${limit}|${from ?? ""}`;
  const gapsFilled = getGapsFilled(symbol);
  const hit = rollupCache.get(key);
  const now = Date.now();

  const reusable =
    hit &&
    hit.gapsFilled === gapsFilled &&
    now - hit.builtAt < ROLLUP_MAX_AGE_MS &&
    hit.candles.length > 0;

  if (!reusable) {
    const candles = getAggregatedCandles(symbol, interval, bucketMs, limit, from);
    rollupCache.set(key, { gapsFilled, builtAt: now, from: from ?? 0, candles });
    return candles;
  }

  // Recompute from the last held bucket forward: that bucket may have grown, and
  // newer ones may have opened since.
  const lastT = hit.candles[hit.candles.length - 1].t;
  const fresh = getAggregatedCandles(symbol, interval, bucketMs, limit, lastT);
  if (fresh.length === 0) return hit.candles;

  const merged = hit.candles.slice(0, -1).concat(fresh);
  const trimmed = merged.length > limit ? merged.slice(merged.length - limit) : merged;
  rollupCache.set(key, { ...hit, candles: trimmed });
  return trimmed;
}

/** Gap-fill counter for a symbol — the roll-up cache's invalidation signal. */
function getGapsFilled(symbol: string): number {
  const row = getDb()
    .prepare("SELECT gaps_filled FROM pipeline_status WHERE symbol = ?")
    .get(symbol) as { gaps_filled: number } | undefined;
  return row?.gaps_filled ?? 0;
}

/**
 * Per-tier reach and completeness, for choosing which interval feeds a roll-up.
 * Both are index-only scans (~1ms even over a week of 1s rows).
 */
export function getIntervalStats(
  symbol: string,
  intervals: string[],
  since: number,
): Map<string, TierStats> {
  const db = getDb();
  const minStmt = db.prepare(
    "SELECT MIN(open_time) AS t FROM klines WHERE symbol = ? AND interval = ?",
  );
  const countStmt = db.prepare(
    "SELECT COUNT(*) AS c FROM klines WHERE symbol = ? AND interval = ? AND open_time >= ?",
  );

  const out = new Map<string, TierStats>();
  for (const interval of intervals) {
    const min = minStmt.get(symbol, interval) as { t: number | null };
    if (min?.t == null) continue;
    const count = countStmt.get(symbol, interval, Math.max(since, min.t)) as { c: number };
    out.set(interval, { from: min.t, rows: count.c });
  }
  return out;
}

/** Closes only, for the card sparklines. Avoids shipping 14 columns over SSE. */
export function getRecentCloses(symbol: string, interval: string, limit: number): SparkPoint[] {
  const rows = getDb()
    .prepare(
      `SELECT open_time AS t, close FROM klines
       WHERE symbol = ? AND interval = ?
       ORDER BY open_time DESC LIMIT ?`,
    )
    .all(symbol, interval, limit) as SparkPoint[];
  return rows.reverse();
}

/** 24h rollup computed in SQLite (MIN/MAX/SUM) — avoids pulling every row into JS. */
export interface Stats24h {
  firstOpen: number | null;
  high: number | null;
  low: number | null;
  volume: number;
  quoteVolume: number;
  count: number;
}

export function get24hStats(symbol: string, interval: string, since: number): Stats24h {
  const db = getDb();
  const agg = db
    .prepare(
      `SELECT MAX(high) AS high, MIN(low) AS low,
              COALESCE(SUM(volume), 0) AS volume,
              COALESCE(SUM(quote_volume), 0) AS quote_volume,
              COUNT(*) AS count
       FROM klines WHERE symbol = ? AND interval = ? AND open_time >= ?`,
    )
    .get(symbol, interval, since) as {
    high: number | null;
    low: number | null;
    volume: number;
    quote_volume: number;
    count: number;
  };
  const first = db
    .prepare(
      `SELECT open FROM klines WHERE symbol = ? AND interval = ? AND open_time >= ?
       ORDER BY open_time ASC LIMIT 1`,
    )
    .get(symbol, interval, since) as { open: number } | undefined;

  return {
    firstOpen: first?.open ?? null,
    high: agg.high,
    low: agg.low,
    volume: agg.volume,
    quoteVolume: agg.quote_volume,
    count: agg.count,
  };
}

/** Delete klines older than `cutoff` (epoch ms) for an interval. Returns rows removed. */
export function pruneKlinesBefore(interval: string, cutoff: number): number {
  const info = getDb()
    .prepare("DELETE FROM klines WHERE interval = ? AND open_time < ?")
    .run(interval, cutoff);
  return info.changes;
}

/** Existing open_times within [start, end], ascending. Used for gap detection. */
export function getOpenTimesInRange(
  symbol: string,
  interval: string,
  start: number,
  end: number,
): number[] {
  const rows = getDb()
    .prepare(
      `SELECT open_time FROM klines
       WHERE symbol = ? AND interval = ? AND open_time BETWEEN ? AND ?
       ORDER BY open_time ASC`,
    )
    .all(symbol, interval, start, end) as { open_time: number }[];
  return rows.map((r) => r.open_time);
}
