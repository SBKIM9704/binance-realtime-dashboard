import { describe, expect, it } from "vitest";
import { parseWsMessage, tupleToKline, type RawKlineTuple } from "./binance";

const TUPLE: RawKlineTuple = [
  1_700_000_000_000, // open time
  "42000.10", // open
  "42100.50", // high
  "41900.00", // low
  "42050.25", // close
  "12.5", // volume
  1_700_000_059_999, // close time
  "525000.75", // quote volume
  345, // trades
  "6.1", // taker buy base
  "256000.5", // taker buy quote
  "0", // ignore
];

describe("tupleToKline", () => {
  it("maps REST tuple indices to the correct fields", () => {
    const k = tupleToKline("BTCUSDT", "1m", TUPLE, 1);
    expect(k).toMatchObject({
      symbol: "BTCUSDT",
      interval: "1m",
      openTime: 1_700_000_000_000,
      open: 42000.1,
      high: 42100.5,
      low: 41900,
      close: 42050.25,
      volume: 12.5,
      closeTime: 1_700_000_059_999,
      quoteVolume: 525000.75,
      trades: 345,
      takerBuyBase: 6.1,
      takerBuyQuote: 256000.5,
      isFinal: 1,
    });
  });

  it("coerces numeric strings to numbers", () => {
    const k = tupleToKline("ETHUSDT", "1m", TUPLE, 0);
    expect(typeof k.open).toBe("number");
    expect(typeof k.volume).toBe("number");
    expect(k.isFinal).toBe(0);
  });
});

describe("parseWsMessage", () => {
  const wsMessage = (x: boolean) =>
    JSON.stringify({
      stream: "btcusdt@kline_1m",
      data: {
        e: "kline",
        s: "BTCUSDT",
        k: {
          t: 1_700_000_000_000,
          T: 1_700_000_059_999,
          i: "1m",
          o: "42000.10",
          c: "42050.25",
          h: "42100.50",
          l: "41900.00",
          v: "12.5",
          q: "525000.75",
          n: 345,
          V: "6.1",
          Q: "256000.5",
          x,
        },
      },
    });

  const bookTicker = JSON.stringify({
    stream: "btcusdt@bookTicker",
    data: { s: "BTCUSDT", b: "42000.10", a: "42000.11" },
  });

  it("parses a live (forming) kline with isFinal = 0", () => {
    const msg = parseWsMessage(wsMessage(false));
    expect(msg?.kind).toBe("kline");
    expect(msg).toMatchObject({
      kind: "kline",
      kline: { symbol: "BTCUSDT", close: 42050.25, isFinal: 0 },
    });
  });

  it("marks a closed kline as isFinal = 1", () => {
    const msg = parseWsMessage(wsMessage(true));
    expect(msg).toMatchObject({ kind: "kline", kline: { isFinal: 1 } });
  });

  // The two stream types share one socket, so the dispatch has to tell them apart
  // from a single parse rather than by trying each parser in turn.
  it("parses a bookTicker frame off the same socket", () => {
    expect(parseWsMessage(bookTicker)).toEqual({
      kind: "bookTicker",
      ticker: { symbol: "BTCUSDT", bid: 42000.1, ask: 42000.11 },
    });
  });

  it("returns null for a payload that is neither", () => {
    const other = JSON.stringify({ stream: "x", data: { e: "trade", s: "BTCUSDT" } });
    expect(parseWsMessage(other)).toBeNull();
  });
});
