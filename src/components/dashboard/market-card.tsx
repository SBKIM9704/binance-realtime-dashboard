"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { useApp } from "@/components/providers";
import { fmtBps, fmtCompact, fmtDuration, fmtPct, fmtPrice, spreadTicks } from "@/lib/format";
import { tickSizeFor } from "@/lib/market-meta";
import type { TKey } from "@/lib/i18n";
import { INTERVAL_TO_MS } from "@/lib/intervals";
import { trendBg, trendText, trendVar } from "@/lib/trend";
import { cn } from "@/lib/utils";
import type { MarketMetrics } from "@/lib/types";
import { Sparkline } from "./sparkline";

/** A quote older than this is no longer top of book. */
const QUOTE_STALE_MS = 5_000;

/** VOL_CANDLES (60) samples of `interval`, expressed as a human window. */
function intervalWindowLabel(
  interval: string,
  t: (k: TKey, vars?: Record<string, string>) => string,
): string {
  const ms = (INTERVAL_TO_MS[interval] ?? 1_000) * 60;
  if (ms >= 3_600_000) return t("interval.h", { n: String(Math.round(ms / 3_600_000)) });
  if (ms >= 60_000) return t("interval.m", { n: String(Math.round(ms / 60_000)) });
  return t("interval.s", { n: String(Math.round(ms / 1_000)) });
}

export function MarketCard({
  metrics,
  series,
  quoteAge,
  delay = 0,
}: {
  metrics: MarketMetrics;
  series: number[];
  /** Age of the bid/ask quote in ms, or null when never received. */
  quoteAge: number | null;
  delay?: number;
}) {
  const { symbol, lastPrice, changePct24h, volume24h, volatility } = metrics;
  const { vwap24h, high24h, low24h, bid, ask, spreadPct, source } = metrics;
  const up = (changePct24h ?? 0) >= 0;
  const { t, lang } = useApp();

  const ticks = spreadTicks(bid, ask, tickSizeFor(symbol));
  const quoteStale = quoteAge != null && quoteAge > QUOTE_STALE_MS;
  // Volatility is VOL_CANDLES samples of whichever tier answered, so the label
  // states the real window rather than letting the reader assume 24h.
  const volWindow = source ? intervalWindowLabel(source, t) : "";
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
      className="grain motion-safe:animate-fade-up flex h-full flex-col overflow-hidden"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex shrink-0 items-start justify-between p-4 pb-2">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="font-sans text-xl font-semibold leading-none text-foreground">
              {symbol.replace("USDT", "")}
            </span>
            <span className="label">/ USDT · {assetName}</span>
          </div>

          {/* Price hero */}
          <div
            className={cn(
              "tnum mt-1.5 text-3xl font-medium tracking-tight transition-colors",
              flash === "up" && trendText(lang, true),
              flash === "down" && trendText(lang, false),
            )}
          >
            <span className="text-lg text-muted-foreground">$</span>
            {fmtPrice(lastPrice)}
          </div>

          {/* Top of book. Carries its own age: without it a dead collector shows
              the last quote indefinitely as though it were current. */}
          <div className="tnum mt-2 flex flex-wrap items-baseline gap-x-2 text-xs text-foreground/80">
            <span>
              <span className="text-muted-foreground">{t("market.bid")} </span>
              {fmtPrice(bid)}
            </span>
            <span className="text-muted-foreground/50">/</span>
            <span>
              <span className="text-muted-foreground">{t("market.ask")} </span>
              {fmtPrice(ask)}
            </span>
            {ticks != null && (
              <span className="text-muted-foreground">
                {t("market.spread")} {t("market.ticks", { n: String(ticks) })}
                {spreadPct != null && ` · ${spreadPct.toFixed(3)}%`}
              </span>
            )}
            {quoteAge != null && (
              <span className={cn("text-[11px]", quoteStale ? "text-danger" : "text-muted-foreground")}>
                {fmtDuration(quoteAge)}
              </span>
            )}
          </div>
        </div>

        <span
          className={cn(
            "tnum rounded-sm px-2 py-1 text-base font-medium",
            trendText(lang, up),
            trendBg(lang, up),
          )}
        >
          {fmtPct(changePct24h)}
        </span>
      </div>

      {/* Absorbs the card's slack height, so a column of cards fills its track
          instead of leaving dead space under the last one. */}
      <div className="min-h-[34px] flex-1 px-3 py-2">
        <Sparkline
          data={series}
          width={340}
          height={34}
          color={`hsl(var(${trendVar(lang, up)}))`}
          className="h-full w-full"
        />
      </div>

      {/* Compact, low-contrast secondary metrics */}
      <div className="grid shrink-0 grid-cols-3 gap-x-4 gap-y-2 border-t border-border px-4 py-3">
        <MiniStat label={t("market.high24h")} value={fmtPrice(high24h)} />
        <MiniStat label={t("market.low24h")} value={fmtPrice(low24h)} />
        <MiniStat label={t("market.vwap")} value={fmtPrice(vwap24h)} />
        <MiniStat label={t("market.volume")} value={fmtCompact(volume24h)} />
        {/* The window is in the label: this is a short-horizon estimate, sitting in
            a row of 24h figures where the reader would otherwise assume 24h. */}
        <MiniStat
          label={t("market.volatility", { window: volWindow })}
          value={fmtBps(volatility)}
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
