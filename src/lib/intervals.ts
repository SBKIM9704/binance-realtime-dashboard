/**
 * Candle interval tables. Kept free of `process.env` so client components can
 * import them — `config.ts` reads the environment and is server-only.
 */

/**
 * Milliseconds per interval name. This is the *view* table — the periods the chart
 * may roll up to. It deliberately includes buckets Binance does not stream (`5s`,
 * `10m`, …), because a roll-up only needs the collected candles to divide into it.
 */
export const INTERVAL_TO_MS: Record<string, number> = {
  "1s": 1_000,
  "5s": 5_000,
  "15s": 15_000,
  "30s": 30_000,
  "1m": 60_000,
  "3m": 180_000,
  "5m": 300_000,
  "10m": 600_000,
  "15m": 900_000,
  "30m": 1_800_000,
  "1h": 3_600_000,
  "4h": 14_400_000,
  "1d": 86_400_000,
  "1w": 604_800_000,
};

/**
 * Intervals the collector can actually subscribe to — these are Binance kline
 * intervals. `KLINE_INTERVAL` is validated against this list, not the table above:
 * accepting a view-only bucket as the collected interval would turn a boot-time
 * config error into a WebSocket that silently never delivers.
 */
export const COLLECTABLE_INTERVALS = [
  "1s",
  "1m",
  "3m",
  "5m",
  "15m",
  "30m",
  "1h",
  "4h",
] as const;

/**
 * View intervals selectable for a given collected interval. Anything at or above
 * the base can be rolled up in SQL; anything below it can't be invented.
 */
export function viewIntervalsFor(baseInterval: string): string[] {
  const baseMs = INTERVAL_TO_MS[baseInterval];
  if (!baseMs) return [baseInterval];
  return Object.entries(INTERVAL_TO_MS)
    .filter(([, ms]) => ms >= baseMs && ms % baseMs === 0)
    .sort((a, b) => a[1] - b[1])
    .map(([name]) => name);
}

export type IntervalUnit = "s" | "m" | "h" | "d" | "w";

/**
 * Split interval names into the unit groups a Korean exchange period bar uses
 * (초 · 분 · 시간 · 일 · 주), so the unit is written once and the reader picks a
 * number. Returns groups in ascending duration, each with its numbers ascending.
 */
export function groupIntervals(
  intervals: string[],
): { unit: IntervalUnit; items: { value: string; n: string }[] }[] {
  const order: IntervalUnit[] = ["s", "m", "h", "d", "w"];
  const groups = new Map<IntervalUnit, { value: string; n: string }[]>();

  for (const value of intervals) {
    const unit = value.slice(-1) as IntervalUnit;
    if (!order.includes(unit)) continue;
    const list = groups.get(unit) ?? [];
    list.push({ value, n: value.slice(0, -1) });
    groups.set(unit, list);
  }

  return order
    .filter((u) => groups.has(u))
    .map((unit) => ({
      unit,
      items: groups
        .get(unit)!
        .sort((a, b) => INTERVAL_TO_MS[a.value] - INTERVAL_TO_MS[b.value]),
    }));
}

/**
 * Lookback presets — "how much history am I looking at", paired with the bucket
 * that renders it at a readable density (~200–400 candles). Range and bucket are
 * chosen together because most combinations of the two are nonsense: a month of
 * 1-second candles is 2.6 million bars nobody can read or afford to ship.
 *
 * `spanMs: null` means everything stored.
 */
export interface RangePreset {
  key: string;
  spanMs: number | null;
  interval: string;
  /** Candles to request. Derived from span/interval; `all` needs its own figure. */
  points: number;
}

const HOUR = 3_600_000;
const DAY = 86_400_000;

function preset(key: string, spanMs: number, interval: string): RangePreset {
  // One extra bucket so the partially-elapsed leading bucket doesn't clip the range.
  return { key, spanMs, interval, points: Math.ceil(spanMs / INTERVAL_TO_MS[interval]) + 1 };
}

export const RANGE_PRESETS: RangePreset[] = [
  preset("1h", HOUR, "15s"),
  preset("6h", 6 * HOUR, "1m"),
  preset("1d", DAY, "5m"),
  preset("1w", 7 * DAY, "30m"),
  preset("1M", 30 * DAY, "4h"),
  preset("1y", 365 * DAY, "1d"),
  // Binance history starts 2017-08; weekly buckets over that span, with headroom.
  { key: "all", spanMs: null, interval: "1w", points: 700 },
];

export function rangePreset(key: string): RangePreset | undefined {
  return RANGE_PRESETS.find((r) => r.key === key);
}

/** Readable candle counts. Below this a range is a handful of bars; above it, a smear. */
const MIN_BARS = 60;
const MAX_BARS = 800;

/**
 * Buckets that render `range` at a readable density, given what the collector stores.
 *
 * The range and the bucket used to be independent controls with a one-way coupling:
 * picking a range set the bucket, but picking a bucket left the range alone, so
 * "1시간 + 1주봉" was two clicks away and drew a single candle while both buttons
 * looked selected. Deriving the legal buckets from the active range makes that
 * combination unreachable rather than merely discouraged.
 */
export function intervalsForRange(
  baseInterval: string,
  range: RangePreset,
  storedFrom: number | null = null,
  now: number = Date.now(),
): string[] {
  const spanMs =
    range.spanMs ?? (storedFrom !== null ? Math.max(now - storedFrom, INTERVAL_TO_MS[baseInterval]) : null);

  return viewIntervalsFor(baseInterval).filter((iv) => {
    if (spanMs === null) return true;
    const bars = spanMs / INTERVAL_TO_MS[iv];
    return bars >= MIN_BARS && bars <= MAX_BARS;
  });
}
