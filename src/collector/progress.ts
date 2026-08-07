import { remainingPages, taskPct } from "../lib/backfill-progress";
import { getBackfillTasks } from "../lib/repositories/backfill";
import type { BackfillTask } from "../lib/types";
import { log, logRaw, setLiveRegion } from "./logger";
import { amber, bold, dim, green, isTTY } from "./style";

/**
 * The collector's console during backfill.
 *
 * A cold start spends a minute or more inside paginated REST calls — 87 pages per
 * symbol for a day of 1s candles — and until now printed one line before it and
 * one card after it. Silence in the middle is indistinguishable from a hang, so
 * the block below redraws in place while the fills run.
 *
 * On a TTY it is a live region: the timer redraws it, and log lines from the rest
 * of the collector write above it (see `setLiveRegion`). Everywhere else — a pipe,
 * a CI log, a systemd journal — cursor movement would be garbage, so the same
 * state is emitted as ordinary log lines at each 10% step instead.
 */

const TICK_MS = 250;
const BAR_WIDTH = 20;
const FILLED = "█";
const EMPTY = "░";

const HIDE_CURSOR = "\u001b[?25l";
const SHOW_CURSOR = "\u001b[?25h";
/** Move up n lines, then erase from the cursor to the end of the screen. */
const eraseUp = (n: number) => `\u001b[${n}A\u001b[0J`;

export function bar(pct: number, width = BAR_WIDTH): string {
  const filled = Math.round((Math.min(100, Math.max(0, pct)) / 100) * width);
  return FILLED.repeat(filled) + EMPTY.repeat(width - filled);
}

const key = (t: BackfillTask) => `${t.symbol}:${t.interval}`;

/** Right-hand column: what this task is doing, in the terms that cost time. */
function detail(task: BackfillTask): string {
  if (task.phase === "pending") return "waiting";
  if (task.phase === "done") {
    return task.written > 0 ? `${task.written.toLocaleString()} candles` : "up to date";
  }
  const left = remainingPages(task);
  return `${task.written.toLocaleString()} candles · ${left}p left`;
}

/**
 * The block itself, as lines. Pure so it can be tested without a terminal —
 * width and alignment are the whole point of it, and they are easy to break.
 */
export function renderProgress(tasks: BackfillTask[], elapsedMs: number): string[] {
  if (tasks.length === 0) return [];

  const allDone = tasks.every((t) => t.phase === "done");
  const heading = allDone ? green("● backfill") : amber("● backfill");
  const label = (t: BackfillTask) => `${t.interval.padEnd(3)} ${t.symbol.padEnd(8)}`;
  const pagesLeft = tasks.reduce((sum, t) => sum + remainingPages(t), 0);

  const lines = tasks.map((t, i) => {
    const pct = taskPct(t);
    const painted = t.phase === "done" ? green(bar(pct)) : amber(bar(pct));
    return (
      `  ${i === 0 ? bold(heading) : " ".repeat(10)}  ` +
      `${dim(label(t))}  ${painted} ${`${pct.toFixed(0)}%`.padStart(4)}  ${dim(detail(t))}`
    );
  });

  lines.push(
    `  ${" ".repeat(10)}  ` +
      dim(
        `elapsed ${(elapsedMs / 1000).toFixed(1)}s` +
          (allDone ? "" : ` · ${pagesLeft} page(s) to go`),
      ),
  );
  return lines;
}

/** Drives the block: reads progress rows on a timer and paints them. */
export class ProgressConsole {
  private timer: NodeJS.Timeout | null = null;
  private lines = 0;
  private startedAt = 0;
  private lastSnapshot: BackfillTask[] = [];
  /** Last decile logged per task, for the non-TTY path. */
  private readonly steps = new Map<string, number>();

  constructor(private readonly read: () => BackfillTask[] = getBackfillTasks) {}

  start(): void {
    if (this.timer) return;
    this.startedAt = Date.now();
    if (isTTY) {
      process.stdout.write(HIDE_CURSOR);
      setLiveRegion(this);
      // A hidden cursor outlives the process that hid it. `stop()` restores it on
      // every ordinary path; this covers the ones that skip it, like a fatal throw.
      process.once("exit", () => process.stdout.write(SHOW_CURSOR));
    }
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.timer.unref?.();
  }

  /**
   * Stop drawing. The final state is left on screen as ordinary output rather than
   * erased: how long the fill took, and how much landed, is worth keeping in the
   * scrollback next to the ready card.
   */
  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;

    if (isTTY) {
      this.clear();
      setLiveRegion(null);
      process.stdout.write(SHOW_CURSOR);
      const final = renderProgress(this.lastSnapshot, Date.now() - this.startedAt);
      if (final.length > 0) logRaw(final.join("\n"));
    }
  }

  // --- LiveRegion ---

  clear(): void {
    if (this.lines === 0) return;
    process.stdout.write(eraseUp(this.lines));
    this.lines = 0;
  }

  redraw(): void {
    if (!this.timer) return;
    const out = renderProgress(this.lastSnapshot, Date.now() - this.startedAt);
    if (out.length === 0) return;
    process.stdout.write(`${out.join("\n")}\n`);
    this.lines = out.length;
  }

  private tick(): void {
    try {
      this.lastSnapshot = this.read();
    } catch {
      return; // A transient DB read is not worth interrupting the boot for.
    }

    if (isTTY) {
      this.clear();
      this.redraw();
    } else {
      this.logSteps();
    }

    // Nothing left to watch. Registration happens before the first fill starts, so
    // an empty table here means the collector has not planned its work yet.
    if (this.lastSnapshot.length > 0 && this.lastSnapshot.every((t) => t.phase === "done")) {
      this.stop();
    }
  }

  /** Non-TTY fallback: one line per task per 10% of progress, plus completion. */
  private logSteps(): void {
    for (const task of this.lastSnapshot) {
      if (task.phase === "pending") continue;
      const step = task.phase === "done" ? 10 : Math.floor(taskPct(task) / 10);
      if ((this.steps.get(key(task)) ?? -1) >= step) continue;
      this.steps.set(key(task), step);
      if (step === 0) continue; // the start is already logged by the caller

      log(
        `[backfill] ${task.symbol} ${task.interval}: ${taskPct(task).toFixed(0)}%` +
          ` · ${task.pages} page(s) · ${task.written.toLocaleString()} candles` +
          (task.phase === "done" ? " · done" : ""),
      );
    }
  }
}
