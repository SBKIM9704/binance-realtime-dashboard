"use client";

import { useEffect, useState } from "react";
import { EventsTimeline } from "@/components/dashboard/events-timeline";
import { LiveDot } from "@/components/dashboard/live-dot";
import { MarketCard } from "@/components/dashboard/market-card";
import { OpsStrip } from "@/components/dashboard/ops-strip";
import { PriceChart } from "@/components/dashboard/price-chart";
import { RecentTable } from "@/components/dashboard/recent-table";
import { useSnapshot } from "@/hooks/useSnapshot";
import { fmtClock } from "@/lib/format";

export default function DashboardPage() {
  const { snapshot, connected } = useSnapshot();
  const [clock, setClock] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const symbols = snapshot ? snapshot.market.map((m) => m.symbol) : [];

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-6 lg:px-8 lg:py-8">
      {/* Header */}
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="label">Aria Desk</span>
            <span className="h-3 w-px bg-border" />
            <span className="label">Binance Ops</span>
          </div>
          <h1 className="mt-1 font-serif text-4xl italic tracking-tight text-foreground">
            Realtime Trade Collection
          </h1>
        </div>

        <div className="flex items-center gap-5">
          <div className="text-right">
            <div className="label">Stream</div>
            <div className="mt-1 flex items-center justify-end gap-2 text-sm">
              <LiveDot live={connected} />
              <span className={connected ? "text-[hsl(var(--success))]" : "text-[hsl(var(--danger))]"}>
                {connected ? "Connected" : "Reconnecting"}
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="label">Local Time</div>
            <div className="tnum mt-1 text-sm text-foreground">{fmtClock(clock)}</div>
          </div>
        </div>
      </header>

      {!snapshot ? (
        <LoadingState />
      ) : (
        <div className="space-y-4">
          {/* Market cards */}
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {snapshot.market.map((m, i) => (
              <MarketCard
                key={m.symbol}
                metrics={m}
                series={(snapshot.series[m.symbol] ?? []).map((p) => p.close)}
                delay={i * 60}
              />
            ))}
          </section>

          {/* Ops metrics */}
          <section>
            <OpsStrip snapshot={snapshot} now={snapshot.ts} />
          </section>

          {/* Chart */}
          <section>
            <PriceChart snapshot={snapshot} />
          </section>

          {/* Log + raw feed */}
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <EventsTimeline events={snapshot.events} />
            <RecentTable symbols={symbols} refreshKey={Math.floor(snapshot.ts / 3000)} />
          </section>

          <footer className="pt-4 text-center text-[11px] text-muted-foreground">
            Data collected from Binance public market streams · updated{" "}
            {fmtClock(snapshot.ts)} · SSE push @ 1s
          </footer>
        </div>
      )}
    </main>
  );
}

function LoadingState() {
  return (
    <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-muted-foreground">
      <LiveDot live />
      <p className="font-serif text-xl italic">Waiting for the first snapshot…</p>
      <p className="text-xs">
        Make sure the collector is running (<code>npm run dev</code>).
      </p>
    </div>
  );
}
