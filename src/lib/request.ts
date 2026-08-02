import { config } from "./config";

/**
 * Shared query parsing for the read endpoints, so they agree on what a bad request
 * is. Returns the resolved value or an error message for the caller to 400 with.
 */
export function parseSymbol(params: URLSearchParams): { symbol: string } | { error: string } {
  const symbol = (params.get("symbol") ?? config.symbols[0]).toUpperCase();
  if (!config.symbols.includes(symbol)) return { error: `Unknown symbol "${symbol}"` };
  return { symbol };
}

/** Clamped positive integer, defaulting when absent or unparseable. */
export function parseLimit(params: URLSearchParams, fallback: number, max: number): number {
  const raw = Number(params.get("limit") ?? fallback);
  if (!Number.isFinite(raw)) return fallback;
  return Math.min(Math.max(Math.trunc(raw), 1), max);
}
