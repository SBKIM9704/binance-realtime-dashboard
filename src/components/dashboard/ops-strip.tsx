"use client";

import { Badge } from "@/components/ui/badge";
import { LiveDot } from "./live-dot";
import { fmtDuration, fmtInt, fmtTimeAgo } from "@/lib/format";
import type { DashboardSnapshot } from "@/lib/types";
import { cn } from "@/lib/utils";

type Status = DashboardSnapshot["status"][number];

/** Classify ingestion lag into a health tier. */
function lagTier(lagMs: number | null): "success" | "warning" | "danger" {
  if (lagMs == null) return "warning";
  if (lagMs <= 90_000) return "success";
  if (lagMs <= 300_000) return "warning";
  return "danger";
}

function Cell({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("bg-card px-4 py-3", className)}>
      <div className="label">{label}</div>
      <div className="tnum mt-1.5 text-sm text-foreground">{children}</div>
    </div>
  );
}

export function OpsStrip({ snapshot, now }: { snapshot: DashboardSnapshot; now: number }) {
  const status = snapshot.status;
  const totalRecords = status.reduce((a, s) => a + s.totalRecords, 0);
  const backfilled = status.reduce((a, s) => a + s.backfilledCount, 0);
  const gapsFilled = status.reduce((a, s) => a + s.gapsFilled, 0);
  const gapsDetected = status.reduce((a, s) => a + s.gapsDetected, 0);
  const errors = status.reduce((a, s) => a + s.errorCount, 0);
  const lastReconcile = status.reduce<number | null>(
    (a, s) => Math.max(a ?? 0, s.reconcileLastRun ?? 0) || null,
    null,
  );

  return (
    <div className="grid grid-cols-2 gap-px rounded-lg border border-border bg-border sm:grid-cols-3 lg:grid-cols-6">
      {status.map((s: Status) => (
        <Cell key={s.symbol} label={`${s.symbol} · WS / Lag`}>
          <div className="flex items-center gap-2">
            <LiveDot live={s.wsConnected === 1} />
            <Badge variant={s.wsConnected === 1 ? "success" : "danger"}>
              {s.wsConnected === 1 ? "Live" : "Down"}
            </Badge>
            <span
              className={cn(
                "ml-auto",
                lagTier(s.lagMs) === "success" && "text-[hsl(var(--success))]",
                lagTier(s.lagMs) === "warning" && "text-[hsl(var(--warning))]",
                lagTier(s.lagMs) === "danger" && "text-[hsl(var(--danger))]",
              )}
            >
              {fmtDuration(s.lagMs)}
            </span>
          </div>
        </Cell>
      ))}

      <Cell label="Total Records">{fmtInt(totalRecords)}</Cell>
      <Cell label="Backfilled">{fmtInt(backfilled)}</Cell>
      <Cell label="Gaps Filled / Seen">
        <span className={gapsDetected > 0 ? "text-[hsl(var(--warning))]" : undefined}>
          {fmtInt(gapsFilled)} / {fmtInt(gapsDetected)}
        </span>
      </Cell>
      <Cell label="Errors">
        <span className={errors > 0 ? "text-[hsl(var(--danger))]" : undefined}>
          {fmtInt(errors)}
        </span>
      </Cell>
      <Cell label="Last Reconcile">{fmtTimeAgo(lastReconcile, now)}</Cell>
    </div>
  );
}
