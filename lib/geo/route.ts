import type { LatLng } from "@/lib/map/types";
import type { RoutePath } from "@/app/api/route/route";

/**
 * Best-effort walking path from origin to destination via the OSRM proxy.
 * Returns null on any failure (timeout, 204, offline) so callers can keep
 * showing the straight-line connector without surfacing an error.
 */
export async function fetchWalkingRoute(
  origin: LatLng,
  dest: LatLng,
  signal?: AbortSignal
): Promise<LatLng[] | null> {
  try {
    const qs = new URLSearchParams({
      oLat: String(origin.lat),
      oLng: String(origin.lng),
      dLat: String(dest.lat),
      dLng: String(dest.lng),
    });
    const res = await fetch(`/api/route?${qs}`, { signal });
    if (!res.ok) return null; // 204/4xx -> keep straight line
    const path = (await res.json()) as RoutePath;
    return path.coordinates.map(([lng, lat]) => ({ lat, lng }));
  } catch {
    return null;
  }
}
