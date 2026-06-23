import type { LatLng } from "@/lib/map/types";

const R = 6371000; // Earth radius, metres
const D2R = Math.PI / 180;

/** Local planar point in metres relative to a projection origin. */
export interface XY {
  x: number;
  y: number;
}

/**
 * Equirectangular projection centred on `lat0`. Distances are accurate to a
 * fraction of a percent at city scale, which is all we need for ranking
 * walking distances within NYC, and it's far cheaper than per-vertex haversine.
 */
export function makeProjector(lat0: number) {
  const cos = Math.cos(lat0 * D2R);
  return {
    project(p: LatLng): XY {
      return { x: R * D2R * p.lng * cos, y: R * D2R * p.lat };
    },
    unproject(xy: XY): LatLng {
      return { lat: xy.y / (R * D2R), lng: xy.x / (R * D2R * cos) };
    },
  };
}

/** Great-circle distance between two coordinates, metres. */
export function haversine(a: LatLng, b: LatLng): number {
  const dLat = (b.lat - a.lat) * D2R;
  const dLng = (b.lng - a.lng) * D2R;
  const lat1 = a.lat * D2R;
  const lat2 = b.lat * D2R;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Closest point on segment AB to point P, plus the squared distance — all in
 * planar metre space. Returns squared distance to avoid sqrt in hot loops.
 */
export function closestOnSegment(
  p: XY,
  a: XY,
  b: XY
): { point: XY; dist2: number } {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  let t = 0;
  if (len2 > 0) {
    t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2;
    t = t < 0 ? 0 : t > 1 ? 1 : t; // clamp onto the segment
  }
  const point = { x: a.x + t * abx, y: a.y + t * aby };
  const dx = p.x - point.x;
  const dy = p.y - point.y;
  return { point, dist2: dx * dx + dy * dy };
}

/** Rough walking time in whole minutes at ~80 m/min (~4.8 km/h). */
export function walkMinutes(metres: number): number {
  return Math.max(1, Math.round(metres / 80));
}
