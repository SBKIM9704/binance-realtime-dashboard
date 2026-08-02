"use client";

import { useApp } from "@/components/providers";
import { Badge } from "@/components/ui/badge";
import { fmtClock, fmtDuration, fmtInt, fmtTimeAgo } from "@/lib/format";
import { THRESHOLD_LABEL, errorRateTier, lagTier, msgRateTier, recoveryTier } from "@/lib/thresholds";
import type { DashboardSnapshot } from "@/lib/types";
import { LiveDot } from "./live-dot";
import { Stat } from "./stat";

/** Pipeline tier — per-symbol ingestion health + aggregate recovery/error metrics. */
export function OpsStrip({ snapshot, now }: { snapshot: DashboardSnapshot; now: number }) {
  const { t } = useApp();
  const status = snapshot.status;

  const totalRecords = status.reduce((a, s) => a + s.totalRecords, 0);
  const liveRecords = status.reduce((a, s) => a + s.liveRecords, 0);
  const backfilled = status.reduce((a, s) => a + s.backfilledCount, 0);
  const gapsFilled = status.reduce((a, s) => a + s.gapsFilled, 0);
  const gapsDetected = status.reduce((a, s) => a + s.gapsDetected, 0);
  const reconnects = status.reduce((a, s) => a + s.reconnectCount, 0);
  const aggRecovery = gapsDetected > 0 ? (gapsFilled / gapsDetected) * 100 : 100;
  const lastReconcile =
    status.reduce<number | null>((a, s) => Math.max(a ?? 0, s.reconcileLastRun ?? 0) || null, null);

  return (
    <div>
      <h2 className="label mb-2">{t("pipeline.title")}</h2>

      {/* Per-symbol ingestion health */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border lg:grid-cols-4">
        {status.map((s) => [
          <Stat key={`${s.symbol}-ws`} label={`${s.symbol} · ${t("pipeline.ws")}`}>
            <div className="flex items-center gap-2">
              <LiveDot live={s.wsConnected === 1} />
              <Badge variant={s.wsConnected === 1 ? "success" : "danger"}>
                {s.wsConnected === 1 ? t("ops.live") : t("ops.down")}
              </Badge>
            </div>
          </Stat>,
          <Stat
            key={`${s.symbol}-rate`}
            label={`${s.symbol} · ${t("pipeline.msgRate")}`}
            tier={msgRateTier(s.wsConnected === 1, s.wsMsgRate)}
          >
            {s.wsMsgRate.toFixed(1)}
          </Stat>,
          <Stat
            key={`${s.symbol}-lag`}
            label={`${s.symbol} · ${t("pipeline.lag")}`}
            tier={lagTier(s.lagMs)}
          >
            {fmtDuration(s.lagMs)}
          </Stat>,
          <Stat key={`${s.symbol}-last`} label={`${s.symbol} · ${t("pipeline.lastMessage")}`}>
            {fmtClock(s.lastMessageAt)}
          </Stat>,
        ])}
      </div>

      {/* Aggregate recovery / errors / counters */}
      <div className="mt-2 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3 lg:grid-cols-7">
        <Stat label={t("pipeline.recoveryRate")} tier={recoveryTier(aggRecovery)}>
          {aggRecovery.toFixed(1)}%
        </Stat>
        <Stat label={t("pipeline.detectedRecovered")}>
          {fmtInt(gapsDetected)} / {fmtInt(gapsFilled)}
        </Stat>
        <Stat label={t("pipeline.reconnect")}>{fmtInt(reconnects)}</Stat>
        <Stat
          label={t("pipeline.errorsPerMin")}
          tier={errorRateTier(snapshot.system.errorsLastMin)}
          threshold={THRESHOLD_LABEL.errorRate}
        >
          {fmtInt(snapshot.system.errorsLastMin)}
        </Stat>
        <Stat label={t("ops.backfilled")}>{fmtInt(backfilled)}</Stat>
        <Stat label={t("ops.totalRecords")} threshold={t("ops.liveRecords", { n: fmtInt(liveRecords) })}>
          {fmtInt(totalRecords)}
        </Stat>
        <Stat label={t("ops.lastReconcile")}>
          {fmtTimeAgo(lastReconcile, now, (age) => t("time.ago", { age }))}
        </Stat>
      </div>
    </div>
  );
}
