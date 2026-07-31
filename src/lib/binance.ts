import { config } from "./config";
import type { Kline } from "./types";

/** Raw kline tuple returned by Binance REST/WS. */
type RawKlineTuple = [
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

function tupleToKline(symbol: string, interval: string, k: RawKlineTuple, isFinal: number): Kline {
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

  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
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
