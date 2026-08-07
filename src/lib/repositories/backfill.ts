import { getDb } from "../db";
import { INTERVAL_TO_MS } from "../intervals";
import type { BackfillKind, BackfillTask } from "../types";

interface TaskRow {
  symbol: string;
  interval: string;
  kind: string;
  phase: string;
  reason: string;
  range_start: number;
  range_end: number;
  cursor_time: number;
  written: number;
  pages: number;
  started_at: number;
  updated_at: number;
}

function rowToTask(r: TaskRow): BackfillTask {
  return {
    symbol: r.symbol,
    interval: r.interval,
    kind: r.kind as BackfillKind,
    phase: r.phase as BackfillTask["phase"],
    reason: r.reason,
    rangeStart: r.range_start,
    rangeEnd: r.range_end,
    cursorTime: r.cursor_time,
    written: r.written,
    pages: r.pages,
    startedAt: r.started_at,
    updatedAt: r.updated_at,
  };
}

/**
 * Announce a fill that is going to happen but has not started yet, so the reader
 * sees the whole plan on the first frame instead of symbols appearing one at a
 * time. The range is unknown at this point — it is computed when the fill starts.
 */
export function registerPendingBackfill(
  symbol: string,
  interval: string,
  kind: BackfillKind,
): void {
  getDb()
    .prepare(
      `INSERT INTO backfill_progress
         (symbol, interval, kind, phase, reason, range_start, range_end,
          cursor_time, written, pages, started_at, updated_at)
       VALUES (@symbol, @interval, @kind, 'pending', '', 0, 0, 0, 0, 0, 0, @now)
       ON CONFLICT (symbol, interval) DO UPDATE SET
         kind = @kind, phase = 'pending', reason = '', range_start = 0, range_end = 0,
         cursor_time = 0, written = 0, pages = 0, started_at = 0, updated_at = @now`,
    )
    .run({ symbol, interval, kind, now: Date.now() });
}

/** Mark a fill as under way over `[rangeStart, rangeEnd]`. Resets the counters. */
export function beginBackfill(args: {
  symbol: string;
  interval: string;
  kind: BackfillKind;
  reason: string;
  rangeStart: number;
  rangeEnd: number;
}): void {
  const now = Date.now();
  getDb()
    .prepare(
      `INSERT INTO backfill_progress
         (symbol, interval, kind, phase, reason, range_start, range_end,
          cursor_time, written, pages, started_at, updated_at)
       VALUES (@symbol, @interval, @kind, 'running', @reason, @rangeStart, @rangeEnd,
               @rangeStart, 0, 0, @now, @now)
       ON CONFLICT (symbol, interval) DO UPDATE SET
         kind = @kind, phase = 'running', reason = @reason,
         range_start = @rangeStart, range_end = @rangeEnd, cursor_time = @rangeStart,
         written = 0, pages = 0, started_at = @now, updated_at = @now`,
    )
    .run({ ...args, now });
}

/**
 * Record one fetched page.
 *
 * `rangeStart` is patchable because a tier asking for "everything" starts from a
 * requested time far older than the symbol's listing; the first page reveals where
 * history actually begins, and without correcting the window the bar would sit
 * near zero for the entire fill.
 */
export function advanceBackfill(
  symbol: string,
  interval: string,
  patch: { cursorTime: number; written: number; pages: number; rangeStart?: number },
): void {
  const now = Date.now();
  getDb()
    .prepare(
      `UPDATE backfill_progress
          SET cursor_time = @cursorTime,
              written = @written,
              pages = @pages,
              range_start = CASE WHEN @rangeStart IS NULL THEN range_start ELSE @rangeStart END,
              updated_at = @now
        WHERE symbol = @symbol AND interval = @interval`,
    )
    .run({ symbol, interval, ...patch, rangeStart: patch.rangeStart ?? null, now });
}

/** Mark a fill complete — the bar reads 100% whatever the cursor ended on. */
export function finishBackfill(symbol: string, interval: string, written?: number): void {
  const now = Date.now();
  getDb()
    .prepare(
      `UPDATE backfill_progress
          SET phase = 'done',
              cursor_time = range_end,
              written = CASE WHEN @written IS NULL THEN written ELSE @written END,
              updated_at = @now
        WHERE symbol = @symbol AND interval = @interval`,
    )
    .run({ symbol, interval, written: written ?? null, now });
}

/**
 * Mark a planned fill as complete without it ever running — the up-to-date case.
 * Nothing to fetch is still an answer, and the row has to stop saying "waiting".
 */
export function skipBackfill(symbol: string, interval: string, reason: string): void {
  const now = Date.now();
  getDb()
    .prepare(
      `UPDATE backfill_progress
          SET phase = 'done', reason = @reason, cursor_time = range_end, updated_at = @now
        WHERE symbol = @symbol AND interval = @interval`,
    )
    .run({ symbol, interval, reason, now });
}

/**
 * Every known fill, ordered the way a reader wants to see them: the live tier
 * first (it gates the dashboard), then the history tiers finest-first. SQL cannot
 * sort intervals by duration — "1h" sorts before "1m" as text — so ordering is
 * done here against the interval table.
 */
export function getBackfillTasks(): BackfillTask[] {
  const rows = getDb()
    .prepare(
      `SELECT symbol, interval, kind, phase, reason, range_start, range_end,
              cursor_time, written, pages, started_at, updated_at
         FROM backfill_progress`,
    )
    .all() as TaskRow[];

  return rows.map(rowToTask).sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "live" ? -1 : 1;
    const step = (INTERVAL_TO_MS[a.interval] ?? 0) - (INTERVAL_TO_MS[b.interval] ?? 0);
    return step !== 0 ? step : a.symbol.localeCompare(b.symbol);
  });
}

/**
 * Drop every row. Called once at collector start: the table describes work in
 * flight, and rows left behind by the previous process describe nothing.
 */
export function clearBackfillTasks(): void {
  getDb().prepare("DELETE FROM backfill_progress").run();
}
