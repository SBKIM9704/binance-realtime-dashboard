"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineStyle,
  createChart,
  type CandlestickData,
  type HistogramData,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { IntervalPicker } from "@/components/dashboard/interval-picker";
import { Panel } from "@/components/dashboard/panel";
import { SymbolTabs, ToggleGroup } from "@/components/dashboard/toggle-group";
import { useApp } from "@/components/providers";
import { useLoadedSnapshot } from "@/components/snapshot-provider";
import { fmtClock, fmtCompact, fmtDate, fmtPct, fmtPrice } from "@/lib/format";
import type { Lang, TKey } from "@/lib/i18n";
import {
  INTERVAL_TO_MS,
  RANGE_PRESETS,
  intervalsForRange,
  rangePreset,
  viewIntervalsFor,
} from "@/lib/intervals";
import { trendText, trendVar } from "@/lib/trend";
import type { Candle } from "@/lib/types";

const CHART_POINTS = 400; // candles loaded per view
const TAIL_POINTS = 4; // buckets refreshed on each tick
const POLL_MS = 1_000;
const RESYNC_MS = 60_000; // full reload, so backfilled gaps show up

interface CandleResponse {
  candles: Candle[];
  source: string | null;
  from: number | null;
}

/**
 * Last loaded window per view, kept for the session.
 *
 * Historical candles don't change once their source rows are complete, so a view
 * the reader already visited can be repainted instantly instead of waiting on a
 * round trip. The live tail still refreshes on top — this only removes the blank
 * chart between clicking a symbol and the response arriving.
 */
const viewCache = new Map<string, CandleResponse>();
const viewKey = (symbol: string, interval: string, range: string) =>
  `${symbol}|${interval}|${range}`;

/** Read an hsl() triplet from a CSS custom property on :root. */
function cssColor(name: string, alpha?: number): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return alpha == null ? `hsl(${v})` : `hsl(${v} / ${alpha})`;
}

/** The four canvas colours for one language's rise/fall convention. */
function candlePalette(lang: Lang) {
  return {
    up: cssColor(trendVar(lang, true)),
    down: cssColor(trendVar(lang, false)),
    upSoft: cssColor(trendVar(lang, true), 0.35),
    downSoft: cssColor(trendVar(lang, false), 0.35),
  };
}
type CandlePalette = ReturnType<typeof candlePalette>;

const toSec = (ms: number) => Math.floor(ms / 1000) as UTCTimestamp;

const toCandle = (p: Candle): CandlestickData => ({
  time: toSec(p.t),
  open: p.open,
  high: p.high,
  low: p.low,
  close: p.close,
});

const toVolume = (p: Candle, palette: CandlePalette): HistogramData => ({
  time: toSec(p.t),
  value: p.volume,
  color: p.close >= p.open ? palette.upSoft : palette.downSoft,
});

/** "1m" → "1분" for Korean readers, matching domestic exchange labelling. */
function intervalLabel(iv: string, t: (k: TKey, vars?: Record<string, string>) => string): string {
  const unit = iv.slice(-1);
  const n = iv.slice(0, -1);
  if (!"smhdw".includes(unit) || unit.length !== 1) return iv;
  return t(`interval.${unit}` as TKey, { n });
}

/**
 * Top-left OHLC readout, mirroring the exchange convention. Memoised because the
 * crosshair fires at pointer rate and must not re-render the toolbar with it.
 */
const Legend = memo(function Legend({
  point,
  lang,
  seconds,
}: {
  point: Candle | null;
  lang: Lang;
  seconds: boolean;
}) {
  if (!point) return null;
  const cls = trendText(lang, point.close >= point.open);
  const changePct = point.open > 0 ? ((point.close - point.open) / point.open) * 100 : 0;

  return (
    <div className="tnum pointer-events-none absolute left-3 top-3 z-10 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[11px]">
      <span className="text-muted-foreground">{fmtClock(point.t, { seconds })}</span>
      {(["open", "high", "low", "close"] as const).map((k) => (
        <span key={k} className={cls}>
          <span className="text-muted-foreground">{k[0].toUpperCase()} </span>
          {fmtPrice(point[k])}
        </span>
      ))}
      <span className={cls}>{fmtPct(changePct)}</span>
      <span className="text-muted-foreground">Vol {fmtCompact(point.volume)}</span>
    </div>
  );
});

