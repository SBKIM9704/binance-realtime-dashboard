import { config } from "../lib/config";
import { logRaw } from "./logger";
import { amber, bold, dim, green, red } from "./style";

/**
 * Startup banner and readiness card for the collector.
 *
 * A logo on its own is noise you learn to grep past, so the banner carries the
 * facts an operator would otherwise have to go read the env for: which symbols,
 * which interval, what history is being kept, where the database is. The readiness
 * card after backfill then shows what actually landed — including a sparkline of
 * the prices just collected, which is the cheapest possible proof that the numbers
 * are real and not zeros.
 *
 * The wait between the two is covered by the progress block in `progress.ts`.
 */
const WORDMARK = [
  "  █▀▄▀█ ▄▀█ █▀█ █▄▀ █▀▀ ▀█▀   █▀▄ █▀▀ █▀ █▄▀",
  "  █ ▀ █ █▀█ █▀▄ █ █ ██▄  █    █▄▀ ██▄ ▄█ █ █",
];

const BLOCKS = "▁▂▃▄▅▆▇█";

/**
 * One-line price sparkline from a series of closes.
 * A flat series renders as a flat line rather than collapsing to the lowest block.
 */
export function sparkline(values: number[], width = 48): string {
  if (values.length === 0) return "";

  // Downsample by bucket average so a long series still fits one line.
  const step = values.length / Math.min(width, values.length);
  const sampled: number[] = [];
  for (let i = 0; i < values.length; i += step) {
    const slice = values.slice(Math.floor(i), Math.max(Math.floor(i + step), Math.floor(i) + 1));
    sampled.push(slice.reduce((a, b) => a + b, 0) / slice.length);
  }

  const min = Math.min(...sampled);
  const max = Math.max(...sampled);
  const span = max - min;
  if (span === 0) return BLOCKS[3].repeat(sampled.length);

  return sampled
    .map((v) => BLOCKS[Math.min(BLOCKS.length - 1, Math.floor(((v - min) / span) * BLOCKS.length))])
    .join("");
}

/** Printed once at process start, before any work begins. */
export function printBanner(): void {
  const tiers =
    config.historyTiers.length > 0
      ? config.historyTiers.map((h) => `${h.interval}:${h.days ?? "all"}`).join(" ")
      : "—";

  const rows: [string, string][] = [
    ["symbols", config.symbols.join(" · ")],
    ["interval", `${config.KLINE_INTERVAL}  ${dim(`(view roll-ups derived on read)`)}`],
    ["history", tiers],
    ["retention", `${config.RETENTION_DAYS}d  ${dim("(live interval only)")}`],
    ["database", config.DB_PATH],
  ];

  const lines = [
    "",
    ...WORDMARK.map((l) => amber(l)),
    dim("  Binance realtime collector"),
    "",
    ...rows.map(([k, v]) => `  ${dim(k.padEnd(10))}${v}`),
    "",
  ];
  logRaw(lines.join("\n"));
}

export interface ReadyRow {
  symbol: string;
  records: number;
  closes: number[];
  gapsFilled: number;
  gapsDetected: number;
}

/** Printed once backfill has settled and the stream is live. */
export function printReady(rows: ReadyRow[], elapsedMs: number): void {
  const lines: string[] = ["", `  ${bold(green("● ready"))}  ${dim(`backfill ${(elapsedMs / 1000).toFixed(1)}s`)}`, ""];

  for (const r of rows) {
    const recovery = r.gapsDetected > 0 ? (r.gapsFilled / r.gapsDetected) * 100 : 100;
    const health = recovery >= 100 ? green("✓") : recovery >= 95 ? amber("!") : red("✗");
    const last = r.closes.at(-1);
    const first = r.closes[0];
    const changePct = first && last ? ((last - first) / first) * 100 : 0;

    lines.push(
      `  ${bold(r.symbol.padEnd(9))}${dim(`${r.records.toLocaleString().padStart(9)} rows`)}` +
        `  ${amber(sparkline(r.closes))}`,
    );
    lines.push(
      `  ${" ".repeat(9)}${dim(
        `${last != null ? last.toLocaleString() : "—"}  ${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}%` +
          `   gaps ${r.gapsFilled}/${r.gapsDetected} ${health}`,
      )}`,
    );
  }

  lines.push("");
  logRaw(lines.join("\n"));
}
