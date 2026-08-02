"use client";

import { MarketCard } from "@/components/dashboard/market-card";
import { PriceChart } from "@/components/dashboard/price-chart";
import { useLoadedSnapshot } from "@/components/snapshot-provider";

/**
 * Market view — "what is the market doing?". The chart leads at two-thirds width;
 * the per-symbol cards support it in a column that divides the same height evenly.
 */
export default function MarketPage() {
  const { snapshot } = useLoadedSnapshot();
  const quoteAgeBySymbol = new Map(
    snapshot.status.map((s) => [
      s.symbol,
      s.tickerUpdatedAt != null ? Math.max(0, snapshot.ts - s.tickerUpdatedAt) : null,
    ]),
  );

  return (
    <main className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-3">
      <section className="min-h-0 lg:col-span-2">
        <PriceChart />
      </section>

      <section className="flex min-h-0 flex-col gap-4">
        {snapshot.market.map((m, i) => (
          <div key={m.symbol} className="min-h-0 flex-1">
            <MarketCard
              metrics={m}
              series={(snapshot.series[m.symbol] ?? []).map((p) => p.close)}
              quoteAge={quoteAgeBySymbol.get(m.symbol) ?? null}
              delay={i * 60}
            />
          </div>
        ))}
      </section>
    </main>
  );
}
