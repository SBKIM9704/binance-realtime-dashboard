"use client";

import { useApp } from "@/components/providers";
import { fmtBytes, fmtInt, fmtUptime } from "@/lib/format";
import { errorRateTier, weightTier } from "@/lib/thresholds";
import type { DashboardSnapshot } from "@/lib/types";
import { Stat } from "./stat";

/** System tier — collector process resources + REST API usage. */
export function SystemStrip({ system }: { system: DashboardSnapshot["system"] }) {
  const { t } = useApp();
  const weightPct =
    system.weightLimit > 0 ? Math.round((system.usedWeight / system.weightLimit) * 100) : 0;

  return (
    <div>
      <div className="label mb-2">{t("system.title")}</div>
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4 lg:grid-cols-8">
        <Stat label={t("system.cpu")}>{system.cpuPct.toFixed(1)}%</Stat>
        <Stat label={t("system.ram")}>{fmtBytes(system.rssBytes)}</Stat>
        <Stat label={t("system.uptime")}>{fmtUptime(system.uptimeSec)}</Stat>
        <Stat label={t("system.restRate")}>{system.restCallsRate.toFixed(0)}</Stat>
        <Stat label={t("system.weight")} tier={weightTier(system.usedWeight, system.weightLimit)}>
          {fmtInt(system.usedWeight)}/{fmtInt(system.weightLimit)} · {weightPct}%
        </Stat>
        <Stat label={t("system.retry")}>{fmtInt(system.restRetryCount)}</Stat>
        <Stat
          label={t("system.rateLimited")}
          tier={errorRateTier(system.rateLimitedCount)}
        >
          {fmtInt(system.rateLimitedCount)}
        </Stat>
        <Stat
          label={t("system.serverErr")}
          tier={system.serverErrorCount > 0 ? "warn" : "ok"}
        >
          {fmtInt(system.serverErrorCount)}
        </Stat>
      </div>
    </div>
  );
}
