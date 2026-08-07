"use client";

import { useEffect, useRef } from "react";
import { useApp } from "@/components/providers";
import { remainingPages, summariseBackfill, taskPct } from "@/lib/backfill-progress";
import { fmtClock, fmtDuration, fmtInt } from "@/lib/format";
import type { TKey } from "@/lib/i18n";
import type { BackfillTask, DashboardSnapshot } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Events worth showing while the fill runs — the rest is noise at this moment. */
const STARTUP_EVENTS = new Set(["backfill_start", "backfill_done", "ws_connect", "gap_filled"]);
const EVENT_LINES = 3;

/**
 * Cold-start progress, shown above the dashboard while REST backfill runs.
 *
 * A first run spends a minute or more filling a day of 1s candles, and during that
 * window the dashboard is *correct but thin* — the chart has a stub, 24h figures
 * are partial. Without this the reader has to guess whether that is a broken
 * pipeline or an unfinished one. The banner says which, and removes itself when
 * the fills land.
 *
 * It renders nothing for the small fills the same mechanism performs all day (a
 * reconnect gap, an hourly top-up): see `summariseBackfill`.
 */
export function BackfillPanel({ snapshot }: { snapshot: DashboardSnapshot }) {
  const { t } = useApp();
  const summary = summariseBackfill(snapshot.backfill);

  // Once a plan is big enough to announce, stay up until it finishes. Re-deciding
  // every frame would hide the panel between symbols — the running fill drops under
  // the threshold before the next one has a range to count.
  const shown = useRef(false);
  useEffect(() => {
    if (summary?.worthShowing) shown.current = true;
    else if (!summary?.active) shown.current = false;
  }, [summary?.worthShowing, summary?.active]);

  if (!summary || !summary.active) return null;
  if (!summary.worthShowing && !shown.current) return null;

  const events = snapshot.events.filter((e) => STARTUP_EVENTS.has(e.type)).slice(0, EVENT_LINES);

  return (
    <section
      className="rounded-lg border border-primary/40 bg-card px-4 py-3"
      aria-live="polite"
      aria-busy
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-primary motion-safe:animate-pulse-dot" />
          <span className="font-sans text-sm font-semibold text-foreground">
            {t("backfill.title")}
          </span>
        </span>
        <span className="tnum text-sm text-primary">{summary.pct.toFixed(0)}%</span>
        <span className="label">
          {t("backfill.pagesLeft", { n: fmtInt(summary.remainingPages) })}
        </span>
        <span className="label ml-auto">
          {t("backfill.elapsed", { age: fmtDuration(snapshot.ts - summary.startedAt) })}
        </span>
      </div>

      <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
        {summary.tasks.map((task) => (
          <TaskRow key={`${task.symbol}:${task.interval}`} task={task} />
        ))}
      </ul>

      <p className="mt-3 text-xs text-muted-foreground">{t("backfill.hint")}</p>

      {events.length > 0 ? (
        <ul className="mt-2 space-y-0.5">
          {events.map((e) => (
            <li key={e.id} className="flex gap-2 tnum text-[11px] text-muted-foreground">
              <span className="w-16 shrink-0">{fmtClock(e.ts)}</span>
              <span className="w-14 shrink-0">{e.symbol.replace("USDT", "")}</span>
              <span className="truncate">
                {t(`event.${e.type}` as TKey)}
                {e.detail ? ` · ${e.detail}` : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/** Right-hand column: what this row is doing, in the terms that cost time. */
function useDetail(task: BackfillTask): string {
  const { t } = useApp();
  if (task.phase === "pending") return t("backfill.waiting");
  if (task.written > 0) return t("backfill.candles", { n: fmtInt(task.written) });
  // A finished fill that wrote nothing had nothing to write — the one case a reader
  // is most likely to misread as "stuck" or "forgotten".
  if (task.phase === "done") return t("backfill.upToDate");
  return `${remainingPages(task)}p`;
}

function TaskRow({ task }: { task: BackfillTask }) {
  const { t } = useApp();
  const detail = useDetail(task);
  const pct = taskPct(task);
  const pending = task.phase === "pending";
  const done = task.phase === "done";
  const label = `${task.symbol.replace("USDT", "")} · ${task.interval}`;

  return (
    <li className="flex items-center gap-2 text-xs">
      <span className="w-20 shrink-0 truncate text-muted-foreground" title={label}>
        {label}
      </span>
      <span
        className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label={`${label} ${t(`backfill.tier.${task.kind}` as TKey)}`}
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span
          className={cn(
            "block h-full rounded-full transition-[width] duration-500",
            pending
              ? "bg-muted-foreground/40"
              : done
                ? "bg-[hsl(var(--success))]"
                : "bg-primary",
          )}
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="tnum w-9 shrink-0 text-right text-muted-foreground">
        {pct.toFixed(0)}%
      </span>
      <span className="tnum hidden w-24 shrink-0 text-right text-muted-foreground sm:block">
        {detail}
      </span>
    </li>
  );
}
