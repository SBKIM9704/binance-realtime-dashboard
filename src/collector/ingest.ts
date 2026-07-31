import WebSocket from "ws";
import { buildStreamUrl, parseWsKline } from "../lib/binance";
import { config } from "../lib/config";
import { upsertKline } from "../lib/repositories/klines";
import { addEvent, incrementStatus, updateStatus } from "../lib/repositories/pipeline";
import { backfillSymbol } from "./backfill";
import { log, logError } from "./logger";

const MAX_BACKOFF_MS = 30_000;
const BASE_BACKOFF_MS = 1_000;

/**
 * Maintains a single combined-stream WebSocket for all symbols with
 * exponential-backoff reconnect. On every (re)connect it runs a backfill so any
 * candles missed while disconnected are recovered before live data resumes.
 */
export class Ingestor {
  private ws: WebSocket | null = null;
  private attempts = 0;
  private stopped = false;
  private reconnectTimer: NodeJS.Timeout | null = null;

  start(): void {
    this.stopped = false;
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.removeAllListeners();
    this.ws?.close();
    this.ws = null;
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
        const kline = parseWsKline(raw.toString());
        if (!kline) return;
        upsertKline(kline);
        updateStatus(kline.symbol, {
          lastMessageAt: Date.now(),
          lastKlineOpenTime: kline.openTime,
        });
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
    const delay = Math.min(BASE_BACKOFF_MS * 2 ** (this.attempts - 1), MAX_BACKOFF_MS);
    log(`[ws] reconnecting in ${delay}ms (attempt ${this.attempts})`);
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }
}
