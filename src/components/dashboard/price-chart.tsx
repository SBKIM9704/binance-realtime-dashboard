"use client";

import { useState } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import { useApp } from "@/components/providers";
import { fmtCompact, fmtPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DashboardSnapshot } from "@/lib/types";

type Point = { t: number; close: number; volume: number };

function TooltipBox({ active, payload }: { active?: boolean; payload?: { payload: Point }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-md border border-border bg-card/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      <div className="label mb-1">
        {new Date(p.t).toLocaleTimeString("en-GB", { hour12: false })}
      </div>
      <div className="tnum text-foreground">
        <span className="text-muted-foreground">C </span>${fmtPrice(p.close)}
      </div>
      <div className="tnum text-muted-foreground">Vol {fmtCompact(p.volume)}</div>
    </div>
  );
}

export function PriceChart({ snapshot }: { snapshot: DashboardSnapshot }) {
  const { t } = useApp();
  const symbols = Object.keys(snapshot.series);
  const [active, setActive] = useState(symbols[0] ?? "");
  const data: Point[] = snapshot.series[active] ?? [];

  const closes = data.map((d) => d.close);
  const min = closes.length ? Math.min(...closes) : 0;
  const max = closes.length ? Math.max(...closes) : 1;
  const pad = (max - min) * 0.08 || 1;

  return (
    <Card className="flex h-full min-h-[320px] flex-col animate-fade-up" style={{ animationDelay: "120ms" }}>
      <div className="flex shrink-0 items-center justify-between border-b border-border p-4">
        <div>
          <div className="label">{t("chart.title")}</div>
          <div className="font-sans font-semibold text-lg text-foreground">
            {snapshot.interval} {t("chart.candles")}
          </div>
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

      <div className="min-h-0 w-full flex-1 p-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 12, right: 8, left: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.25" />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" vertical={false} />
            <XAxis
              dataKey="t"
              tickFormatter={(t) =>
                new Date(t).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
              }
              stroke="hsl(var(--muted-foreground))"
              tick={{ fontSize: 10 }}
              minTickGap={48}
              tickLine={false}
              axisLine={{ stroke: "hsl(var(--border))" }}
            />
            <YAxis
              yAxisId="price"
              domain={[min - pad, max + pad]}
              orientation="right"
              stroke="hsl(var(--muted-foreground))"
              tick={{ fontSize: 10 }}
              tickFormatter={(v) => fmtPrice(v)}
              width={64}
              tickLine={false}
              axisLine={false}
            />
            <YAxis yAxisId="vol" hide domain={[0, (max: number) => max * 4]} />
            <Tooltip content={<TooltipBox />} cursor={{ stroke: "hsl(var(--border))" }} />
            <Bar
              yAxisId="vol"
              dataKey="volume"
              fill="hsl(var(--muted-foreground))"
              fillOpacity={0.18}
              isAnimationActive={false}
            />
            <Area
              yAxisId="price"
              type="monotone"
              dataKey="close"
              stroke="hsl(var(--primary))"
              strokeWidth={1.6}
              fill="url(#priceFill)"
              isAnimationActive={false}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
