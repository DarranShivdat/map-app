import type { GeocodeHit } from "@/lib/geo/geocode";

/**
 * Hardcoded NYC landmarks used to back-fill the search dropdown when the user
 * has few or no recent searches, so the list is never empty.
 */
export const NYC_HOTSPOTS: GeocodeHit[] = [
  { label: "Times Square", sublabel: "Midtown, Manhattan", lat: 40.758, lng: -73.9855 },
  { label: "Penn Station", sublabel: "Midtown, Manhattan", lat: 40.7506, lng: -73.9935 },
  { label: "Grand Central Terminal", sublabel: "Midtown East, Manhattan", lat: 40.7527, lng: -73.9772 },
  { label: "Union Square", sublabel: "Manhattan", lat: 40.7359, lng: -73.9911 },
  { label: "Rockefeller Center", sublabel: "Midtown, Manhattan", lat: 40.7587, lng: -73.9787 },
];
