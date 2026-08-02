"use client";

import { useApp } from "@/components/providers";
import { useDashboardSnapshot } from "@/components/snapshot-provider";
import { fmtDuration, fmtInt, fmtPct, fmtPrice } from "@/lib/format";
import {
  errorRateTier,
  lagTier,
  msgRateTier,
  recoveryTier,
  weightTier,
  wsTier,
  type Tier,
} from "@/lib/thresholds";
import { trendText } from "@/lib/trend";
import type { DashboardSnapshot } from "@/lib/types";
import { cn } from "@/lib/utils";
import { tierColor, tierDot, tierLabel, worstTier } from "./stat";

/**
 * Always-on, single-row health summary — the "is everything OK?" glance.
 * Rendered by the shell so it is present on every view; per-metric detail lives
 * on /ops.
 */
export function StatusRibbon({ snapshot }: { snapshot: DashboardSnapshot }) {
  const { t, lang } = useApp();
  const { stale, staleMs } = useDashboardSnapshot();
  const { status, market, system } = snapshot;

  const worstLag = status.reduce<number | null>(
    (a, s) => (s.lagMs != null ? Math.max(a ?? 0, s.lagMs) : a),
    null,
  );
  const totalMsgRate = status.reduce((a, s) => a + s.wsMsgRate, 0);
  const totalDetected = status.reduce((a, s) => a + s.gapsDetected, 0);
  const totalFilled = status.reduce((a, s) => a + s.gapsFilled, 0);
  const recovery = totalDetected > 0 ? (totalFilled / totalDetected) * 100 : 100;

  // Overall health = worst tier across every monitored signal. A stale frame
  // outranks all of them: the signals below describe a moment that has passed, so
  // deriving "정상" from them would be reporting the past as the present.
  const overall: Tier = stale
    ? "crit"
    : worstTier([
        ...status.map((s) => wsTier(s.wsConnected === 1)),
        ...status.map((s) => msgRateTier(s.wsConnected === 1, s.wsMsgRate)),
        lagTier(worstLag),
        recoveryTier(recovery),
        weightTier(system.usedWeight, system.weightLimit),
        errorRateTier(system.errorsLastMin),
      ]);

  const overallLabel = stale
    ? t("ribbon.disconnected", { age: fmtDuration(staleMs) })
    : overall === "ok"
      ? t("ribbon.healthy")
      : overall === "warn"
        ? t("ribbon.degraded")
        : t("ribbon.critical");

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border bg-card px-4 py-3",
        overall === "crit" ? "border-danger/50" : "border-border",
      )}
    >
      {/* Overall health pill. `aria-live` because this is the one line whose change
          a screen-reader user must hear without polling the page. */}
      <div className="flex items-center gap-2" role="status" aria-live="polite">
        {/* The dot pulses on every tier — it used to go still exactly when things
            went critical, removing motion at the one moment it should draw the eye. */}
        <span className={cn("h-2 w-2 rounded-full motion-safe:animate-pulse-dot", tierDot[overall])} />
        <span className="label">{t("ribbon.status")}</span>
        <span className={cn("text-sm font-medium", tierColor[overall])}>{overallLabel}</span>
      </div>

      <span className="hidden h-4 w-px bg-border sm:block" />

      {/* Per-symbol quick glance */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {market.map((m) => {
          const st = status.find((s) => s.symbol === m.symbol);
          const dotTier = worstTier([
            wsTier(st?.wsConnected === 1),
            msgRateTier(st?.wsConnected === 1, st?.wsMsgRate ?? 0),
          ]);
          const up = (m.changePct24h ?? 0) >= 0;
          return (
            <div key={m.symbol} className="flex items-baseline gap-2">
              {/* The dot was the only per-symbol health signal on this route and it
                  was colour alone. The title gives it a name for every reader. */}
              <span
                className={cn("h-1.5 w-1.5 self-center rounded-full", tierDot[dotTier])}
                role="img"
                aria-label={`${m.symbol}: ${tierLabel(dotTier, t)}`}
                title={tierLabel(dotTier, t)}
              />
              <span className="text-xs text-muted-foreground">{m.symbol.replace("USDT", "")}</span>
              <span className="tnum text-sm text-foreground">${fmtPrice(m.lastPrice)}</span>
              <span className={cn("tnum text-xs", trendText(lang, up))}>
                {fmtPct(m.changePct24h)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Right-aligned micro metrics */}
      <div className="ml-auto flex items-center gap-x-5 gap-y-2 tnum text-xs">
        <Micro label={t("pipeline.lag")} tier={lagTier(worstLag)}>
          {fmtDuration(worstLag)}
        </Micro>
        <Micro label={t("system.weight")} tier={weightTier(system.usedWeight, system.weightLimit)}>
          {fmtInt(system.usedWeight)}/{fmtInt(system.weightLimit)}
        </Micro>
        <Micro label={t("pipeline.msgRate")}>{totalMsgRate.toFixed(0)}</Micro>
      </div>
    </div>
  );
}

function Micro({
  label,
  tier,
  children,
}: {
  label: string;
  tier?: Tier;
  children: React.ReactNode;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="label">{label}</span>
      <span className={tier ? tierColor[tier] : "text-foreground"}>{children}</span>
    </span>
  );
}