export function PriceChart() {
  const { t, theme, lang } = useApp();
  const { snapshot, symbol, setSymbol } = useLoadedSnapshot();

  const [range, setRange] = useState("1d");
  const [interval, setInterval_] = useState(() => rangePreset("1d")?.interval ?? "5m");
  /** Which stored tier answered — a long range is served by coarser data. */
  const [source, setSource] = useState<string | null>(null);
  /** Oldest stored candle for that tier, so an empty range can say why. */
  const [coverage, setCoverage] = useState<number | null>(null);
  const [empty, setEmpty] = useState(false);

  const preset = rangePreset(range);
  const intervals = useMemo(
    () =>
      preset
        ? intervalsForRange(snapshot.interval, preset, coverage)
        : viewIntervalsFor(snapshot.interval),
    [snapshot.interval, preset, coverage],
  );

  // If the range narrowed the legal set out from under the current bucket, snap
  // back to the preset's own bucket rather than leaving an unreachable selection.
  useEffect(() => {
    if (intervals.length > 0 && !intervals.includes(interval)) {
      setInterval_(preset?.interval ?? intervals[0]);
    }
  }, [intervals, interval, preset]);
  const secondsVisible = (INTERVAL_TO_MS[interval] ?? 1_000) < 60_000;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  /** Candles currently on the chart, oldest → newest. The single source of "what we hold". */
  const dataRef = useRef<Candle[]>([]);
  /** Timestamp → candle, for the crosshair; rebuilt only when the data does. */
  const indexRef = useRef<Map<number, Candle>>(new Map());
  /** Palette for the current theme/language, so the fetch loop needn't depend on either. */
  const paletteRef = useRef<CandlePalette | null>(null);

  const [latest, setLatest] = useState<Candle | null>(null);
  const [hovered, setHovered] = useState<Candle | null>(null);

  /** Picking a range also picks the bucket that renders it readably. */
  const selectRange = (key: string) => {
    setRange(key);
    const next = rangePreset(key);
    if (next) setInterval_(next.interval);
  };

  // Create the chart once; colours and data are applied by the effects below.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        attributionLogo: false,
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.18, bottom: 0.26 } },
      timeScale: { borderVisible: false, rightOffset: 2, barSpacing: 8 },
      handleScale: { axisPressedMouseMove: { time: true, price: false } },
    });

    const candles = chart.addSeries(CandlestickSeries, {
      borderVisible: false,
      priceLineStyle: LineStyle.Dotted,
    });
    const volume = chart.addSeries(HistogramSeries, {
      priceScaleId: "vol",
      priceFormat: { type: "volume" },
      lastValueVisible: false,
      priceLineVisible: false,
    });
    // Volume gets its own scale pinned to the bottom fifth — a separate band, not a
    // second axis competing with price.
    chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

    chartRef.current = chart;
    candleRef.current = candles;
    volumeRef.current = volume;

    chart.subscribeCrosshairMove((param) => {
      const time = param.time as UTCTimestamp | undefined;
      setHovered(time && param.point ? (indexRef.current.get(time) ?? null) : null);
    });

    return () => {
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      volumeRef.current = null;
      dataRef.current = [];
      indexRef.current = new Map();
    };
  }, []);

  // Canvas colours can't inherit CSS, so they're re-read whenever the theme or the
  // rise/fall convention changes, and both series are repainted together.
  useEffect(() => {
    const candles = candleRef.current;
    const volume = volumeRef.current;
    if (!candles || !volume) return;

    const palette = candlePalette(lang);
    paletteRef.current = palette;

    candles.applyOptions({
      upColor: palette.up,
      downColor: palette.down,
      wickUpColor: palette.up,
      wickDownColor: palette.down,
    });
    // Volume colour is per-point, so applyOptions alone can't restyle it.
    volume.setData(dataRef.current.map((p) => toVolume(p, palette)));
  }, [theme, lang]);

  // Axis formatting is a separate concern from colour: an interval switch must not
  // drag a full repaint along with it.
  useEffect(() => {
    chartRef.current?.applyOptions({
      layout: { textColor: cssColor("--muted-foreground") },
      grid: {
        vertLines: { color: cssColor("--border", 0.6) },
        horzLines: { color: cssColor("--border", 0.6) },
      },
      crosshair: {
        vertLine: {
          color: cssColor("--muted-foreground", 0.7),
          labelBackgroundColor: cssColor("--accent"),
        },
        horzLine: {
          color: cssColor("--muted-foreground", 0.7),
          labelBackgroundColor: cssColor("--accent"),
        },
      },
      localization: {
        timeFormatter: (time: unknown) => fmtClock((time as number) * 1000),
        priceFormatter: (price: number) => fmtPrice(price),
      },
      timeScale: {
        timeVisible: true,
        secondsVisible,
        tickMarkFormatter: (time: unknown) =>
          fmtClock((time as number) * 1000, { seconds: secondsVisible }),
      },
    });
  }, [theme, secondsVisible]);

  // History and live tail both come from /api/candles, which rolls whichever stored
  // tier can serve the range up to the selected bucket. Only the view identity is a
  // dependency — a theme or language change repaints, it does not refetch.
  useEffect(() => {
    if (!symbol) return;
    const ac = new AbortController();
    let cancelled = false;
    let lastFullAt = 0;

    dataRef.current = [];
    indexRef.current = new Map();

    const points = rangePreset(range)?.points ?? CHART_POINTS;
    const url = (sym: string, limit: number) =>
      `/api/candles?symbol=${sym}&interval=${interval}&range=${range}&limit=${limit}`;

    const fetchView = async (sym: string, limit: number): Promise<CandleResponse | null> => {
      try {
        const res = await fetch(url(sym, limit), { signal: ac.signal });
        return res.ok ? ((await res.json()) as CandleResponse) : null;
      } catch {
        return null; // aborted or offline — the next tick retries
      }
    };

    /** Replace the whole window on both series. */
    const paint = (points: Candle[]) => {
      const candles = candleRef.current;
      const volume = volumeRef.current;
      const palette = paletteRef.current;
      if (!candles || !volume || !palette) return;

      dataRef.current = points;
      indexRef.current = new Map(points.map((p) => [toSec(p.t), p]));
      candles.setData(points.map(toCandle));
      volume.setData(points.map((p) => toVolume(p, palette)));
      setLatest(points.at(-1) ?? null);
    };

    // Repaint the previously seen window immediately, so switching back to a view
    // is instant rather than blank until the fetch lands.
    const cached = viewCache.get(viewKey(symbol, interval, range));
    if (cached) {
      paint(cached.candles);
      setSource(cached.source);
      setCoverage(cached.from);
      setEmpty(cached.candles.length === 0);
    }

    const loadFull = async (scroll: boolean) => {
      const res = await fetchView(symbol, points);
      if (cancelled || !res) return;
      lastFullAt = Date.now();
      viewCache.set(viewKey(symbol, interval, range), res);
      paint(res.candles);
      setSource(res.source);
      setCoverage(res.from);
      setEmpty(res.candles.length === 0);
      if (scroll) chartRef.current?.timeScale().scrollToRealTime();

      // Warm the other symbols for the same view, so a symbol switch paints instantly.
      for (const other of snapshot.symbols) {
        if (other === symbol || viewCache.has(viewKey(other, interval, range))) continue;
        void fetchView(other, points).then((r) => {
          if (r) viewCache.set(viewKey(other, interval, range), r);
        });
      }
    };

    const loadTail = async () => {
      const held = dataRef.current.at(-1);
      if (!held) return;
      // Periodic resync picks up buckets the reconciler backfilled behind the tail.
      if (Date.now() - lastFullAt > RESYNC_MS) return loadFull(false);

      const res = await fetchView(symbol, TAIL_POINTS);
      if (cancelled || !res?.candles.length) return;
      const points = res.candles;
      // Tail doesn't reach what we hold (backgrounded tab) — reload the window.
      if (points[0].t > held.t) return loadFull(false);

      const candles = candleRef.current;
      const volume = volumeRef.current;
      const palette = paletteRef.current;
      if (!candles || !volume || !palette) return;

      const data = dataRef.current;
      for (const p of points) {
        if (p.t < held.t) continue; // `update()` can't move backwards
        candles.update(toCandle(p));
        volume.update(toVolume(p, palette));
        // The affected buckets are always at the tail, so scan back from the end.
        let i = data.length - 1;
        while (i >= 0 && data[i].t > p.t) i--;
        if (i >= 0 && data[i].t === p.t) data[i] = p;
        else data.push(p);
        indexRef.current.set(toSec(p.t), p);
      }
      setLatest(data.at(-1) ?? null);
    };

    void loadFull(!cached);
    const timer = window.setInterval(loadTail, POLL_MS);
    return () => {
      cancelled = true;
      ac.abort();
      window.clearInterval(timer);
    };
  }, [symbol, interval, range, snapshot.symbols]);

  return (
    <Panel
      title={t("chart.title")}
      subtitle={`${intervalLabel(interval, t)} ${t("chart.candles")}`}
      action={<SymbolTabs symbols={snapshot.symbols} active={symbol} onSelect={setSymbol} />}
      scroll={false}
      className="h-full min-h-[320px] motion-safe:animate-fade-up"
    >
      <div className="flex h-full flex-col">
        <div className="flex shrink-0 flex-col gap-1.5 border-b border-border px-4 py-2">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <span className="label">{t("range.label")}</span>
            <ToggleGroup
              items={RANGE_PRESETS.map((r) => ({
                value: r.key,
                label: t(`range.${r.key}` as TKey),
              }))}
              active={range}
              onSelect={selectRange}
              variant="plain"
              ariaLabel={t("range.label")}
            />
            {source && source !== snapshot.interval ? (
              <span className="text-[10px] text-muted-foreground">
                {t("range.source", { interval: source })}
              </span>
            ) : null}
          </div>
          <IntervalPicker intervals={intervals} active={interval} onSelect={setInterval_} />
        </div>

        <div className="relative min-h-0 w-full flex-1">
          <Legend point={hovered ?? latest} lang={lang} seconds={secondsVisible} />
          <div ref={containerRef} className="h-full w-full" />
          {/* An empty response used to render as a blank canvas inside a titled
              panel — correct behaviour, indistinguishable from broken. */}
          {empty ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-center">
              <p className="text-sm text-foreground">{t("chart.empty")}</p>
              <p className="text-xs text-muted-foreground">
                {coverage
                  ? t("chart.emptyFrom", { date: fmtDate(coverage) })
                  : t("chart.emptyHint")}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}
