"use client";

import { useCallback, useState } from "react";
import type { LatLng } from "@/lib/map/types";

type GeoStatus = "idle" | "locating" | "ok" | "denied" | "unavailable";

/**
 * Wraps the browser Geolocation API. Never throws — on denial/error/timeout it
 * resolves to null and exposes a status so the UI can fall back to search.
 */
export function useGeolocation() {
  const [status, setStatus] = useState<GeoStatus>("idle");

  const locate = useCallback((): Promise<LatLng | null> => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unavailable");
      return Promise.resolve(null);
    }
    setStatus("locating");
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setStatus("ok");
          resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        (err) => {
          setStatus(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable");
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
      );
    });
  }, []);

  return { status, locate };
}
