/** Client-safe formatting helpers for the dashboard. */

export function fmtPrice(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "—";
  const digits = v >= 1000 ? 2 : v >= 1 ? 3 : 6;
  return v.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function fmtPct(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

export function fmtCompact(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "—";
  return v.toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 2 });
}

export function fmtInt(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "—";
  return Math.round(v).toLocaleString("en-US");
}

/** Human-readable duration, e.g. "3.4s", "2m 10s", "—". */
export function fmtDuration(ms: number | null | undefined): string {
  if (ms == null || Number.isNaN(ms)) return "—";
  if (ms < 0) ms = 0;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rem = Math.floor(s % 60);
  if (m < 60) return `${m}m ${rem}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function fmtBytes(bytes: number | null | undefined): string {
  if (bytes == null || Number.isNaN(bytes) || bytes <= 0) return "—";
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(0)}MB`;
  return `${(mb / 1024).toFixed(2)}GB`;
}

export function fmtUptime(sec: number | null | undefined): string {
  if (sec == null || Number.isNaN(sec) || sec <= 0) return "—";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  const s = Math.floor(sec % 60);
  return `${m}m ${s}s`;
}

/**
 * Volatility in basis points.
 *
 * The raw figure is a log-return standard deviation — around 4e-5 per candle for
 * BTCUSDT. Rendered as a percentage with two decimals it is always "0.00%", which
 * reads as an unimplemented metric rather than a small number. Basis points put
 * the value in a range a reader can actually compare.
 */
export function fmtBps(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "—";
  return `${(v * 10_000).toFixed(2)} bp`;
}

/**
 * Spread measured in ticks, or null when the book is unknown.
 *
 * For BTCUSDT and ETHUSDT the book is essentially always exactly one tick wide, so
 * a percentage alone is a constant 0.000%/0.001% that carries no information. The
 * tick count is what makes a widening book legible: 1 tick is the floor, 3 is news.
 * The caller supplies the wording, so this stays out of the i18n dictionary's way.
 */
export function spreadTicks(
  bid: number | null | undefined,
  ask: number | null | undefined,
  tickSize: number,
): number | null {
  if (bid == null || ask == null || bid <= 0 || tickSize <= 0) return null;
  return Math.max(1, Math.round((ask - bid) / tickSize));
}

/** Calendar date, for coverage statements ("2017-08-17부터"). */
export function fmtDate(ts: number | null | undefined): string {
  if (ts == null) return "—";
  return new Date(ts).toISOString().slice(0, 10);
}

/** Wall clock, 24h. `seconds: false` drops the seconds for coarse candle axes. */
export function fmtClock(ts: number | null | undefined, opts?: { seconds?: boolean }): string {
  if (ts == null) return "—";
  return new Date(ts).toLocaleTimeString("en-GB", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    ...(opts?.seconds === false ? {} : { second: "2-digit" }),
  });
}

/**
 * Elapsed time. The caller supplies the wording — this used to append a hardcoded
 * " ago", which rendered "5.2s ago" in the Korean UI.
 */
export function fmtTimeAgo(
  ts: number | null | undefined,
  now: number,
  suffix: (age: string) => string = (age) => `${age} ago`,
): string {
  if (ts == null) return "—";
  return suffix(fmtDuration(now - ts));
}
