import WebSocket from "ws";
import { buildStreamUrl, parseWsBookTicker, parseWsKline } from "../lib/binance";
import { config } from "../lib/config";
import { upsertKline } from "../lib/repositories/klines";
import { addEvent, incrementStatus, updateStatus } from "../lib/repositories/pipeline";
import { backfillSymbol } from "./backfill";
import { log, logError } from "./logger";

const MAX_BACKOFF_MS = 30_000;
const BASE_BACKOFF_MS = 1_000;
const STATS_FLUSH_MS = 1_000;

/** Per-symbol in-memory aggregation, flushed to SQLite once per second. */
interface Agg {
  cum: number; // cumulative messages received
  lastMsgAt: number | null;
  bid: number | null;
  ask: number | null;
  tickerAt: number | null;
}

/**
 * Maintains a single combined-stream WebSocket (kline + bookTicker) for all
 * symbols with exponential-backoff reconnect. High-frequency bookTicker updates
 * are aggregated in memory and flushed once per second to avoid hammering SQLite.
 */
export class Ingestor {
  private ws: WebSocket | null = null;
  private attempts = 0;
  private stopped = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private statsTimer: NodeJS.Timeout | null = null;
  private readonly agg = new Map<string, Agg>();
  private readonly lastFlush = new Map<string, { count: number; at: number }>();

  start(): void {
    this.stopped = false;
    for (const symbol of config.symbols) {
      this.agg.set(symbol, { cum: 0, lastMsgAt: null, bid: null, ask: null, tickerAt: null });
      this.lastFlush.set(symbol, { count: 0, at: Date.now() });
    }
    this.statsTimer = setInterval(() => this.flushStats(), STATS_FLUSH_MS);
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.statsTimer) clearInterval(this.statsTimer);
    this.ws?.removeAllListeners();
    this.ws?.close();
    this.ws = null;
  }

  private bump(symbol: string): Agg | undefined {
    const a = this.agg.get(symbol);
    if (a) {
      a.cum += 1;
      a.lastMsgAt = Date.now();
    }
    return a;
  }

  /** Write per-symbol message rate, cumulative count and latest bid/ask. */
  private flushStats(): void {
    const now = Date.now();
    for (const symbol of config.symbols) {
      const a = this.agg.get(symbol);
      const last = this.lastFlush.get(symbol);
      if (!a || !last) continue;
      const elapsedSec = Math.max((now - last.at) / 1000, 0.001);
      const rate = (a.cum - last.count) / elapsedSec;
      try {
        updateStatus(symbol, {
          wsMsgRate: Math.round(rate * 10) / 10,
          messageCount: a.cum,
          ...(a.lastMsgAt !== null ? { lastMessageAt: a.lastMsgAt } : {}),
          ...(a.bid !== null && a.ask !== null
            ? { bestBid: a.bid, bestAsk: a.ask, tickerUpdatedAt: a.tickerAt }
            : {}),
        });
      } catch (err) {
        logError("[ws] stats flush error:", err);
      }
      this.lastFlush.set(symbol, { count: a.cum, at: now });
    }
  }

  private connect(): void {
    const url = buildStreamUrl(config.symbols, config.KLINE_INTERVAL);
    log(`[ws] connecting → ${url}`);
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.on("open", async () => {
      this.attempts = 0;
      log("[ws] connected");
      for (const symbol of config.symbols) {
        updateStatus(symbol, { wsConnected: 1 });
        addEvent({ ts: Date.now(), symbol, type: "ws_connect", detail: "", count: 0 });
      }
      // Recover any gap that opened while we were disconnected.
      for (const symbol of config.symbols) {
        try {
          await backfillSymbol(symbol);
        } catch (err) {
          logError(`[ws] reconnect backfill failed for ${symbol}:`, err);
        }
      }
    });

    ws.on("message", (raw: WebSocket.RawData) => {
      try {
        const text = raw.toString();

        const kline = parseWsKline(text);
        if (kline) {
          this.bump(kline.symbol);
          upsertKline(kline);
          updateStatus(kline.symbol, {
            lastMessageAt: Date.now(),
            lastKlineOpenTime: kline.openTime,
          });
          return;
        }

        const ticker = parseWsBookTicker(text);
        if (ticker) {
          const a = this.bump(ticker.symbol);
          if (a) {
            a.bid = ticker.bid;
            a.ask = ticker.ask;
            a.tickerAt = Date.now();
          }
        }
      } catch (err) {
        logError("[ws] message handling error:", err);
      }
    });

    ws.on("error", (err) => {
      logError("[ws] error:", err.message);
    });

    ws.on("close", (code) => {
      for (const symbol of config.symbols) {
        updateStatus(symbol, { wsConnected: 0 });
        addEvent({
          ts: Date.now(),
          symbol,
          type: "ws_disconnect",
          detail: `code ${code}`,
          count: 0,
        });
      }
      if (this.stopped) return;
      this.scheduleReconnect();
    });
  }

  private scheduleReconnect(): void {
    this.attempts += 1;
    for (const symbol of config.symbols) incrementStatus(symbol, "reconnectCount");
    const delay = Math.min(BASE_BACKOFF_MS * 2 ** (this.attempts - 1), MAX_BACKOFF_MS);
    log(`[ws] reconnecting in ${delay}ms (attempt ${this.attempts})`);
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }
}
