import type { Tier } from "@/lib/thresholds";
import { cn } from "@/lib/utils";

/** Maps a health tier to a text colour (green / amber / red). */
export const tierColor: Record<Tier, string> = {
  ok: "text-[hsl(var(--success))]",
  warn: "text-[hsl(var(--warning))]",
  crit: "text-[hsl(var(--danger))]",
};

/** A single labelled metric cell, optionally coloured by health tier. */
export function Stat({
  label,
  children,
  tier,
  className,
}: {
  label: string;
  children: React.ReactNode;
  tier?: Tier;
  className?: string;
}) {
  return (
    <div className={cn("bg-card px-4 py-3", className)}>
      <div className="label">{label}</div>
      <div className={cn("tnum mt-1.5 text-sm", tier ? tierColor[tier] : "text-foreground")}>
        {children}
      </div>
    </div>
  );
}
