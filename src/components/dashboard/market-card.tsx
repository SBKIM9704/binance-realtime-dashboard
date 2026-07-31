"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { useApp } from "@/components/providers";
import { fmtCompact, fmtPrice } from "@/lib/format";
import type { TKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { MarketMetrics } from "@/lib/types";
import { Sparkline } from "./sparkline";

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
  const { vwap24h, high24h, low24h, bid, ask, spreadPct } = metrics;
  const up = (changePct24h ?? 0) >= 0;
  const { t } = useApp();
  const rawName = t(`asset.${symbol}` as TKey);
  const assetName = rawName.startsWith("asset.") ? symbol : rawName;

  // Flash the price briefly on each change to signal live updates.
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const prev = useRef<number | null>(lastPrice);
  useEffect(() => {
    if (lastPrice != null && prev.current != null && lastPrice !== prev.current) {
      setFlash(lastPrice > prev.current ? "up" : "down");
      const timer = setTimeout(() => setFlash(null), 600);
      prev.current = lastPrice;
      return () => clearTimeout(timer);
    }
    prev.current = lastPrice;
  }, [lastPrice]);

  return (
    <Card
      className="grain animate-fade-up overflow-hidden"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between p-5 pb-3">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="font-sans font-semibold text-2xl leading-none text-foreground">
              {symbol.replace("USDT", "")}
            </span>
            <span className="label">/ USDT · {assetName}</span>
          </div>

          {/* Price hero */}
          <div
            className={cn(
              "tnum mt-3 text-4xl font-medium tracking-tight transition-colors",
              flash === "up" && "text-[hsl(var(--success))]",
              flash === "down" && "text-[hsl(var(--danger))]",
            )}
          >
            <span className="text-xl text-muted-foreground">$</span>
            {fmtPrice(lastPrice)}
          </div>

          {/* Subtle bid/ask line */}
          <div className="tnum mt-2 text-[11px] text-muted-foreground">
            {t("market.bid")} {fmtPrice(bid)} · {t("market.ask")} {fmtPrice(ask)}
            {spreadPct != null && ` · ${t("market.spread")} ${spreadPct.toFixed(3)}%`}
          </div>
        </div>

        <span
          className={cn(
            "tnum rounded-sm px-2 py-1 text-base font-medium",
            up ? "text-[hsl(var(--success))]" : "text-[hsl(var(--danger))]",
            up ? "bg-[hsl(var(--success)/0.1)]" : "bg-[hsl(var(--danger)/0.1)]",
          )}
        >
          {changePct24h != null ? `${up ? "+" : ""}${changePct24h.toFixed(2)}%` : "—"}
        </span>
      </div>

      <div className="px-3">
        <Sparkline
          data={series}
          width={340}
          height={44}
          color={up ? "hsl(var(--success))" : "hsl(var(--danger))"}
        />
      </div>

      {/* Compact, low-contrast secondary metrics */}
      <div className="mt-3 grid grid-cols-3 gap-x-4 gap-y-3 border-t border-border px-5 py-4">
        <MiniStat label={t("market.high24h")} value={fmtPrice(high24h)} />
        <MiniStat label={t("market.low24h")} value={fmtPrice(low24h)} />
        <MiniStat label={t("market.vwap")} value={fmtPrice(vwap24h)} />
        <MiniStat label={t("market.volume")} value={fmtCompact(volume24h)} />
        <MiniStat
          label={t("market.volatility")}
          value={volatility != null ? `${(volatility * 100).toFixed(2)}%` : "—"}
        />
      </div>
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="tnum mt-0.5 text-sm text-foreground/90">{value}</div>
    </div>
  );
}
