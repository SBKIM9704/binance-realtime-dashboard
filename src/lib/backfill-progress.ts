import { INTERVAL_TO_MS } from "./intervals";
import type { BackfillTask } from "./types";

/**
 * Reading backfill progress: cursor → "62%, 33 pages to go".
 *
 * Progress is measured in *time covered*, not pages fetched. The total page count
 * is unknown for a tier that reaches back "everything Binance has", but the window
 * being filled is always known once the fill starts. Remaining work is the other
 * way round — pages, because a page is a REST call and REST calls are the wait.
 *
 * Only the collector's console reads this (see `collector/progress.ts`); it sits
 * in `lib/` next to the repository and the interval table it depends on, as
 * `gaps.ts` does for the reconciler.
 */

/** Candles per paginated REST request (Binance klines `limit` max). */
export const BACKFILL_PAGE_SIZE = 1000;

/** Fraction of the window already covered, 0–100. */
export function taskPct(task: BackfillTask): number {
  if (task.phase === "done") return 100;
  if (task.phase === "pending") return 0;
  const span = task.rangeEnd - task.rangeStart;
  if (span <= 0) return task.cursorTime >= task.rangeEnd ? 100 : 0;
  const covered = task.cursorTime - task.rangeStart;
  return Math.min(100, Math.max(0, (covered / span) * 100));
}

/** Candles still to fetch. Zero for done tasks; the whole window for pending ones. */
export function remainingCandles(task: BackfillTask): number {
  if (task.phase === "done") return 0;
  const stepMs = INTERVAL_TO_MS[task.interval];
  if (!stepMs) return 0;
  const from = task.phase === "pending" ? task.rangeStart : task.cursorTime;
  return Math.max(0, Math.ceil((task.rangeEnd - from) / stepMs));
}

/** REST pages still to fetch — the unit that actually costs wall-clock time. */
export function remainingPages(task: BackfillTask): number {
  return Math.ceil(remainingCandles(task) / BACKFILL_PAGE_SIZE);
}
