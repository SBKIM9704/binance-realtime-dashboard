import "dotenv/config";
import { config } from "../lib/config";
import { getDb } from "../lib/db";
import { pruneKlinesBefore } from "../lib/repositories/klines";
import { addEvent, ensureStatus, pruneEventsBefore, updateStatus } from "../lib/repositories/pipeline";
import { getSystemMetrics, updateSystemProcess } from "../lib/repositories/system";
import { Ingestor } from "./ingest";
import { log, logError } from "./logger";
import { reconcileAll } from "./reconcile";

const SYSTEM_SAMPLE_MS = 3_000;
const RETENTION_INTERVAL_MS = 60 * 60 * 1000;

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

/** Delete klines/events older than the retention window (caps DB growth at 1s). */
function runRetention(): void {
  const cutoff = Date.now() - config.RETENTION_DAYS * 24 * 60 * 60 * 1000;
  try {
    const removed = pruneKlinesBefore(config.KLINE_INTERVAL, cutoff) + pruneEventsBefore(cutoff);
    if (removed > 0) {
      log(`[retention] pruned ${removed} row(s) older than ${config.RETENTION_DAYS}d`);
    }
  } catch (err) {
    logError("[retention] prune failed:", err);
  }
}

async function main(): Promise<void> {
  log("[collector] starting");
  log(`[collector] symbols=${config.symbols.join(",")} interval=${config.KLINE_INTERVAL}`);

  // Open DB (runs migrations), ensure status rows, trim old data on boot.
  getDb();
  for (const symbol of config.symbols) ensureStatus(symbol);
  runRetention();

  // Live ingestion first: the WS 'open' handler backfills first-run/gap history
  // in the background, so live candles appear immediately (important at 1s).
  const ingestor = new Ingestor();
  ingestor.start();

  // Periodic reconciler, process sampler, and retention pruning.
  const reconcileTimer = setInterval(() => {
    reconcileAll().catch((err) => logError("[collector] reconcile pass failed:", err));
  }, config.RECONCILE_INTERVAL_MS);
  const systemTimer = startSystemSampler();
  const retentionTimer = setInterval(runRetention, RETENTION_INTERVAL_MS);

  const shutdown = (signal: string) => {
    log(`[collector] ${signal} received, shutting down`);
    clearInterval(reconcileTimer);
    clearInterval(systemTimer);
    clearInterval(retentionTimer);
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
