import { z } from "zod";
import { COLLECTABLE_INTERVALS, INTERVAL_TO_MS } from "./intervals";

/**
 * Centralised, validated runtime configuration.
 * Next.js auto-loads `.env`; the collector loads it via dotenv (see collector/index.ts).
 */
const schema = z.object({
  BINANCE_REST_BASE: z.string().url().default("https://api.binance.com"),
  BINANCE_WS_BASE: z.string().default("wss://stream.binance.com:9443"),
  SYMBOLS: z.string().default("BTCUSDT,ETHUSDT"),
  KLINE_INTERVAL: z.string().default("1s"),
  BACKFILL_DAYS: z.coerce.number().positive().default(3),
  RECONCILE_INTERVAL_MS: z.coerce.number().positive().default(60_000),
  RECONCILE_WINDOW_MS: z.coerce.number().positive().default(30 * 60 * 1000),
  DB_PATH: z.string().default("./data/market.db"),
  // Delete klines/events older than this many days (caps DB growth at 1s granularity).
  // Only the collected interval is pruned; history tiers below are kept forever.
  RETENTION_DAYS: z.coerce.number().positive().default(7),

  /**
   * Coarse history kept alongside the 1s operational data, as `interval:days`
   * pairs (`0` days = everything Binance has for the symbol).
   *
   * 1s cannot span real history — nine years of it is ~283M candles and ~25GB per
   * symbol — so long ranges are served from coarser tiers instead. The default
   * costs about 250 REST requests and ~20MB total for two symbols.
   * Set to an empty string to disable history backfill entirely.
   */
  HISTORY_TIERS: z.string().default("1m:30,1h:0"),

  // --- REST rate-limit safeguards ---
  // Delay inserted between paginated backfill requests so large backfills never burst.
  REST_THROTTLE_MS: z.coerce.number().nonnegative().default(250),
  // Max retries for a single REST call on 429/418/5xx before giving up.
  REST_MAX_RETRIES: z.coerce.number().nonnegative().default(4),
  // Binance IP weight budget per minute (REQUEST_WEIGHT). Real value is 6000.
  REST_WEIGHT_LIMIT: z.coerce.number().positive().default(6000),
  // Soft threshold (fraction of the budget) at which we proactively pace requests.
  REST_WEIGHT_SOFT_PCT: z.coerce.number().min(0.1).max(1).default(0.8),
});

const parsed = schema.parse(process.env);

const collectable: readonly string[] = COLLECTABLE_INTERVALS;
if (!collectable.includes(parsed.KLINE_INTERVAL)) {
  throw new Error(
    `Unsupported KLINE_INTERVAL "${parsed.KLINE_INTERVAL}". Supported: ${collectable.join(", ")}`,
  );
}
const intervalMs = INTERVAL_TO_MS[parsed.KLINE_INTERVAL];

/** One coarse history tier: which interval to store, and how far back. */
export interface HistoryTier {
  interval: string;
  /** Days of history; `null` means everything the exchange has. */
  days: number | null;
}

function parseHistoryTiers(spec: string): HistoryTier[] {
  const tiers: HistoryTier[] = [];
  for (const part of spec.split(",").map((s) => s.trim()).filter(Boolean)) {
    const [interval, rawDays] = part.split(":").map((s) => s.trim());
    if (!collectable.includes(interval)) {
      throw new Error(
        `HISTORY_TIERS: "${interval}" is not a collectable interval (${collectable.join(", ")})`,
      );
    }
    if (interval === parsed.KLINE_INTERVAL) continue; // the base tier is not "history"
    const days = Number(rawDays ?? 0);
    if (!Number.isFinite(days) || days < 0) {
      throw new Error(`HISTORY_TIERS: bad day count in "${part}"`);
    }
    tiers.push({ interval, days: days === 0 ? null : days });
  }
  // Finest first, so source selection can take the first tier that fits.
  return tiers.sort((a, b) => INTERVAL_TO_MS[a.interval] - INTERVAL_TO_MS[b.interval]);
}

const historyTiers = parseHistoryTiers(parsed.HISTORY_TIERS);

export const config = {
  ...parsed,
  /** Normalised symbol list, e.g. ["BTCUSDT", "ETHUSDT"]. */
  symbols: parsed.SYMBOLS.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean),
  /** Duration of one candle in ms. */
  intervalMs,
  /** Coarse history tiers, finest first. */
  historyTiers,
  /** Every stored interval, finest first: the collected one plus its history tiers. */
  storedIntervals: [parsed.KLINE_INTERVAL, ...historyTiers.map((h) => h.interval)].sort(
    (a, b) => INTERVAL_TO_MS[a] - INTERVAL_TO_MS[b],
  ),
};

export type AppConfig = typeof config;
