import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Nominatim asks for an identifying User-Agent (browsers can't set one, so we
// proxy server-side). Bias results to the NYC area since the parking data is
// NYC-only.
const UA = "NYCMeteredParkingFinder/1.0 (https://github.com/DarranShivdat/map-app)";
const NYC_VIEWBOX = "-74.30,40.95,-73.65,40.45"; // lon1,lat1,lon2,lat2

export interface GeocodeHit {
  label: string;
  lat: number;
  lng: number;
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 3) return Response.json([] satisfies GeocodeHit[]);

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "5");
  url.searchParams.set("countrycodes", "us");
  url.searchParams.set("viewbox", NYC_VIEWBOX);
  url.searchParams.set("bounded", "1");

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept-Language": "en" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return Response.json([] satisfies GeocodeHit[]);
    const raw = (await res.json()) as { display_name: string; lat: string; lon: string }[];
    const hits: GeocodeHit[] = raw.map((r) => ({
      label: r.display_name,
      lat: Number(r.lat),
      lng: Number(r.lon),
    }));
    return Response.json(hits);
  } catch {
    // Network/timeout — fail soft with no results.
    return Response.json([] satisfies GeocodeHit[]);
  }
}
