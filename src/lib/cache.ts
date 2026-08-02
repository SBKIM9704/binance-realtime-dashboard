/**
 * Time-boxed memo shared by the per-second read paths.
 *
 * Many tabs poll the same view every second; without this, cost scales with the
 * number of open pages instead of with time. Entries older than their TTL are
 * swept on write so a caller-influenced key space cannot grow unbounded.
 */
const store = new Map<string, { ts: number; value: unknown }>();

export function ttlMemo<T>(key: string, ttlMs: number, compute: () => T): T {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && now - hit.ts < ttlMs) return hit.value as T;

  const value = compute();
  store.set(key, { ts: now, value });

  if (store.size > 64) {
    for (const [k, v] of store) if (now - v.ts >= ttlMs) store.delete(k);
  }
  return value;
}
