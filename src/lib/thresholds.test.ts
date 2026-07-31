import { describe, expect, it } from "vitest";
import {
  errorRateTier,
  lagTier,
  msgRateTier,
  recoveryTier,
  weightTier,
  wsTier,
} from "./thresholds";

describe("lagTier", () => {
  it("classifies by <5s / 5–30s / >30s", () => {
    expect(lagTier(null)).toBe("warn");
    expect(lagTier(4_000)).toBe("ok");
    expect(lagTier(5_000)).toBe("ok");
    expect(lagTier(5_001)).toBe("warn");
    expect(lagTier(30_000)).toBe("warn");
    expect(lagTier(30_001)).toBe("crit");
  });
});

describe("recoveryTier", () => {
  it("classifies by 100 / 95–99 / <95", () => {
    expect(recoveryTier(null)).toBe("ok");
    expect(recoveryTier(100)).toBe("ok");
    expect(recoveryTier(99.9)).toBe("warn");
    expect(recoveryTier(95)).toBe("warn");
    expect(recoveryTier(94.9)).toBe("crit");
  });
});

describe("weightTier", () => {
  it("classifies by <70% / 70–90% / >90%", () => {
    expect(weightTier(0, 6000)).toBe("ok");
    expect(weightTier(4199, 6000)).toBe("ok"); // 69.98%
    expect(weightTier(4200, 6000)).toBe("warn"); // 70%
    expect(weightTier(5400, 6000)).toBe("warn"); // 90%
    expect(weightTier(5460, 6000)).toBe("crit"); // 91%
    expect(weightTier(100, 0)).toBe("ok"); // guard: no limit
  });
});

describe("errorRateTier", () => {
  it("classifies by 0 / 1–5 / >5 per min", () => {
    expect(errorRateTier(0)).toBe("ok");
    expect(errorRateTier(1)).toBe("warn");
    expect(errorRateTier(5)).toBe("warn");
    expect(errorRateTier(6)).toBe("crit");
  });
});

describe("msgRateTier", () => {
  it("flags connected-but-silent and disconnected as crit", () => {
    expect(msgRateTier(false, 100)).toBe("crit");
    expect(msgRateTier(true, 0)).toBe("crit");
    expect(msgRateTier(true, 5)).toBe("ok");
  });
});

describe("wsTier", () => {
  it("ok when connected, crit when down", () => {
    expect(wsTier(true)).toBe("ok");
    expect(wsTier(false)).toBe("crit");
  });
});
