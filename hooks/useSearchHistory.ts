"use client";

import { useCallback, useState } from "react";
import type { GeocodeHit } from "@/lib/geo/geocode";

const KEY = "parking:recent-searches";
const MAX = 8;

/** ~11 m cell — collapses re-searches of the same place. */
function cellOf(h: GeocodeHit): string {
  return `${h.lat.toFixed(4)},${h.lng.toFixed(4)}`;
}

/**
 * Per-browser recent-search history, persisted in localStorage. No backend —
 * the list is read once on mount and rewritten on each add (most-recent-first,
 * deduped by location, capped at MAX).
 */
export function useSearchHistory() {
  // Lazy init reads storage once on the client. Recents aren't in the initial
  // (closed) dropdown DOM, so there's no SSR hydration mismatch to worry about.
  const [recents, setRecents] = useState<GeocodeHit[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as GeocodeHit[];
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Corrupt/blocked storage — start empty.
    }
    return [];
  });

  const add = useCallback((hit: GeocodeHit) => {
    setRecents((prev) => {
      const next = [hit, ...prev.filter((h) => cellOf(h) !== cellOf(hit))].slice(0, MAX);
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        // Storage unavailable — keep it in memory for this session.
      }
      return next;
    });
  }, []);

  return { recents, add };
}
