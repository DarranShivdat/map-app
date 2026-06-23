import { NextRequest } from "next/server";
import type { Feature, LineString, MultiLineString, Position } from "geojson";
import { featuresInBBox, loadDataset } from "@/lib/parking/dataset";
import type { BBox } from "@/lib/map/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Hard ceiling on features returned for a single viewport. The default view is
// a neighbourhood (~1.6k features); this only bites when zoomed far out, where
// individual segments aren't legible anyway. Truncation is logged, never silent.
const MAX_FEATURES = 4000;

function parseBBox(raw: string | null): BBox | null {
  if (!raw) return null;
  const nums = raw.split(",").map(Number);
  if (nums.length !== 4 || nums.some((n) => !Number.isFinite(n))) return null;
  const [w, s, e, n] = nums;
  if (w > e || s > n) return null;
  return [w, s, e, n];
}

// The source coordinates carry ~13 decimal places (sub-micron); 6 (~0.1 m) is
// far beyond what the map can render. Trimming roughly halves the payload and is
// visually identical. Applied only to the bbox-render path — nearest-search and
// the full fallback keep the original precision.
const round = (x: number): number => Math.round(x * 1e6) / 1e6;
const trimLine = (coords: Position[]): Position[] =>
  coords.map(([lng, lat]) => [round(lng), round(lat)]);

function trimFeature(f: Feature): Feature {
  const g = f.geometry as LineString | MultiLineString;
  const geometry =
    g.type === "LineString"
      ? { type: "LineString" as const, coordinates: trimLine(g.coordinates) }
      : { type: "MultiLineString" as const, coordinates: g.coordinates.map(trimLine) };
  return { type: "Feature", id: f.id, geometry, properties: f.properties };
}

export async function GET(req: NextRequest) {
  const rawBBox = req.nextUrl.searchParams.get("bbox");

  // No bbox at all: keep the original full-dataset contract (unused by the
  // client now, retained for back-compat / debugging).
  if (rawBBox === null) {
    const { collection } = await loadDataset();
    return Response.json(collection, {
      headers: { "content-type": "application/geo+json", "cache-control": "public, max-age=3600" },
    });
  }

  // Present but malformed: a 400, not a silent 34 MB full-dataset fallback.
  const bbox = parseBBox(rawBBox);
  if (!bbox) return new Response(null, { status: 400 });

  const { features, matched, truncated } = await featuresInBBox(bbox, MAX_FEATURES);
  if (truncated) {
    console.warn(
      `[api/parking] bbox ${bbox.join(",")} matched ${matched} features; capped to ${MAX_FEATURES}.`
    );
  }

  const body = { type: "FeatureCollection" as const, features: features.map(trimFeature) };
  return Response.json(body, {
    headers: {
      "content-type": "application/geo+json",
      // Vary by query string; short cache so panning back is instant.
      "cache-control": "public, max-age=300",
    },
  });
}
