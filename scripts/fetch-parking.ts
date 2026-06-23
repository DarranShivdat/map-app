/**
 * Fetch the NYC DOT "Meter Rates By Block" layer as GeoJSON.
 *
 * Source resolution (ArcGIS sharing REST API):
 *   item a786e79ea512421baecd3bbd1c5619d6 (Web AppBuilder app)
 *     -> web map 1e399be30c24463ab4a556543542d5e8
 *       -> FeatureServer layer /1 ("Meter Rates By Block", polylines, ~11,213 features)
 *
 * The layer caps each response at maxRecordCount (2000), so we page through
 * with resultOffset until the server stops reporting more records.
 *
 * Run: npm run fetch:parking
 */

const LAYER_URL =
  "https://services.arcgis.com/wmZOI9vyUBq1zTZx/arcgis/rest/services/NYC_Metered_Parking_Map_prod_gdb/FeatureServer/1";

const PAGE_SIZE = 2000; // matches the layer's maxRecordCount
const OUT_FILE = new URL("../data/parking.geojson", import.meta.url);

type GeoJsonFeature = {
  type: "Feature";
  geometry: unknown;
  properties: Record<string, unknown>;
};

type QueryResponse = {
  type?: string;
  features?: GeoJsonFeature[];
  properties?: { exceededTransferLimit?: boolean };
  error?: { message?: string };
};

async function fetchPage(offset: number): Promise<QueryResponse> {
  const params = new URLSearchParams({
    where: "1=1",
    outFields: "*",
    outSR: "4326",
    f: "geojson",
    resultRecordCount: String(PAGE_SIZE),
    resultOffset: String(offset),
  });
  const res = await fetch(`${LAYER_URL}/query?${params}`);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} at offset ${offset}`);
  }
  const json = (await res.json()) as QueryResponse;
  if (json.error) {
    throw new Error(`ArcGIS error at offset ${offset}: ${json.error.message}`);
  }
  return json;
}

async function getExpectedCount(): Promise<number> {
  const params = new URLSearchParams({
    where: "1=1",
    returnCountOnly: "true",
    f: "json",
  });
  const res = await fetch(`${LAYER_URL}/query?${params}`);
  const json = (await res.json()) as { count?: number };
  return json.count ?? 0;
}

async function main() {
  const expected = await getExpectedCount();
  console.log(`Layer reports ${expected} features. Paginating...`);

  const features: GeoJsonFeature[] = [];
  let offset = 0;

  // Loop until the server returns a short page and no longer flags more records.
  for (;;) {
    const page = await fetchPage(offset);
    const batch = page.features ?? [];
    features.push(...batch);
    console.log(`  offset ${offset}: +${batch.length} (total ${features.length})`);

    const moreReported = page.properties?.exceededTransferLimit === true;
    if (batch.length < PAGE_SIZE && !moreReported) break;
    if (batch.length === 0) break;
    offset += PAGE_SIZE;
  }

  const collection = { type: "FeatureCollection" as const, features };

  const { writeFile, mkdir } = await import("node:fs/promises");
  await mkdir(new URL("../data/", import.meta.url), { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(collection));

  console.log(`\nWrote ${features.length} features to data/parking.geojson`);
  if (expected && features.length !== expected) {
    throw new Error(
      `Count mismatch: fetched ${features.length} but layer reports ${expected}. Aborting (data may be truncated).`
    );
  }
  console.log("Feature count matches the layer total. Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
