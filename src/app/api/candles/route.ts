import { NextResponse } from "next/server";
import { ttlMemo } from "@/lib/cache";
import { config } from "@/lib/config";
import { INTERVAL_TO_MS, rangePreset } from "@/lib/intervals";
import { getCachedCandles, getIntervalStats } from "@/lib/repositories/klines";
import { parseLimit, parseSymbol } from "@/lib/request";
import { pickSourceInterval } from "@/lib/source-interval";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 240;
const MAX_LIMIT = 1000;
const CACHE_MS = 800; // many tabs polling the same view share one query

/**
 * Chart candles: /api/candles?symbol=BTCUSDT&interval=1m&limit=240[&range=1w]
 *
 * `interval` is a *view* bucket rolled up from whichever stored tier can serve it,
 * so switching timeframe or range never requires collecting a new interval.
 * `range` bounds how far back to read; without it the newest `limit` buckets are
 * returned.
 */
export function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const parsed = parseSymbol(searchParams);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { symbol } = parsed;

  const rangeKey = searchParams.get("range");
  const preset = rangeKey ? rangePreset(rangeKey) : undefined;
  if (rangeKey && !preset) {
    return NextResponse.json({ error: `Unknown range "${rangeKey}"` }, { status: 400 });
  }

  const interval = searchParams.get("interval") ?? preset?.interval ?? config.KLINE_INTERVAL;
  const bucketMs = INTERVAL_TO_MS[interval];
  if (!bucketMs || bucketMs < config.intervalMs) {
    return NextResponse.json({ error: `Unsupported interval "${interval}"` }, { status: 400 });
  }

  const limit = parseLimit(searchParams, preset?.points ?? DEFAULT_LIMIT, MAX_LIMIT);
  const rangeStart = preset?.spanMs != null ? Date.now() - preset.spanMs : null;

  // Cache the serialised body, not the objects: re-stringifying ~400 points per hit
  // would throw away most of what the shared cache is for.
  const key = `candles|${symbol}|${bucketMs}|${limit}|${rangeKey ?? ""}`;
  const body = ttlMemo(key, CACHE_MS, () => {
    const stats = getIntervalStats(symbol, config.storedIntervals, rangeStart ?? 0);
    const source = pickSourceInterval(config.storedIntervals, stats, bucketMs, rangeStart);
    if (!source) return JSON.stringify({ candles: [], source: null, from: null });

    const candles = getCachedCandles(symbol, source, bucketMs, limit, rangeStart ?? undefined);
    return JSON.stringify({
      candles,
      // Which tier answered, and how far back it can go — the UI tells the reader
      // that a long range is served by coarser data than a short one.
      source,
      from: stats.get(source)?.from ?? null,
    });
  });

  return new NextResponse(body, { headers: { "content-type": "application/json" } });
}
