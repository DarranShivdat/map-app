import { readFile } from "node:fs/promises";
import path from "node:path";

// Serve the committed dataset straight from /data so we don't duplicate the
// 34 MB file into /public. Read once and cache in module scope.
export const runtime = "nodejs";
// Read at request time (cached in module scope) instead of baking 34 MB into
// the build output. A later thread can swap this for tiled/bbox-filtered data.
export const dynamic = "force-dynamic";

let cached: string | null = null;

export async function GET() {
  if (!cached) {
    const file = path.join(process.cwd(), "data", "parking.geojson");
    cached = await readFile(file, "utf8");
  }
  return new Response(cached, {
    headers: {
      "content-type": "application/geo+json",
      "cache-control": "public, max-age=3600",
    },
  });
}
