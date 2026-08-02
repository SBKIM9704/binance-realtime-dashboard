import "dotenv/config";
import { config } from "../lib/config";
import { getDb } from "../lib/db";
import { countKlines, getRecentCloses, pruneKlinesBefore } from "../lib/repositories/klines";
import { backfillHistoryTier } from "./backfill";
import { printBanner, printReady } from "./banner";
import {
  addEvent,
  ensureStatus,
  getAllStatus,
  getEventCountSince,
  pruneEventsBefore,
  updateStatus,
} from "../lib/repositories/pipeline";
import { clearBackfillTasks, registerPendingBackfill } from "../lib/repositories/backfill";
import { getSystemMetrics, updateSystemProcess } from "../lib/repositories/system";
import { Ingestor } from "./ingest";
import { log, logError } from "./logger";
import { ProgressConsole } from "./progress";
import { reconcileAll } from "./reconcile";

const SYSTEM_SAMPLE_MS = 3_000;
const RETENTION_INTERVAL_MS = 60 * 60 * 1000;
// Runs often so the finest history tier stays current: the 24h market figures are
// aggregated from it, and an hour of missing candles showed up as ~5% low volume.
// The closed-bucket guard in backfillHistoryTier keeps idle passes free.
const HISTORY_INTERVAL_MS = 60 * 1000;

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

/**
 * Bring the coarse history tiers up to date. Runs in the background — live
 * ingestion and the operational 1s backfill must not wait on nine years of hourly
 * candles — and repeats every HISTORY_INTERVAL_MS so the tiers keep pace without
 * their own WS feed.
 */
async function runHistoryBackfill(): Promise<void> {
  if (config.historyTiers.length === 0) return;
  for (const tier of config.historyTiers) {
    for (const symbol of config.symbols) {
      try {
        await backfillHistoryTier(symbol, tier);
      } catch (err) {
        logError(`[history] ${symbol} ${tier.interval} backfill failed:`, err);
      }
    }
  }
}

/**
 * Wait for backfill to finish, then print what landed.
 *
 * Backfill runs in the background off the WS 'open' handler, so there is no single
 * completion callback to hang this on. Waiting for the row count to stop growing
 * does not work either — the live stream adds a row per second per symbol forever,
 * so it never settles. The `backfill_done` events the pipeline already emits are
 * the actual signal: one per symbol, written when that symbol's fill returns.
 */
async function reportWhenSettled(startedAt: number): Promise<void> {
  const POLL_MS = 500;
  const TIMEOUT_MS = 5 * 60 * 1000;

  while (Date.now() - startedAt < TIMEOUT_MS) {
    if (getEventCountSince(["backfill_done"], startedAt) >= config.symbols.length) break;
    await new Promise((r) => setTimeout(r, POLL_MS));
  }

  const statuses = new Map(getAllStatus().map((s) => [s.symbol, s]));
  printReady(
    config.symbols.map((symbol) => {
      const st = statuses.get(symbol);
      return {
        symbol,
        records: countKlines(symbol, config.KLINE_INTERVAL),
        closes: getRecentCloses(symbol, config.KLINE_INTERVAL, 240).map((p) => p.close),
        gapsFilled: st?.gapsFilled ?? 0,
        gapsDetected: st?.gapsDetected ?? 0,
      };
    }),
    Date.now() - startedAt,
  );
}

async function main(): Promise<void> {
  const startedAt = Date.now();
  printBanner();

  // Open DB (runs migrations), ensure status rows, trim old data on boot.
  getDb();
  for (const symbol of config.symbols) ensureStatus(symbol);
  runRetention();

  // Publish the fill plan before any of it starts, so the console and the dashboard
  // can show the whole cold start from the first frame instead of discovering it
  // one symbol at a time. Rows from the previous process describe nothing.
  clearBackfillTasks();
  for (const symbol of config.symbols) registerPendingBackfill(symbol, config.KLINE_INTERVAL, "live");
  for (const tier of config.historyTiers) {
    for (const symbol of config.symbols) registerPendingBackfill(symbol, tier.interval, "history");
  }
  const progress = new ProgressConsole();
  progress.start();

  // Live ingestion first: the WS 'open' handler backfills first-run/gap history
  // in the background, so live candles appear immediately (important at 1s).
  const ingestor = new Ingestor();
  ingestor.start();

  void reportWhenSettled(startedAt).catch((err) => logError("[collector] ready report failed:", err));

  // Periodic reconciler, process sampler, and retention pruning.
  const reconcileTimer = setInterval(() => {
    reconcileAll().catch((err) => logError("[collector] reconcile pass failed:", err));
  }, config.RECONCILE_INTERVAL_MS);
  const systemTimer = startSystemSampler();
  const retentionTimer = setInterval(runRetention, RETENTION_INTERVAL_MS);

  void runHistoryBackfill();
  const historyTimer = setInterval(() => {
    runHistoryBackfill().catch((err) => logError("[history] pass failed:", err));
  }, HISTORY_INTERVAL_MS);

  const shutdown = (signal: string) => {
    progress.stop(); // restores the cursor before anything else prints
    log(`[collector] ${signal} received, shutting down`);
    clearInterval(reconcileTimer);
    clearInterval(systemTimer);
    clearInterval(retentionTimer);
    clearInterval(historyTimer);
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
