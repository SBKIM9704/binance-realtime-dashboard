import "dotenv/config";
import { config } from "../lib/config";
import { getDb } from "../lib/db";
import { addEvent, ensureStatus, updateStatus } from "../lib/repositories/pipeline";
import { getSystemMetrics, updateSystemProcess } from "../lib/repositories/system";
import { backfillSymbol } from "./backfill";
import { Ingestor } from "./ingest";
import { log, logError } from "./logger";
import { reconcileAll } from "./reconcile";

const SYSTEM_SAMPLE_MS = 3_000;

/** Periodically sample the collector process (CPU/RAM/uptime) + REST call rate. */
function startSystemSampler(): NodeJS.Timeout {
  let lastCpu = process.cpuUsage();
  let lastAt = Date.now();
  let lastRestTotal = getSystemMetrics().restCallsTotal;

  return setInterval(() => {
    const now = Date.now();
    const elapsedMs = Math.max(now - lastAt, 1);
    const cpu = process.cpuUsage(lastCpu); // microseconds of CPU time this interval
    lastCpu = process.cpuUsage();
    const cpuPct = ((cpu.user + cpu.system) / 1000 / elapsedMs) * 100;

    const sys = getSystemMetrics();
    const restCallsRate = (sys.restCallsTotal - lastRestTotal) / (elapsedMs / 60_000);
    lastRestTotal = sys.restCallsTotal;
    lastAt = now;

    try {
      updateSystemProcess({
        cpuPct: Math.round(cpuPct * 10) / 10,
        rssBytes: process.memoryUsage().rss,
        uptimeSec: process.uptime(),
        restCallsRate: Math.round(restCallsRate * 10) / 10,
        weightLimit: config.REST_WEIGHT_LIMIT,
      });
    } catch (err) {
      logError("[collector] system sample failed:", err);
    }
  }, SYSTEM_SAMPLE_MS);
}

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

  // 4) Periodic process/usage sampler (CPU/RAM/uptime, REST call rate).
  const systemTimer = startSystemSampler();

  const shutdown = (signal: string) => {
    log(`[collector] ${signal} received, shutting down`);
    clearInterval(reconcileTimer);
    clearInterval(systemTimer);
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
