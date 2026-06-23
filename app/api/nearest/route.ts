import { NextRequest } from "next/server";
import { loadDataset } from "@/lib/parking/dataset";
import { findNearest } from "@/lib/parking/nearest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Nearest-N runs server-side over the FULL dataset — the client only ever holds
// the current viewport, so it can't compute this itself. The algorithm is the
// unchanged `findNearest` from lib/parking/nearest; this route just feeds it the
// full in-memory collection and serialises the result.

function num(sp: URLSearchParams, key: string): number | null {
  const v = Number(sp.get(key));
  return Number.isFinite(v) ? v : null;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const lat = num(sp, "lat");
  const lng = num(sp, "lng");
  if (lat == null || lng == null) return new Response(null, { status: 400 });
  const k = num(sp, "k") ?? 5;

  const { collection } = await loadDataset();
  const results = findNearest({ lat, lng }, collection, k);

  // No cache: results depend on the exact origin and the dataset is static.
  return Response.json(results, { headers: { "cache-control": "no-store" } });
}
