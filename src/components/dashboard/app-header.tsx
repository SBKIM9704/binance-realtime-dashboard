"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Controls } from "@/components/dashboard/controls";
import { LiveDot } from "@/components/dashboard/live-dot";
import { useApp } from "@/components/providers";
import { useDashboardSnapshot } from "@/components/snapshot-provider";
import { fmtClock } from "@/lib/format";
import type { TKey } from "@/lib/i18n";
import { wsTier } from "@/lib/thresholds";
import { cn } from "@/lib/utils";
import { tierColor } from "./stat";

const NAV: { href: string; label: TKey; hint: TKey }[] = [
  { href: "/", label: "nav.market", hint: "nav.marketHint" },
  { href: "/ops", label: "nav.ops", hint: "nav.opsHint" },
];

/**
 * Shell header: identity, view switcher, stream state, clock, preferences.
 * Fixed height so the views below can size themselves against the viewport.
 */
export function AppHeader() {
  const { t } = useApp();
  const { connected } = useDashboardSnapshot();
  const pathname = usePathname();
  const [clock, setClock] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-border pb-3">
      <div className="flex items-center gap-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="label">Market Desk</span>
            <span className="h-3 w-px bg-border" />
            <span className="label">Binance</span>
          </div>
          <h1 className="mt-0.5 font-sans text-xl font-semibold tracking-tight text-foreground">
            {t("header.title")}
          </h1>
        </div>

        <nav className="flex items-center gap-1" aria-label={t("header.title")}>
          {NAV.map((item) => {
            const current = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={current ? "page" : undefined}
                title={t(item.hint)}
                className={cn(
                  "inline-flex min-h-6 items-center rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  current
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {t(item.label)}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex items-center gap-5">
        <div className="text-right">
          <div className="label">{t("header.stream")}</div>
          <div className="mt-1 flex items-center justify-end gap-2 text-sm">
            <LiveDot live={connected} />
            <span className={tierColor[wsTier(connected)]}>
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
  );
}
