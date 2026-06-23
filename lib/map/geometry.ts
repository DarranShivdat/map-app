import type { Feature, LineString, MultiLineString, Position } from "geojson";
import type { LatLng } from "./types";

/** Flatten a (Multi)LineString feature into a single ordered list of vertices. */
function lineCoords(geom: LineString | MultiLineString): Position[] {
  if (geom.type === "LineString") return geom.coordinates;
  // MultiLineString: concatenate parts; good enough for a representative point.
  return geom.coordinates.flat();
}

/**
 * The point halfway along a line segment, measured by cumulative 2D length.
 * Used to place a tappable marker at the "middle" of a block segment.
 * Coordinates are GeoJSON [lng, lat].
 */
export function lineMidpoint(
  feature: Feature<LineString | MultiLineString>
): LatLng | null {
  const coords = lineCoords(feature.geometry);
  if (coords.length === 0) return null;
  if (coords.length === 1) return { lng: coords[0][0], lat: coords[0][1] };

  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    total += dist(coords[i - 1], coords[i]);
  }
  const half = total / 2;

  let acc = 0;
  for (let i = 1; i < coords.length; i++) {
    const seg = dist(coords[i - 1], coords[i]);
    if (acc + seg >= half) {
      const t = seg === 0 ? 0 : (half - acc) / seg;
      const [x0, y0] = coords[i - 1];
      const [x1, y1] = coords[i];
      return { lng: x0 + (x1 - x0) * t, lat: y0 + (y1 - y0) * t };
    }
    acc += seg;
  }
  const last = coords[coords.length - 1];
  return { lng: last[0], lat: last[1] };
}

function dist(a: Position, b: Position): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return Math.sqrt(dx * dx + dy * dy);
}
