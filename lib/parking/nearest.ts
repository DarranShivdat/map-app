import type { Feature, FeatureCollection, LineString, MultiLineString, Position } from "geojson";
import type { LatLng } from "@/lib/map/types";
import { closestOnSegment, makeProjector, walkMinutes, type XY } from "@/lib/geo/distance";

export type ParkingFeature = Feature<LineString | MultiLineString>;

export interface NearestResult {
  feature: ParkingFeature;
  /** Straight-line distance from origin to the closest point on the block. */
  distanceMeters: number;
  /** Estimated walking time, whole minutes. */
  walkMin: number;
  /** The closest point on the block segment (for routing/markers). */
  snapped: LatLng;
}

/** Yield each polyline part's coordinates for a (Multi)LineString feature. */
function parts(feature: ParkingFeature): Position[][] {
  const g = feature.geometry;
  return g.type === "LineString" ? [g.coordinates] : g.coordinates;
}

/**
 * Find the `k` nearest metered blocks to `origin` using true point-to-segment
 * (perpendicular) distance, ranked by straight-line walking distance.
 *
 * Linear scan over all ~11k features — no spatial index. Runs client-side on
 * the already-loaded GeoJSON.
 */
export function findNearest(
  origin: LatLng,
  data: FeatureCollection,
  k = 5
): NearestResult[] {
  const proj = makeProjector(origin.lat);
  const o = proj.project(origin);

  const scored: { feature: ParkingFeature; dist2: number; snap: XY }[] = [];

  for (const feature of data.features as ParkingFeature[]) {
    let bestDist2 = Infinity;
    let bestSnap: XY | null = null;

    for (const line of parts(feature)) {
      for (let i = 1; i < line.length; i++) {
        const a = proj.project({ lng: line[i - 1][0], lat: line[i - 1][1] });
        const b = proj.project({ lng: line[i][0], lat: line[i][1] });
        const { point, dist2 } = closestOnSegment(o, a, b);
        if (dist2 < bestDist2) {
          bestDist2 = dist2;
          bestSnap = point;
        }
      }
    }

    if (bestSnap) scored.push({ feature, dist2: bestDist2, snap: bestSnap });
  }

  scored.sort((x, y) => x.dist2 - y.dist2);

  return scored.slice(0, k).map(({ feature, dist2, snap }) => {
    const distanceMeters = Math.sqrt(dist2);
    return {
      feature,
      distanceMeters,
      walkMin: walkMinutes(distanceMeters),
      snapped: proj.unproject(snap),
    };
  });
}
