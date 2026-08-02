/**
 * Alert thresholds — the single source of truth for "when is action needed".
 * Each function maps a raw metric to a health tier so the UI can colour it
 * green / amber / red. Documented in docs/dashboard-metrics.md.
 */
export type Tier = "ok" | "warn" | "crit";

/**
 * The "ok" bound, written the way it should appear next to the value.
 *
 * The colour contract was advertised in the README and invisible on screen: a green
 * "0.8s" is unverifiable unless the reader also knows the bar was "< 5s". Keeping
 * the strings here means the printed contract cannot drift from the functions below.
 */
export const THRESHOLD_LABEL = {
  lag: "< 5s",
  recovery: "100%",
  weight: "< 70%",
  errorRate: "0/min",
} as const;

/** Ingestion lag: < 5s ok, 5–30s warn, > 30s crit. */
export function lagTier(lagMs: number | null): Tier {
  if (lagMs == null) return "warn";
  if (lagMs <= 5_000) return "ok";
  if (lagMs <= 30_000) return "warn";
  return "crit";
}

/** Gap recovery rate: 100% ok, 95–99% warn, < 95% crit. */
export function recoveryTier(pct: number | null): Tier {
  if (pct == null) return "ok";
  if (pct >= 100) return "ok";
  if (pct >= 95) return "warn";
  return "crit";
}

/** REST weight usage: < 70% ok, 70–90% warn, > 90% crit. */
export function weightTier(used: number, limit: number): Tier {
  if (limit <= 0) return "ok";
  const pct = (used / limit) * 100;
  if (pct < 70) return "ok";
  if (pct <= 90) return "warn";
  return "crit";
}

/** Error rate (events/min): 0 ok, 1–5 warn, > 5 crit. */
export function errorRateTier(perMin: number): Tier {
  if (perMin <= 0) return "ok";
  if (perMin <= 5) return "warn";
  return "crit";
}

/** WS liveness: connected with data flowing ok; connected-but-silent or down crit. */
export function msgRateTier(connected: boolean, rate: number): Tier {
  if (!connected) return "crit";
  return rate > 0 ? "ok" : "crit";
}

/** WS connection state. */
export function wsTier(connected: boolean): Tier {
  return connected ? "ok" : "crit";
}
