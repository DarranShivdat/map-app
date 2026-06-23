import type { LatLng } from "@/lib/map/types";
import type { NearestResult } from "./nearest";

/**
 * Client-side wrapper for the server nearest-search. The ranking itself runs in
 * /api/nearest over the full dataset (see lib/parking/nearest); the client only
 * holds the current viewport, so it can't compute this locally.
 */
export async function fetchNearest(origin: LatLng, k = 5): Promise<NearestResult[]> {
  const res = await fetch(`/api/nearest?lat=${origin.lat}&lng=${origin.lng}&k=${k}`);
  if (!res.ok) throw new Error(`nearest search failed: HTTP ${res.status}`);
  return (await res.json()) as NearestResult[];
}
