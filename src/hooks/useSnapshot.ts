"use client";

import { useEffect, useRef, useState } from "react";
import type { DashboardSnapshot } from "@/lib/types";

/** A frame older than this is no longer describing the present. */
export const STALE_AFTER_MS = 3_000;

export interface SnapshotState {
  snapshot: DashboardSnapshot | null;
  connected: boolean;
  /** When the newest frame arrived, so the UI can tell live values from held ones. */
  receivedAt: number | null;
}

/**
 * Subscribes to the /api/stream SSE endpoint and returns the latest snapshot.
 *
 * The arrival time is part of the return value on purpose. When the stream drops,
 * `snapshot` keeps its last value — that is what lets the page stay rendered — but
 * without a timestamp the UI cannot distinguish a live reading from a frozen one,
 * and a monitoring dashboard that shows stale numbers at full confidence is worse
 * than one that shows nothing.
 */
export function useSnapshot(): SnapshotState {
  const [state, setState] = useState<SnapshotState>({
    snapshot: null,
    connected: false,
    receivedAt: null,
  });
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource("/api/stream");
    esRef.current = es;

    es.onopen = () => setState((s) => ({ ...s, connected: true }));
    es.onmessage = (e) => {
      try {
        const snapshot = JSON.parse(e.data) as DashboardSnapshot;
        setState({ snapshot, connected: true, receivedAt: Date.now() });
      } catch {
        /* ignore malformed frame */
      }
    };
    es.onerror = () => setState((s) => ({ ...s, connected: false }));

    return () => es.close();
  }, []);

  return state;
}
