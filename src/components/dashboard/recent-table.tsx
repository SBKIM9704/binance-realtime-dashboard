"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/components/providers";
import { Table, TBody, THead, TR } from "@/components/ui/table";
import { fmtClock, fmtCompact, fmtPrice } from "@/lib/format";
import { trendText } from "@/lib/trend";
import type { Kline } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Recent OHLCV rows for `symbol`, fetched from /api/klines — direct query access
 * alongside SSE. Body-only; the symbol switcher belongs to the hosting panel.
 */
export function RecentTable({
  symbol,
  refreshKey,
}: {
  symbol: string;
  refreshKey: number;
}) {
  const { t, lang } = useApp();
  const [rows, setRows] = useState<Kline[]>([]);

  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;
    fetch(`/api/klines?symbol=${symbol}&limit=40`)
      .then((r) => r.json())
      .then((data: Kline[]) => {
        if (!cancelled) setRows([...data].reverse());
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [symbol, refreshKey]);

  return (
    <Table>
      <THead>
        <tr>
          <th scope="col">{t("table.time")}</th>
          <th scope="col">{t("table.open")}</th>
          <th scope="col">{t("table.high")}</th>
          <th scope="col">{t("table.low")}</th>
          <th scope="col">{t("table.close")}</th>
          <th scope="col">{t("table.volume")}</th>
          <th scope="col">
            <span className="sr-only">{t("table.state")}</span>
          </th>
        </tr>
      </THead>
      <TBody>
        {rows.map((k) => {
          const up = k.close >= k.open;
          return (
            <TR key={k.openTime}>
              <td className="tnum text-muted-foreground">
                {fmtClock(k.openTime)}
              </td>
              <td className="tnum">{fmtPrice(k.open)}</td>
              <td className="tnum">{fmtPrice(k.high)}</td>
              <td className="tnum">{fmtPrice(k.low)}</td>
              <td className={cn("tnum", trendText(lang, up))}>
                {/* Arrow, not just colour: the close column is the only place the
                    direction is encoded, and colour alone fails CVD readers. */}
                <span aria-hidden>{up ? "\u25B2" : "\u25BC"}</span> {fmtPrice(k.close)}
              </td>
              <td className="tnum text-muted-foreground">
                {fmtCompact(k.volume)}
              </td>
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
  );
}
