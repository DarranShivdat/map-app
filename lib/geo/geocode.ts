import type { GeocodeHit } from "@/app/api/geocode/route";

export type { GeocodeHit };

/** Geocode a free-text address via our Nominatim proxy. Fails soft to []. */
export async function geocode(
  query: string,
  signal?: AbortSignal
): Promise<GeocodeHit[]> {
  try {
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`, { signal });
    if (!res.ok) return [];
    return (await res.json()) as GeocodeHit[];
  } catch {
    return []; // aborted or offline — caller shows nothing
  }
}
