import { describe, expect, it } from "vitest";
import { sparkline } from "./banner";

describe("sparkline", () => {
  it("renders nothing for an empty series", () => {
    expect(sparkline([])).toBe("");
  });

  it("draws a flat series at mid height rather than collapsing to the floor", () => {
    // A constant price is not "the lowest possible price" — rendering it as ▁
    // would read as a crash.
    expect(sparkline([100, 100, 100, 100])).toBe("▄▄▄▄");
  });

  it("puts the minimum at the bottom and the maximum at the top", () => {
    const out = sparkline([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(out.at(0)).toBe("▁");
    expect(out.at(-1)).toBe("█");
  });

  it("is monotonic for a monotonic series", () => {
    const out = [...sparkline([1, 2, 3, 4, 5, 6, 7, 8])];
    const heights = out.map((c) => "▁▂▃▄▅▆▇█".indexOf(c));
    for (let i = 1; i < heights.length; i++) {
      expect(heights[i]).toBeGreaterThanOrEqual(heights[i - 1]);
    }
  });

  it("downsamples a long series to the requested width", () => {
    expect(sparkline(Array.from({ length: 5000 }, (_, i) => i), 48)).toHaveLength(48);
  });

  it("keeps a short series at its own length", () => {
    expect(sparkline([1, 5, 2], 48)).toHaveLength(3);
  });

  it("handles a single sample", () => {
    expect(sparkline([42])).toBe("▄");
  });

  it("never emits a character outside the block ramp", () => {
    const noisy = Array.from({ length: 300 }, () => Math.random() * 1000);
    for (const ch of sparkline(noisy)) expect("▁▂▃▄▅▆▇█").toContain(ch);
  });
});
