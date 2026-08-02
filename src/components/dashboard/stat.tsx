import type { TKey } from "@/lib/i18n";
import type { Tier } from "@/lib/thresholds";
import { cn } from "@/lib/utils";

/** Maps a health tier to a text colour (green / amber / red). */
export const tierColor: Record<Tier, string> = {
  ok: "text-[hsl(var(--success))]",
  warn: "text-[hsl(var(--warning))]",
  crit: "text-[hsl(var(--danger))]",
};

/** Maps a health tier to a background colour (for dots / pills). */
export const tierDot: Record<Tier, string> = {
  ok: "bg-[hsl(var(--success))]",
  warn: "bg-[hsl(var(--warning))]",
  crit: "bg-[hsl(var(--danger))]",
};

/** Human name for a tier, so a coloured dot can carry a text equivalent. */
export function tierLabel(tier: Tier, t: (k: TKey) => string): string {
  return t(tier === "ok" ? "ribbon.healthy" : tier === "warn" ? "ribbon.degraded" : "ribbon.critical");
}

/** Worst (most severe) tier across the given tiers. */
export function worstTier(tiers: Tier[]): Tier {
  const rank = { ok: 0, warn: 1, crit: 2 } as const;
  return tiers.reduce<Tier>((acc, t) => (rank[t] > rank[acc] ? t : acc), "ok");
}

/**
 * A single labelled metric cell, optionally coloured by health tier.
 *
 * Rendered as a description list pair so assistive tech reads "CPU: 0.4%" instead
 * of running every label and value on this page together into one sentence.
 * `threshold` prints the contract beside the value — a green "0.8s" means nothing
 * unless the reader also knows the bar was "<5s".
 */
export function Stat({
  label,
  children,
  tier,
  threshold,
  className,
}: {
  label: string;
  children: React.ReactNode;
  tier?: Tier;
  threshold?: string;
  className?: string;
}) {
  return (
    <dl className={cn("bg-card px-4 py-3", className)}>
      <dt className="label">{label}</dt>
      <dd
        className={cn(
          "tnum mt-1.5 flex items-baseline gap-1.5 text-sm",
          tier ? tierColor[tier] : "text-foreground",
        )}
      >
        {children}
        {threshold ? (
          <span className="text-[10px] font-normal text-muted-foreground">{threshold}</span>
        ) : null}
      </dd>
    </dl>
  );
}
