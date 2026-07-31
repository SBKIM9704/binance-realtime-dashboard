"use client";

import { useEffect, useState } from "react";
import { Controls } from "@/components/dashboard/controls";
import { EventsTimeline } from "@/components/dashboard/events-timeline";
import { LiveDot } from "@/components/dashboard/live-dot";
import { MarketCard } from "@/components/dashboard/market-card";
import { OpsStrip } from "@/components/dashboard/ops-strip";
import { PanelTabs, type TabDef } from "@/components/dashboard/panel-tabs";
import { PriceChart } from "@/components/dashboard/price-chart";
import { RecentTable } from "@/components/dashboard/recent-table";
import { StatusRibbon } from "@/components/dashboard/status-ribbon";
import { SystemStrip } from "@/components/dashboard/system-strip";
import { useApp } from "@/components/providers";
import { useSnapshot } from "@/hooks/useSnapshot";
import { fmtClock } from "@/lib/format";

export default function DashboardPage() {
  const { snapshot, connected } = useSnapshot();
  const { t } = useApp();
  const [clock, setClock] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const symbols = snapshot ? snapshot.market.map((m) => m.symbol) : [];

  const tabs: TabDef[] = snapshot
    ? [
        {
          key: "events",
          label: t("events.title"),
          content: <EventsTimeline events={snapshot.events} />,
        },
        {
          key: "recent",
          label: t("table.title"),
          content: <RecentTable symbols={symbols} refreshKey={Math.floor(snapshot.ts / 3000)} />,
        },
        {
          key: "diag",
          label: t("diagnostics.title"),
          content: (
            <div className="space-y-4 p-4">
              <SystemStrip system={snapshot.system} />
              <OpsStrip snapshot={snapshot} now={snapshot.ts} />
            </div>
          ),
        },
      ]
    : [];

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-[1600px] flex-col gap-4 px-4 py-4 lg:h-[100dvh] lg:overflow-hidden lg:px-6">
      {/* Header */}
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="label">Aria Desk</span>
            <span className="h-3 w-px bg-border" />
            <span className="label">Binance</span>
          </div>
          <h1 className="mt-0.5 font-sans text-2xl font-semibold tracking-tight text-foreground">
            {t("header.title")}
          </h1>
        </div>

        <div className="flex items-center gap-5">
          <div className="text-right">
            <div className="label">{t("header.stream")}</div>
            <div className="mt-1 flex items-center justify-end gap-2 text-sm">
              <LiveDot live={connected} />
              <span className={connected ? "text-[hsl(var(--success))]" : "text-[hsl(var(--danger))]"}>
                {connected ? t("header.connected") : t("header.reconnecting")}
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="label">{t("header.localTime")}</div>
            <div className="tnum mt-1 text-sm text-foreground">{fmtClock(clock)}</div>
          </div>
          <Controls />
        </div>
      </header>

      {!snapshot ? (
        <LoadingState />
      ) : (
        <>
          {/* At-a-glance health summary */}
          <StatusRibbon snapshot={snapshot} />

          {/* Main: chart (hero) + market cards */}
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-3">
            <section className="min-h-0 lg:col-span-2">
              <PriceChart snapshot={snapshot} />
            </section>
            <section className="flex min-h-0 flex-col gap-4 lg:overflow-auto">
              {snapshot.market.map((m, i) => (
                <MarketCard
                  key={m.symbol}
                  metrics={m}
                  series={(snapshot.series[m.symbol] ?? []).map((p) => p.close)}
                  delay={i * 60}
                />
              ))}
            </section>
          </div>

          {/* Secondary panels tucked into tabs */}
          <PanelTabs tabs={tabs} className="h-[230px] shrink-0" />
        </>
      )}
    </main>
  );
}

function LoadingState() {
  const { t } = useApp();
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
      <LiveDot live />
      <p className="font-sans text-xl font-semibold">{t("loading.title")}</p>
      <p className="text-xs">
        {t("loading.hint")} (<code>npm run dev</code>).
      </p>
    </div>
  );
}
