import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Nominatim asks for an identifying User-Agent (browsers can't set one, so we
// proxy server-side). Bias results to the NYC area since the parking data is
// NYC-only.
const UA = "NYCMeteredParkingFinder/1.0 (https://github.com/DarranShivdat/map-app)";
const NYC_VIEWBOX = "-74.30,40.95,-73.65,40.45"; // lon1,lat1,lon2,lat2

export interface GeocodeHit {
  /** Primary line: place name or "house_number road". */
  label: string;
  /** Secondary line: neighborhood / borough context (may be empty). */
  sublabel: string;
  lat: number;
  lng: number;
}

// Nominatim's `address` object, partially typed for the fields we format.
interface NominatimAddress {
  house_number?: string;
  road?: string;
  pedestrian?: string;
  neighbourhood?: string;
  suburb?: string;
  city_district?: string;
  borough?: string;
  city?: string;
  town?: string;
}

interface NominatimResult {
  display_name: string;
  name?: string;
  lat: string;
  lon: string;
  address?: NominatimAddress;
}

/** Build a concise two-line label from Nominatim's structured address. */
function format(r: NominatimResult): { label: string; sublabel: string } {
  const a = r.address ?? {};
  const street = [a.house_number, a.road ?? a.pedestrian].filter(Boolean).join(" ");
  const label = r.name || street || r.display_name.split(",")[0];

  // Borough reads more naturally than "city" in NYC (Nominatim often returns
  // the borough as the city). Pair it with the immediate neighborhood.
  const area = a.neighbourhood ?? a.suburb ?? a.city_district;
  const borough = a.borough ?? a.city ?? a.town;
  const sublabel = [area, borough].filter(Boolean).filter((v) => v !== label).join(", ");

  return { label, sublabel };
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 3) return Response.json([] satisfies GeocodeHit[]);

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "8"); // over-fetch; we trim after de-duping
  url.searchParams.set("countrycodes", "us");
  url.searchParams.set("viewbox", NYC_VIEWBOX);
  url.searchParams.set("bounded", "1"); // hard NYC bias: drop anything outside
  url.searchParams.set("addressdetails", "1"); // structured fields for formatting
  url.searchParams.set("dedupe", "1");

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept-Language": "en" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return Response.json([] satisfies GeocodeHit[]);
    const raw = (await res.json()) as NominatimResult[];

    // Collapse near-identical rows and cap at 6. Nominatim often returns many
    // co-located POIs (e.g. several radio stations in one tower) and repeated
    // text; de-dupe on both the visible text and a ~11 m coordinate cell so the
    // list shows distinct places, keeping the highest-ranked of each.
    const seenCells = new Set<string>();
    const seenText = new Set<string>();
    const hits: GeocodeHit[] = [];
    for (const r of raw) {
      const lat = Number(r.lat);
      const lng = Number(r.lon);
      const cell = `${lat.toFixed(4)},${lng.toFixed(4)}`; // ~11 m
      const { label, sublabel } = format(r);
      const text = `${label}|${sublabel}`;
      if (seenCells.has(cell) || seenText.has(text)) continue;
      seenCells.add(cell);
      seenText.add(text);
      hits.push({ label, sublabel, lat, lng });
      if (hits.length === 6) break;
    }
    return Response.json(hits);
  } catch {
    // Network/timeout — fail soft with no results.
    return Response.json([] satisfies GeocodeHit[]);
  }
}
