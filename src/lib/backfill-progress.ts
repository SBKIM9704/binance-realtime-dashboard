import { INTERVAL_TO_MS } from "./intervals";
import type { BackfillTask } from "./types";

/**
 * Shared reading of backfill progress.
 *
 * The collector's console and the dashboard both render the same rows, so the
 * arithmetic that turns a cursor into "62%, 33 pages to go" lives here once — a
 * percentage that disagreed between the two screens would be worse than none.
 *
 * Progress is measured in *time covered*, not pages fetched: the total page count
 * is unknown for a tier that reaches back "everything Binance has", but the window
 * being filled is always known once the fill starts.
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

export interface BackfillSummary {
  /** Every fill in this cold start's plan, finished ones included. */
  tasks: BackfillTask[];
  /** Time-weighted progress across the whole plan, 0–100. */
  pct: number;
  remainingPages: number;
  /** Earliest start in the plan — the age of this cold start. */
  startedAt: number;
  /** Some fill is still pending or running. */
  active: boolean;
  /** Enough work is left that interrupting the reader is warranted. */
  worthShowing: boolean;
}

/**
 * Summarise the plan, or null when the collector has not published one.
 *
 * The finished tasks stay in the list. A symbol that had nothing to fill is the
 * most confusing thing a reader can meet — one bar fills, the other never appears —
 * and the answer ("that one was already up to date") only exists if its row is
 * shown. The console block has always shown every row; this is what the web reads
 * to match it.
 *
 * `worthShowing` is separate from `active` because the same mechanism fills a day
 * of history on first run and a single missed minute after a reconnect. The second
 * is over before a banner can be read, and a panel that flashes once an hour is
 * noise — so a fill has to be big enough to earn the interruption. Callers latch on
 * this and then follow `active`, so the panel does not vanish mid-plan when the
 * running fill is nearly done and the next symbol has not started yet.
 */
export function summariseBackfill(tasks: BackfillTask[], minPages = 3): BackfillSummary | null {
  if (tasks.length === 0) return null;

  const open = tasks.filter((t) => t.phase !== "done");
  const pages = open.reduce((sum, t) => sum + remainingPages(t), 0);
  const pct = tasks.reduce((sum, t) => sum + taskPct(t), 0) / tasks.length;
  const startedAt = Math.min(...tasks.map((t) => t.startedAt).filter((v) => v > 0));

  return {
    tasks,
    pct,
    remainingPages: pages,
    startedAt: Number.isFinite(startedAt) ? startedAt : Date.now(),
    active: open.length > 0,
    worthShowing: open.some((t) => t.phase === "running") && pages >= minPages,
  };
}
