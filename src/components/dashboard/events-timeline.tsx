"use client";

import { Card } from "@/components/ui/card";
import { fmtClock } from "@/lib/format";
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

const LABEL: Record<PipelineEventType, string> = {
  ws_connect: "WS connect",
  ws_disconnect: "WS disconnect",
  backfill_start: "Backfill start",
  backfill_done: "Backfill done",
  gap_filled: "Gap filled",
  reconcile: "Reconcile",
  error: "Error",
};

export function EventsTimeline({ events }: { events: PipelineEvent[] }) {
  return (
    <Card className="animate-fade-up" style={{ animationDelay: "200ms" }}>
      <div className="border-b border-border p-4">
        <div className="label">Operations Log</div>
        <div className="font-serif text-lg italic text-foreground">Pipeline events</div>
      </div>
      <div className="max-h-[300px] overflow-auto">
        {events.length === 0 ? (
          <div className="p-4 text-xs text-muted-foreground">No events yet.</div>
        ) : (
          <ul className="divide-y divide-border/50">
            {events.map((e) => (
              <li key={e.id} className="flex items-center gap-3 px-4 py-2 text-xs">
                <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", DOT[e.type])} />
                <span className="tnum w-16 shrink-0 text-muted-foreground">
                  {fmtClock(e.ts)}
                </span>
                <span className="w-14 shrink-0 text-foreground">
                  {e.symbol.replace("USDT", "")}
                </span>
                <span className="w-28 shrink-0 text-muted-foreground">{LABEL[e.type]}</span>
                <span className="truncate text-muted-foreground/80">
                  {e.detail}
                  {e.count > 0 ? ` · ${e.count}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
