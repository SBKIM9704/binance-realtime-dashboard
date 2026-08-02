"use client";

import { useApp } from "@/components/providers";
import { fmtDuration, fmtInt } from "@/lib/format";
import {
  THRESHOLD_LABEL,
  lagTier,
  recoveryTier,
  weightTier,
  wsTier,
  type Tier,
} from "@/lib/thresholds";
import type { DashboardSnapshot } from "@/lib/types";
import { cn } from "@/lib/utils";
import { tierColor, tierDot, tierLabel, worstTier } from "./stat";

/**
 * The four signals that actually have a budget, at a size that answers "is anything
 * wrong?" from across the room.
 *
 * The rest of this view is 19 tiles at identical weight, which means it has no
 * primary — the reader has to read all of them to find the one that matters. These
 * four carry the thresholds the README advertises, printed beside the value so the
 * colour contract is verifiable on screen instead of in docs/dashboard-metrics.md.
 */
export function OpsHero({ snapshot }: { snapshot: DashboardSnapshot }) {
  const { t } = useApp();
  const { status, system } = snapshot;

  const worstLag = status.reduce<number | null>(
    (a, s) => (s.lagMs != null ? Math.max(a ?? 0, s.lagMs) : a),
    null,
  );
  const detected = status.reduce((a, s) => a + s.gapsDetected, 0);
  const filled = status.reduce((a, s) => a + s.gapsFilled, 0);
  const recovery = detected > 0 ? (filled / detected) * 100 : 100;
  const wsUp = status.filter((s) => s.wsConnected === 1).length;
  const weightPct =
    system.weightLimit > 0 ? Math.round((system.usedWeight / system.weightLimit) * 100) : 0;

  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border lg:grid-cols-4">
      <HeroStat
        label={t("pipeline.ws")}
        tier={worstTier(status.map((s) => wsTier(s.wsConnected === 1)))}
        value={`${wsUp}/${status.length}`}
        threshold={`${status.length}/${status.length}`}
      />
      <HeroStat
        label={t("pipeline.lag")}
        tier={lagTier(worstLag)}
        value={fmtDuration(worstLag)}
        threshold={THRESHOLD_LABEL.lag}
      />
      <HeroStat
        label={t("pipeline.recoveryRate")}
        tier={recoveryTier(recovery)}
        value={`${recovery.toFixed(1)}%`}
        threshold={THRESHOLD_LABEL.recovery}
      />
      <HeroStat
        label={t("system.weight")}
        tier={weightTier(system.usedWeight, system.weightLimit)}
        value={`${fmtInt(system.usedWeight)}/${fmtInt(system.weightLimit)} · ${weightPct}%`}
        threshold={THRESHOLD_LABEL.weight}
      />
    </div>
  );
}

function HeroStat({
  label,
  value,
  tier,
  threshold,
}: {
  label: string;
  value: string;
  tier: Tier;
  threshold: string;
}) {
  const { t } = useApp();
  return (
    <dl className="bg-card px-4 py-3">
      <dt className="label flex items-center gap-1.5">
        <span
          className={cn("h-1.5 w-1.5 rounded-full", tierDot[tier])}
          role="img"
          aria-label={tierLabel(tier, t)}
        />
        {label}
      </dt>
      <dd className={cn("tnum mt-1 text-xl font-medium", tierColor[tier])}>
        {value}
        <span className="ml-2 text-[10px] font-normal text-muted-foreground">{threshold}</span>
      </dd>
    </dl>
  );
}
