import "dotenv/config";
import { config } from "../lib/config";
import { getDb } from "../lib/db";
import { addEvent, ensureStatus, updateStatus } from "../lib/repositories/pipeline";
import { backfillSymbol } from "./backfill";
import { Ingestor } from "./ingest";
import { log, logError } from "./logger";
import { reconcileAll } from "./reconcile";

async function main(): Promise<void> {
  log("[collector] starting");
  log(`[collector] symbols=${config.symbols.join(",")} interval=${config.KLINE_INTERVAL}`);

  // Open DB (runs migrations) and ensure a status row exists for each symbol.
  getDb();
  for (const symbol of config.symbols) ensureStatus(symbol);

  // 1) Startup backfill (first-run history or restart gap — one mechanism).
  for (const symbol of config.symbols) {
    try {
      await backfillSymbol(symbol);
    } catch (err) {
      logError(`[collector] startup backfill failed for ${symbol}:`, err);
    }
  }

  // 2) Live ingestion over WebSocket (with reconnect + reconnect-backfill).
  const ingestor = new Ingestor();
  ingestor.start();

  // 3) Periodic reconciler for data completeness.
  const runReconcile = () => {
    reconcileAll().catch((err) => logError("[collector] reconcile pass failed:", err));
  };
  const reconcileTimer = setInterval(runReconcile, config.RECONCILE_INTERVAL_MS);

  const shutdown = (signal: string) => {
    log(`[collector] ${signal} received, shutting down`);
    clearInterval(reconcileTimer);
    ingestor.stop();
    // Synchronously mark the pipeline offline so the dashboard reflects the stop
    // even on an abrupt exit (the async ws 'close' event may not fire in time).
    for (const symbol of config.symbols) {
      updateStatus(symbol, { wsConnected: 0 });
      addEvent({ ts: Date.now(), symbol, type: "ws_disconnect", detail: signal, count: 0 });
    }
    process.exit(0);
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  log("[collector] running (Ctrl+C to stop)");
}

main().catch((err) => {
  logError("[collector] fatal:", err);
  process.exit(1);
});
