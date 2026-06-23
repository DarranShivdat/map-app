import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Feature, FeatureCollection, LineString, MultiLineString } from "geojson";
import type { BBox } from "@/lib/map/types";

// Server-only: loads the committed 34 MB GeoJSON once, parses it, and caches
// both the parsed collection and a flat per-feature bbox index in module scope.
// Both the bbox-render endpoint and the nearest-search endpoint share this, so
// the file is parsed at most once per server process.

type ParkingFeature = Feature<LineString | MultiLineString>;

interface Dataset {
  collection: FeatureCollection;
  /** Flat [minLng, minLat, maxLng, maxLat] per feature, parallel to features. */
  bboxes: Float64Array;
}

let promise: Promise<Dataset> | null = null;

function computeBBoxes(features: Feature[]): Float64Array {
  const out = new Float64Array(features.length * 4);
  for (let i = 0; i < features.length; i++) {
    const g = (features[i] as ParkingFeature).geometry;
    const parts = g.type === "LineString" ? [g.coordinates] : g.coordinates;
    let minLng = Infinity;
    let minLat = Infinity;
    let maxLng = -Infinity;
    let maxLat = -Infinity;
    for (const part of parts) {
      for (const [lng, lat] of part) {
        if (lng < minLng) minLng = lng;
        if (lat < minLat) minLat = lat;
        if (lng > maxLng) maxLng = lng;
        if (lat > maxLat) maxLat = lat;
      }
    }
    const o = i * 4;
    out[o] = minLng;
    out[o + 1] = minLat;
    out[o + 2] = maxLng;
    out[o + 3] = maxLat;
  }
  return out;
}

export function loadDataset(): Promise<Dataset> {
  if (!promise) {
    promise = (async () => {
      const file = path.join(process.cwd(), "data", "parking.geojson");
      const collection = JSON.parse(await readFile(file, "utf8")) as FeatureCollection;
      return { collection, bboxes: computeBBoxes(collection.features) };
    })();
  }
  return promise;
}

/**
 * Features whose bounding box intersects `bbox`. If more than `max` match
 * (e.g. the map is zoomed far out), the result is capped and `truncated` is set
 * so the caller can log it — we never silently drop coverage.
 */
export async function featuresInBBox(
  bbox: BBox,
  max: number
): Promise<{ features: Feature[]; matched: number; truncated: boolean }> {
  const { collection, bboxes } = await loadDataset();
  const [w, s, e, n] = bbox;
  const features: Feature[] = [];
  let matched = 0;
  for (let i = 0; i < collection.features.length; i++) {
    const o = i * 4;
    // AABB intersection test against the requested viewport.
    if (bboxes[o] <= e && bboxes[o + 2] >= w && bboxes[o + 1] <= n && bboxes[o + 3] >= s) {
      matched++;
      if (features.length < max) features.push(collection.features[i]);
    }
  }
  return { features, matched, truncated: matched > features.length };
}
