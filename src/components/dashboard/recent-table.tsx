"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { useApp } from "@/components/providers";
import { Table, TBody, THead, TR } from "@/components/ui/table";
import { fmtClock, fmtCompact, fmtPrice } from "@/lib/format";
import type { Kline } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Recent raw OHLCV rows for the selected symbol, fetched from the REST endpoint
 * (/api/klines) — demonstrates direct query access to stored data alongside SSE.
 */
export function RecentTable({ symbols, refreshKey }: { symbols: string[]; refreshKey: number }) {
  const { t } = useApp();
  const [active, setActive] = useState(symbols[0] ?? "");
  const [rows, setRows] = useState<Kline[]>([]);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    fetch(`/api/klines?symbol=${active}&limit=12`)
      .then((r) => r.json())
      .then((data: Kline[]) => {
        if (!cancelled) setRows([...data].reverse());
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [active, refreshKey]);

  return (
    <Card className="animate-fade-up" style={{ animationDelay: "240ms" }}>
      <div className="flex items-center justify-between border-b border-border p-4">
        <div>
          <div className="label">{t("table.title")}</div>
          <div className="font-sans font-semibold text-lg text-foreground">{t("table.subtitle")}</div>
        </div>
        <div className="flex gap-1">
          {symbols.map((s) => (
            <button
              key={s}
              onClick={() => setActive(s)}
              className={cn(
                "rounded-sm border px-3 py-1 text-xs transition-colors",
                s === active
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {s.replace("USDT", "")}
            </button>
          ))}
        </div>
      </div>
      <Table>
        <THead>
          <tr>
            <th>{t("table.time")}</th>
            <th>{t("table.open")}</th>
            <th>{t("table.high")}</th>
            <th>{t("table.low")}</th>
            <th>{t("table.close")}</th>
            <th>{t("table.volume")}</th>
            <th> </th>
          </tr>
        </THead>
        <TBody>
          {rows.map((k) => {
            const up = k.close >= k.open;
            return (
              <TR key={k.openTime}>
                <td className="tnum text-muted-foreground">{fmtClock(k.openTime)}</td>
                <td className="tnum">{fmtPrice(k.open)}</td>
                <td className="tnum">{fmtPrice(k.high)}</td>
                <td className="tnum">{fmtPrice(k.low)}</td>
                <td
                  className={cn(
                    "tnum",
                    up ? "text-[hsl(var(--success))]" : "text-[hsl(var(--danger))]",
                  )}
                >
                  {fmtPrice(k.close)}
                </td>
                <td className="tnum text-muted-foreground">{fmtCompact(k.volume)}</td>
                <td>
                  {k.isFinal ? null : (
                    <span className="label text-primary">{t("table.live")}</span>
                  )}
                </td>
              </TR>
            );
          })}
        </TBody>
      </Table>
    </Card>
  );
}
