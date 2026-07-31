import { z } from "zod";

/**
 * Centralised, validated runtime configuration.
 * Next.js auto-loads `.env`; the collector loads it via dotenv (see collector/index.ts).
 */
const schema = z.object({
  BINANCE_REST_BASE: z.string().url().default("https://api.binance.com"),
  BINANCE_WS_BASE: z.string().default("wss://stream.binance.com:9443"),
  SYMBOLS: z.string().default("BTCUSDT,ETHUSDT"),
  KLINE_INTERVAL: z.string().default("1m"),
  BACKFILL_DAYS: z.coerce.number().positive().default(3),
  RECONCILE_INTERVAL_MS: z.coerce.number().positive().default(60_000),
  RECONCILE_WINDOW_MS: z.coerce.number().positive().default(6 * 60 * 60 * 1000),
  DB_PATH: z.string().default("./data/market.db"),

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

/** Milliseconds per supported kline interval. */
const INTERVAL_TO_MS: Record<string, number> = {
  "1m": 60_000,
  "3m": 180_000,
  "5m": 300_000,
  "15m": 900_000,
  "1h": 3_600_000,
};

const intervalMs = INTERVAL_TO_MS[parsed.KLINE_INTERVAL];
if (!intervalMs) {
  throw new Error(
    `Unsupported KLINE_INTERVAL "${parsed.KLINE_INTERVAL}". Supported: ${Object.keys(INTERVAL_TO_MS).join(", ")}`,
  );
}

export const config = {
  ...parsed,
  /** Normalised symbol list, e.g. ["BTCUSDT", "ETHUSDT"]. */
  symbols: parsed.SYMBOLS.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean),
  /** Duration of one candle in ms. */
  intervalMs,
};

export type AppConfig = typeof config;
