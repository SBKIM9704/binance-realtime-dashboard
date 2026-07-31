import { describe, expect, it } from "vitest";
import { findMissingBuckets } from "./gaps";

const STEP = 60_000; // 1 minute

describe("findMissingBuckets", () => {
  it("returns nothing when every bucket is present", () => {
    const start = 0;
    const end = 3 * STEP;
    const existing = [0, STEP, 2 * STEP, 3 * STEP];
    expect(findMissingBuckets(existing, start, end, STEP)).toEqual([]);
  });

  it("finds a single missing bucket in the middle", () => {
    const existing = new Set([0, STEP, 3 * STEP]);
    expect(findMissingBuckets(existing, 0, 3 * STEP, STEP)).toEqual([2 * STEP]);
  });

  it("finds scattered gaps", () => {
    const existing = [0, 2 * STEP, 4 * STEP]; // missing 1,3
    expect(findMissingBuckets(existing, 0, 4 * STEP, STEP)).toEqual([STEP, 3 * STEP]);
  });

  it("treats an empty store as all buckets missing (inclusive bounds)", () => {
    expect(findMissingBuckets([], 0, 2 * STEP, STEP)).toEqual([0, STEP, 2 * STEP]);
  });

  it("includes the boundary buckets when missing", () => {
    const existing = [STEP]; // start and end missing
    expect(findMissingBuckets(existing, 0, 2 * STEP, STEP)).toEqual([0, 2 * STEP]);
  });

  it("throws on non-positive step (guards against infinite loop)", () => {
    expect(() => findMissingBuckets([], 0, STEP, 0)).toThrow();
  });
});
