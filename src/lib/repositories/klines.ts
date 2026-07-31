import { getDb } from "../db";
import type { Kline } from "../types";

interface KlineRow {
  symbol: string;
  interval: string;
  open_time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  close_time: number;
  quote_volume: number;
  trades: number;
  taker_buy_base: number;
  taker_buy_quote: number;
  is_final: number;
}

function rowToKline(r: KlineRow): Kline {
  return {
    symbol: r.symbol,
    interval: r.interval,
    openTime: r.open_time,
    open: r.open,
    high: r.high,
    low: r.low,
    close: r.close,
    volume: r.volume,
    closeTime: r.close_time,
    quoteVolume: r.quote_volume,
    trades: r.trades,
    takerBuyBase: r.taker_buy_base,
    takerBuyQuote: r.taker_buy_quote,
    isFinal: r.is_final,
  };
}

const UPSERT_SQL = `
  INSERT INTO klines (
    symbol, interval, open_time, open, high, low, close, volume,
    close_time, quote_volume, trades, taker_buy_base, taker_buy_quote, is_final
  ) VALUES (
    @symbol, @interval, @openTime, @open, @high, @low, @close, @volume,
    @closeTime, @quoteVolume, @trades, @takerBuyBase, @takerBuyQuote, @isFinal
  )
  ON CONFLICT (symbol, interval, open_time) DO UPDATE SET
    open = excluded.open, high = excluded.high, low = excluded.low,
    close = excluded.close, volume = excluded.volume, close_time = excluded.close_time,
    quote_volume = excluded.quote_volume, trades = excluded.trades,
    taker_buy_base = excluded.taker_buy_base, taker_buy_quote = excluded.taker_buy_quote,
    is_final = excluded.is_final
`;

export function upsertKline(k: Kline): void {
  getDb().prepare(UPSERT_SQL).run(k);
}

/** Bulk upsert inside a single transaction. Returns the number of rows written. */
export function upsertKlines(klines: Kline[]): number {
  if (klines.length === 0) return 0;
  const db = getDb();
  const stmt = db.prepare(UPSERT_SQL);
  const tx = db.transaction((rows: Kline[]) => {
    for (const r of rows) stmt.run(r);
    return rows.length;
  });
  return tx(klines);
}

export function getMaxOpenTime(symbol: string, interval: string): number | null {
  const row = getDb()
    .prepare("SELECT MAX(open_time) AS t FROM klines WHERE symbol = ? AND interval = ?")
    .get(symbol, interval) as { t: number | null };
  return row?.t ?? null;
}

export function countKlines(symbol: string, interval: string): number {
  const row = getDb()
    .prepare("SELECT COUNT(*) AS c FROM klines WHERE symbol = ? AND interval = ?")
    .get(symbol, interval) as { c: number };
  return row.c;
}

/** Most recent klines, returned oldest → newest (chart friendly). */
export function getRecentKlines(symbol: string, interval: string, limit: number): Kline[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM klines WHERE symbol = ? AND interval = ?
       ORDER BY open_time DESC LIMIT ?`,
    )
    .all(symbol, interval, limit) as KlineRow[];
  return rows.map(rowToKline).reverse();
}

/** Existing open_times within [start, end], ascending. Used for gap detection. */
export function getOpenTimesInRange(
  symbol: string,
  interval: string,
  start: number,
  end: number,
): number[] {
  const rows = getDb()
    .prepare(
      `SELECT open_time FROM klines
       WHERE symbol = ? AND interval = ? AND open_time BETWEEN ? AND ?
       ORDER BY open_time ASC`,
    )
    .all(symbol, interval, start, end) as { open_time: number }[];
  return rows.map((r) => r.open_time);
}
