import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public OSRM foot instance run by the OSM community (same one the OSM website
// uses). No API key. Everything here is best-effort: any failure returns 204 so
// the client silently keeps its straight-line route.
const UA = "NYCMeteredParkingFinder/1.0 (https://github.com/DarranShivdat/map-app)";
const OSRM = "https://routing.openstreetmap.de/routed-foot/route/v1/foot";

export interface RoutePath {
  /** [lng, lat] pairs of the walking path. */
  coordinates: [number, number][];
  distanceMeters: number;
  durationSeconds: number;
}

function num(sp: URLSearchParams, key: string): number | null {
  const v = Number(sp.get(key));
  return Number.isFinite(v) ? v : null;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const oLat = num(sp, "oLat");
  const oLng = num(sp, "oLng");
  const dLat = num(sp, "dLat");
  const dLng = num(sp, "dLng");
  if (oLat == null || oLng == null || dLat == null || dLng == null) {
    return new Response(null, { status: 400 });
  }

  const coords = `${oLng},${oLat};${dLng},${dLat}`;
  const url = `${OSRM}/${coords}?overview=full&geometries=geojson`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(3500),
    });
    if (!res.ok) return new Response(null, { status: 204 });
    const json = (await res.json()) as {
      routes?: { geometry: { coordinates: [number, number][] }; distance: number; duration: number }[];
    };
    const r = json.routes?.[0];
    if (!r) return new Response(null, { status: 204 });
    const path: RoutePath = {
      coordinates: r.geometry.coordinates,
      distanceMeters: r.distance,
      durationSeconds: r.duration,
    };
    return Response.json(path);
  } catch {
    return new Response(null, { status: 204 });
  }
}
