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

export function fmtClock(ts: number | null | undefined): string {
  if (ts == null) return "—";
  return new Date(ts).toLocaleTimeString("en-GB", { hour12: false });
}

export function fmtTimeAgo(ts: number | null | undefined, now: number): string {
  if (ts == null) return "—";
  return fmtDuration(now - ts) + " ago";
}
