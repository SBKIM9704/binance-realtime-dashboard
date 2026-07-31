import { config } from "./config";
import type { Kline } from "./types";

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Rate-limit-aware wrapper around fetch for Binance REST endpoints.
 *
 * Safeguards (Binance IP budget is 6000 REQUEST_WEIGHT/min):
 *  - Reads `X-MBX-USED-WEIGHT-1M` and, once we cross the soft threshold, waits
 *    out the current minute window before issuing more requests.
 *  - On 429 (rate limited) / 418 (IP auto-ban) it honours `Retry-After`.
 *  - Retries 5xx and rate-limit responses with exponential backoff, up to
 *    REST_MAX_RETRIES, then throws so the caller can log and move on.
 */
let usedWeight = 0;
let windowResetAt = 0;

function backoffMs(attempt: number): number {
  return Math.min(1000 * 2 ** attempt, 30_000);
}

export async function binanceFetch(url: URL | string): Promise<Response> {
  const maxRetries = config.REST_MAX_RETRIES;
  const softLimit = config.REST_WEIGHT_LIMIT * config.REST_WEIGHT_SOFT_PCT;

  for (let attempt = 0; ; attempt++) {
    // Proactive pacing: if we're near the weight budget, wait out the window.
    if (usedWeight >= softLimit && Date.now() < windowResetAt) {
      await sleep(windowResetAt - Date.now());
    }

    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });

    // Track remaining weight budget from the response headers.
    const w = Number(res.headers.get("x-mbx-used-weight-1m"));
    if (!Number.isNaN(w) && w > 0) {
      usedWeight = w;
      windowResetAt = Date.now() + 60_000;
    }

    if (res.status === 429 || res.status === 418) {
      // Drain the body so the socket can be reused.
      await res.text().catch(() => "");
      const retryAfter = Number(res.headers.get("retry-after"));
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : backoffMs(attempt);
      if (attempt >= maxRetries) {
        throw new Error(`Binance rate limited (${res.status}), gave up after ${attempt} retries`);
      }
      await sleep(waitMs);
      continue;
    }

    if (res.status >= 500) {
      await res.text().catch(() => "");
      if (attempt >= maxRetries) {
        throw new Error(`Binance server error ${res.status}, gave up after ${attempt} retries`);
      }
      await sleep(backoffMs(attempt));
      continue;
    }

    return res;
  }
}

/** Raw kline tuple returned by Binance REST/WS. */
export type RawKlineTuple = [
  number, // open time
  string, // open
  string, // high
  string, // low
  string, // close
  string, // volume
  number, // close time
  string, // quote asset volume
  number, // number of trades
  string, // taker buy base volume
  string, // taker buy quote volume
  string, // ignore
];

export function tupleToKline(
  symbol: string,
  interval: string,
  k: RawKlineTuple,
  isFinal: number,
): Kline {
  return {
    symbol,
    interval,
    openTime: k[0],
    open: Number(k[1]),
    high: Number(k[2]),
    low: Number(k[3]),
    close: Number(k[4]),
    volume: Number(k[5]),
    closeTime: k[6],
    quoteVolume: Number(k[7]),
    trades: k[8],
    takerBuyBase: Number(k[9]),
    takerBuyQuote: Number(k[10]),
    isFinal,
  };
}

/**
 * Fetch historical klines from the REST API for a bounded time window.
 * Binance returns at most `limit` (max 1000) candles per call.
 */
export async function fetchKlines(
  symbol: string,
  interval: string,
  opts: { startTime?: number; endTime?: number; limit?: number } = {},
): Promise<Kline[]> {
  const url = new URL("/api/v3/klines", config.BINANCE_REST_BASE);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("interval", interval);
  url.searchParams.set("limit", String(opts.limit ?? 1000));
  if (opts.startTime !== undefined) url.searchParams.set("startTime", String(opts.startTime));
  if (opts.endTime !== undefined) url.searchParams.set("endTime", String(opts.endTime));

  const res = await binanceFetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Binance REST ${res.status} for ${symbol}: ${body.slice(0, 200)}`);
  }
  const rows = (await res.json()) as RawKlineTuple[];
  // Historical candles from REST are always closed → isFinal = 1.
  return rows.map((r) => tupleToKline(symbol, interval, r, 1));
}

/** Shape of the combined-stream kline message. */
interface WsKlineMessage {
  stream: string;
  data: {
    e: string;
    s: string; // symbol
    k: {
      t: number; // open time
      T: number; // close time
      i: string; // interval
      o: string;
      c: string;
      h: string;
      l: string;
      v: string;
      q: string; // quote volume
      n: number; // trades
      V: string; // taker buy base
      Q: string; // taker buy quote
      x: boolean; // is this kline closed?
    };
  };
}

/** Build the combined-stream WebSocket URL for the configured symbols. */
export function buildStreamUrl(symbols: string[], interval: string): string {
  const streams = symbols.map((s) => `${s.toLowerCase()}@kline_${interval}`).join("/");
  return `${config.BINANCE_WS_BASE}/stream?streams=${streams}`;
}

/** Parse a raw combined-stream kline message into a Kline, or null if irrelevant. */
export function parseWsKline(raw: string): Kline | null {
  const msg = JSON.parse(raw) as Partial<WsKlineMessage>;
  const d = msg.data;
  if (!d || d.e !== "kline" || !d.k) return null;
  const k = d.k;
  return {
    symbol: d.s,
    interval: k.i,
    openTime: k.t,
    open: Number(k.o),
    high: Number(k.h),
    low: Number(k.l),
    close: Number(k.c),
    volume: Number(k.v),
    closeTime: k.T,
    quoteVolume: Number(k.q),
    trades: k.n,
    takerBuyBase: Number(k.V),
    takerBuyQuote: Number(k.Q),
    isFinal: k.x ? 1 : 0,
  };
}
