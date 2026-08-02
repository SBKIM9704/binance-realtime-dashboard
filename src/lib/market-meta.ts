/**
 * Per-symbol market metadata that isn't in the kline stream.
 *
 * `tickSize` is the `PRICE_FILTER` step from Binance `exchangeInfo` — the smallest
 * price increment the book can move by. It is what makes a spread readable: for
 * BTCUSDT and ETHUSDT the book sits at exactly one tick almost always, so "1 tick"
 * says "as tight as it can be" where "0.001%" says nothing.
 *
 * Held as a constant rather than fetched because it changes about never, and a
 * startup REST call would put the whole dashboard behind an extra dependency. If a
 * symbol with a different step is added to SYMBOLS, add it here — a wrong tickSize
 * shows up as an implausible tick count, not as silently wrong prices.
 */
const TICK_SIZE: Record<string, number> = {
  BTCUSDT: 0.01,
  ETHUSDT: 0.01,
};

const DEFAULT_TICK_SIZE = 0.01;

export function tickSizeFor(symbol: string): number {
  return TICK_SIZE[symbol] ?? DEFAULT_TICK_SIZE;
}
