import { getDb } from "../db";
import type { SystemMetrics } from "../types";

interface SystemRow {
  cpu_pct: number;
  rss_bytes: number;
  uptime_sec: number;
  rest_calls_total: number;
  rest_calls_rate: number;
  rest_retry_count: number;
  rate_limited_count: number;
  server_error_count: number;
  used_weight: number;
  weight_limit: number;
  updated_at: number;
}

export function getSystemMetrics(): SystemMetrics {
  const r = getDb()
    .prepare("SELECT * FROM system_metrics WHERE id = 1")
    .get() as SystemRow | undefined;
  return {
    cpuPct: r?.cpu_pct ?? 0,
    rssBytes: r?.rss_bytes ?? 0,
    uptimeSec: r?.uptime_sec ?? 0,
    restCallsTotal: r?.rest_calls_total ?? 0,
    restCallsRate: r?.rest_calls_rate ?? 0,
    restRetryCount: r?.rest_retry_count ?? 0,
    rateLimitedCount: r?.rate_limited_count ?? 0,
    serverErrorCount: r?.server_error_count ?? 0,
    usedWeight: r?.used_weight ?? 0,
    weightLimit: r?.weight_limit ?? 0,
    updatedAt: r?.updated_at ?? 0,
  };
}

/** Patch the process/usage fields sampled periodically by the collector. */
export function updateSystemProcess(patch: {
  cpuPct: number;
  rssBytes: number;
  uptimeSec: number;
  restCallsRate: number;
  weightLimit: number;
}): void {
  getDb()
    .prepare(
      `UPDATE system_metrics SET
         cpu_pct = @cpuPct, rss_bytes = @rssBytes, uptime_sec = @uptimeSec,
         rest_calls_rate = @restCallsRate, weight_limit = @weightLimit, updated_at = @updatedAt
       WHERE id = 1`,
    )
    .run({ ...patch, updatedAt: Date.now() });
}

type SystemCounter =
  | "rest_calls_total"
  | "rest_retry_count"
  | "rate_limited_count"
  | "server_error_count";

/** Atomically bump a REST usage counter. */
export function incrementSystem(column: SystemCounter, by = 1): void {
  getDb()
    .prepare(`UPDATE system_metrics SET ${column} = ${column} + ? WHERE id = 1`)
    .run(by);
}

export function setUsedWeight(weight: number): void {
  getDb().prepare("UPDATE system_metrics SET used_weight = ? WHERE id = 1").run(weight);
}
