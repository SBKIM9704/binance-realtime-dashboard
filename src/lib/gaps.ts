/**
 * Pure gap-detection helper shared by the reconciler.
 *
 * Given the open-times that already exist in [start, end] (stepping by `step`),
 * return the open-times of the buckets that are missing — the candles that need
 * to be backfilled. Kept dependency-free so it is trivially unit-testable.
 */
export function findMissingBuckets(
  existing: Iterable<number>,
  start: number,
  end: number,
  step: number,
): number[] {
  if (step <= 0) throw new Error("step must be positive");
  const set = existing instanceof Set ? existing : new Set(existing);
  const missing: number[] = [];
  for (let t = start; t <= end; t += step) {
    if (!set.has(t)) missing.push(t);
  }
  return missing;
}
