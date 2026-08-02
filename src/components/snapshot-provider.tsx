"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { STALE_AFTER_MS, useSnapshot } from "@/hooks/useSnapshot";
import type { DashboardSnapshot } from "@/lib/types";

interface SnapshotContextValue {
  snapshot: DashboardSnapshot | null;
  connected: boolean;
  /** True once the held frame is too old to describe the present. */
  stale: boolean;
  /** Age of the held frame in ms, for "마지막 수신 N초 전". */
  staleMs: number;
  /** Selected symbol, shared by every view so it survives navigation. */
  symbol: string;
  setSymbol: (symbol: string) => void;
}

const SnapshotContext = createContext<SnapshotContextValue | null>(null);

/**
 * Holds the single SSE subscription for the whole dashboard shell. Lives in the
 * layout so the header and the page body read the same frame, and so navigating
 * between views doesn't tear down and re-open the stream.
 */
export function SnapshotProvider({ children }: { children: React.ReactNode }) {
  const { snapshot, connected, receivedAt } = useSnapshot();
  const [selected, setSelected] = useState("");

  // Staleness is a function of elapsed time, so it needs its own tick — otherwise
  // a stream that dies silently never triggers a re-render and the page keeps
  // claiming the last frame is current.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const staleMs = receivedAt === null ? 0 : Math.max(0, now - receivedAt);
  const stale = receivedAt !== null && staleMs > STALE_AFTER_MS;

  const value = useMemo<SnapshotContextValue>(
    () => ({
      snapshot,
      connected,
      stale,
      staleMs,
      // Resolve the default here rather than in each view, so "no choice yet"
      // never leaks into the pages as a sentinel.
      symbol: selected || snapshot?.symbols[0] || "",
      setSymbol: setSelected,
    }),
    [snapshot, connected, stale, staleMs, selected],
  );

  return <SnapshotContext.Provider value={value}>{children}</SnapshotContext.Provider>;
}

function useSnapshotContext(): SnapshotContextValue {
  const ctx = useContext(SnapshotContext);
  if (!ctx) throw new Error("useDashboardSnapshot must be used within <SnapshotProvider>");
  return ctx;
}

/** For the shell, which decides between the loading state and the views. */
export function useDashboardSnapshot(): SnapshotContextValue {
  return useSnapshotContext();
}

/**
 * For views rendered below the shell's loading gate, where a snapshot is
 * guaranteed — saves every page an unreachable null branch.
 */
export function useLoadedSnapshot(): Omit<SnapshotContextValue, "snapshot"> & {
  snapshot: DashboardSnapshot;
} {
  const ctx = useSnapshotContext();
  if (!ctx.snapshot) throw new Error("useLoadedSnapshot used above the shell's loading gate");
  return { ...ctx, snapshot: ctx.snapshot };
}
