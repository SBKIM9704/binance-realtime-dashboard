"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/components/providers";
import { Table, TBody, THead, TR } from "@/components/ui/table";
import { fmtClock, fmtCompact, fmtPrice } from "@/lib/format";
import type { Kline } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Recent OHLCV rows for the selected symbol, fetched from /api/klines — direct
 * query access alongside SSE. Body-only (rendered inside a tab).
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
    <div>
      <div className="flex items-center justify-end gap-1 border-b border-border p-2">
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
                <td>{k.isFinal ? null : <span className="label text-primary">{t("table.live")}</span>}</td>
              </TR>
            );
          })}
        </TBody>
      </Table>
    </div>
  );
}
