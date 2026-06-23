import type { LatLng } from "@/lib/map/types";

/**
 * Build a deep link that opens native walking directions. Apple Maps on
 * Apple platforms, Google Maps everywhere else (both work cross-platform in a
 * browser, this just picks the nicer default).
 */
export function walkingDirectionsUrl(
  origin: LatLng,
  dest: LatLng,
  label?: string
): string {
  const isApple =
    typeof navigator !== "undefined" &&
    /iphone|ipad|ipod|macintosh/i.test(navigator.userAgent);

  if (isApple) {
    const q = label ? `&q=${encodeURIComponent(label)}` : "";
    return `https://maps.apple.com/?saddr=${origin.lat},${origin.lng}&daddr=${dest.lat},${dest.lng}&dirflg=w${q}`;
  }
  return `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${dest.lat},${dest.lng}&travelmode=walking`;
}
