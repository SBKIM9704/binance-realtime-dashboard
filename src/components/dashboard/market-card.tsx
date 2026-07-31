"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { fmtCompact, fmtPct, fmtPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MarketMetrics } from "@/lib/types";
import { Sparkline } from "./sparkline";

const BASE_ASSET: Record<string, string> = {
  BTCUSDT: "Bitcoin",
  ETHUSDT: "Ethereum",
};

export function MarketCard({
  metrics,
  series,
  delay = 0,
}: {
  metrics: MarketMetrics;
  series: number[];
  delay?: number;
}) {
  const { symbol, lastPrice, changePct24h, volume24h, volatility } = metrics;
  const up = (changePct24h ?? 0) >= 0;

  // Flash the price briefly on each change to signal live updates.
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const prev = useRef<number | null>(lastPrice);
  useEffect(() => {
    if (lastPrice != null && prev.current != null && lastPrice !== prev.current) {
      setFlash(lastPrice > prev.current ? "up" : "down");
      const t = setTimeout(() => setFlash(null), 600);
      prev.current = lastPrice;
      return () => clearTimeout(t);
    }
    prev.current = lastPrice;
  }, [lastPrice]);

  return (
    <Card
      className="grain animate-fade-up overflow-hidden"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between p-4 pb-2">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-2xl italic leading-none text-foreground">
              {symbol.replace("USDT", "")}
            </span>
            <span className="label">/ USDT</span>
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {BASE_ASSET[symbol] ?? symbol}
          </div>
        </div>
        <span
          className={cn(
            "rounded-sm px-2 py-1 text-sm font-medium tnum",
            up ? "text-[hsl(var(--success))]" : "text-[hsl(var(--danger))]",
            up ? "bg-[hsl(var(--success)/0.1)]" : "bg-[hsl(var(--danger)/0.1)]",
          )}
        >
          {fmtPct(changePct24h)}
        </span>
      </div>

      <div className="px-4">
        <div
          className={cn(
            "tnum text-3xl font-medium tracking-tight transition-colors",
            flash === "up" && "text-[hsl(var(--success))]",
            flash === "down" && "text-[hsl(var(--danger))]",
          )}
        >
          <span className="text-lg text-muted-foreground">$</span>
          {fmtPrice(lastPrice)}
        </div>
      </div>

      <div className="mt-2 px-2">
        <Sparkline
          data={series}
          width={320}
          height={48}
          color={up ? "hsl(var(--success))" : "hsl(var(--danger))"}
        />
      </div>

      <div className="grid grid-cols-2 gap-px border-t border-border bg-border">
        <Stat label="24h Volume (base)" value={fmtCompact(volume24h)} />
        <Stat
          label="Volatility (30m σ)"
          value={volatility != null ? `${(volatility * 100).toFixed(3)}%` : "—"}
        />
      </div>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card px-4 py-3">
      <div className="label">{label}</div>
      <div className="tnum mt-1 text-sm text-foreground">{value}</div>
    </div>
  );
}
