"use client";

import { useApp } from "@/components/providers";
import { fmtClock } from "@/lib/format";
import type { TKey } from "@/lib/i18n";
import type { PipelineEvent, PipelineEventType } from "@/lib/types";
import { cn } from "@/lib/utils";

const DOT: Record<PipelineEventType, string> = {
  ws_connect: "bg-[hsl(var(--success))]",
  ws_disconnect: "bg-[hsl(var(--danger))]",
  backfill_start: "bg-[hsl(var(--muted-foreground))]",
  backfill_done: "bg-primary",
  gap_filled: "bg-[hsl(var(--warning))]",
  reconcile: "bg-[hsl(var(--muted-foreground))]",
  error: "bg-[hsl(var(--danger))]",
};

/** Pipeline event list (rendered inside a tab). */
export function EventsTimeline({ events }: { events: PipelineEvent[] }) {
  const { t } = useApp();

  if (events.length === 0) {
    return <div className="p-4 text-xs text-muted-foreground">{t("events.empty")}</div>;
  }

  return (
    <ul className="divide-y divide-border/50">
      {events.map((e) => (
        <li key={e.id} className="flex items-center gap-3 px-4 py-2 text-xs">
          <span
            className={cn("h-1.5 w-1.5 shrink-0 rounded-full", DOT[e.type])}
            aria-hidden
          />
          <span className="tnum w-16 shrink-0 text-muted-foreground">{fmtClock(e.ts)}</span>
          <span className="w-14 shrink-0 text-foreground">{e.symbol.replace("USDT", "")}</span>
          <span className="w-28 shrink-0 text-muted-foreground">
            {t(`event.${e.type}` as TKey)}
          </span>
          <span className="truncate text-muted-foreground">
            {e.detail}
            {e.count > 0 ? ` · ${e.count}` : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}
