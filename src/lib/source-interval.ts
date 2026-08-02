import { INTERVAL_TO_MS } from "./intervals";

/** What a stored tier can actually offer over a range: how far back, and how complete. */
export interface TierStats {
  /** Oldest stored open_time for the interval. */
  from: number;
  /** Rows stored at or after the requested range start. */
  rows: number;
}

/**
 * A tier this sparse is not history, it's a sample. The 1s tier only holds what the
 * collector was running for, so it can reach back a week while missing half of it.
 */
const MIN_DENSITY = 0.9;

/**
 * Pick which stored interval feeds a requested roll-up.
 *
 * Three constraints, all hard:
 *   - the source must divide the bucket evenly, or buckets get uneven candle counts
 *   - the source must reach back to the start of the requested range
 *   - the source must be roughly complete over that range
 *
 * The third is what stops a day-long view from being served by a 1s tier that
 * technically starts early enough but has the collector's downtime punched through
 * it. The coarse tiers are REST-backfilled and dense, so stepping down to one
 * trades precision for a chart that isn't full of holes.
 */
export function pickSourceInterval(
  storedIntervals: string[],
  stats: Map<string, TierStats>,
  bucketMs: number,
  rangeStart: number | null,
  now: number = Date.now(),
): string | null {
  const candidates = storedIntervals
    .filter((iv) => {
      const ms = INTERVAL_TO_MS[iv];
      return ms != null && ms <= bucketMs && bucketMs % ms === 0 && stats.has(iv);
    })
    .sort((a, b) => INTERVAL_TO_MS[a] - INTERVAL_TO_MS[b]);

  if (candidates.length === 0) return null;

  const deepest = () =>
    candidates.reduce((best, iv) => (stats.get(iv)!.from < stats.get(best)!.from ? iv : best));

  // `null` range means "everything stored" — that's whichever tier reaches furthest back.
  if (rangeStart === null) return deepest();

  const dense = candidates.find((iv) => {
    const tier = stats.get(iv)!;
    if (tier.from > rangeStart) return false;
    const expected = Math.max(1, (now - Math.max(rangeStart, tier.from)) / INTERVAL_TO_MS[iv]);
    return tier.rows / expected >= MIN_DENSITY;
  });
  if (dense) return dense;

  // Nothing is both deep enough and complete; prefer the most history available.
  return deepest();
}
