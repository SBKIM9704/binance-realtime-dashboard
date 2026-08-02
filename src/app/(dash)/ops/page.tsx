"use client";

import { EventsTimeline } from "@/components/dashboard/events-timeline";
import { OpsHero } from "@/components/dashboard/ops-hero";
import { OpsStrip } from "@/components/dashboard/ops-strip";
import { Panel } from "@/components/dashboard/panel";
import { RecentTable } from "@/components/dashboard/recent-table";
import { SymbolTabs } from "@/components/dashboard/toggle-group";
import { SystemStrip } from "@/components/dashboard/system-strip";
import { useApp } from "@/components/providers";
import { useLoadedSnapshot } from "@/components/snapshot-provider";

/**
 * Operations view — "is the pipeline healthy?". Laid out in the operator's gaze
 * order (System → Pipeline → evidence): the two metric strips are fixed bands at
 * the top, and the unbounded evidence below them sits side by side so the event
 * stream and the stored candles can be read against each other. Nothing is behind
 * a tab: every required metric is on screen at once.
 */
export default function OpsPage() {
  const { snapshot, symbol, setSymbol } = useLoadedSnapshot();
  const { t } = useApp();

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-4">
      {/* The four budgeted signals, large. Everything below is reference detail. */}
      <OpsHero snapshot={snapshot} />

      {/* Secondary band: complete, but visibly subordinate to the hero above, so the
          page has a primary instead of 23 tiles competing at identical weight. */}
      <div className="space-y-3 text-muted-foreground [&_dd]:text-[13px]">
        <SystemStrip system={snapshot.system} />
        <OpsStrip snapshot={snapshot} now={snapshot.ts} />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title={t("events.title")}>
          <EventsTimeline events={snapshot.events} />
        </Panel>

        <Panel
          title={t("table.title")}
          action={<SymbolTabs symbols={snapshot.symbols} active={symbol} onSelect={setSymbol} />}
        >
          <RecentTable symbol={symbol} refreshKey={Math.floor(snapshot.ts / 3000)} />
        </Panel>
      </div>
    </main>
  );
}
