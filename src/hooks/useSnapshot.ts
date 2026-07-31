"use client";

import { useEffect, useRef, useState } from "react";
import type { DashboardSnapshot } from "@/lib/types";

/**
 * Subscribes to the /api/stream SSE endpoint and returns the latest snapshot.
 * Falls back to a one-shot /api/health fetch if the stream errors, and lets the
 * browser's EventSource handle reconnection automatically.
 */
export function useSnapshot() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource("/api/stream");
    esRef.current = es;

    es.onopen = () => setConnected(true);
    es.onmessage = (e) => {
      try {
        setSnapshot(JSON.parse(e.data) as DashboardSnapshot);
        setConnected(true);
      } catch {
        /* ignore malformed frame */
      }
    };
    es.onerror = () => setConnected(false);

    return () => es.close();
  }, []);

  return { snapshot, connected };
}
