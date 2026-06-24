import type { FeatureCollection, LineString, MultiLineString } from "geojson";

/** A geographic coordinate. */
export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * A nearest-parking candidate to highlight on the map. Geometry-agnostic to the
 * provider: it gets the block geometry, the snapped (closest) point for a pin,
 * and a 1-based rank for labelling.
 */
export interface MapCandidate {
  id: string | number;
  geometry: LineString | MultiLineString;
  snapped: LatLng;
  rank: number;
}

/** Initial camera position for the map. */
export interface MapView {
  center: LatLng;
  zoom: number;
}

/** Geographic bounds as a GeoJSON-order tuple: [west, south, east, north]. */
export type BBox = [west: number, south: number, east: number, north: number];

/**
 * A feature the user selected (tapped). Geometry-agnostic on purpose: a
 * provider may select a polyline, a marker, or later a true point — consumers
 * only ever see properties plus a representative coordinate.
 */
export interface SelectedFeature {
  id: string | number;
  properties: Record<string, unknown>;
  /** A representative point for the feature (e.g. a segment midpoint). */
  center: LatLng;
}

export type SelectHandler = (feature: SelectedFeature | null) => void;

/**
 * Minimal imperative map surface. Leaflet implements it today; Apple MapKit JS
 * can implement the same interface later without touching any consumer.
 *
 * The lifecycle is mount -> setData -> (interaction) -> unmount.
 */
export interface MapProvider {
  /** Attach the map to a container element and set the initial view. */
  mount(container: HTMLElement, view: MapView): Promise<void> | void;
  /** Replace the rendered features. */
  setData(data: FeatureCollection): Promise<void> | void;
  /** Register a handler fired when a feature is selected (or null to clear). */
  onSelectFeature(handler: SelectHandler): void;
  /** Move the camera to a coordinate. */
  flyTo(target: LatLng, zoom?: number): void;

  // --- Directions-finder surface ---
  /** Show/move the blue "you are here" GPS dot (null clears it). Reflects the
   * user's geolocation only — never the typed search origin. */
  setOrigin(origin: LatLng | null): void;
  /** Show/move the "search from here" marker for an origin that isn't the user's
   * GPS location (e.g. a typed address or dropped pin); null clears it. */
  setSearchOrigin(origin: LatLng | null): void;
  /**
   * Highlight the nearest candidates. A non-empty list switches the map into
   * "focused" mode (the full overview is hidden); an empty list restores it.
   */
  setCandidates(candidates: MapCandidate[]): void;
  /** Mark one candidate as selected (emphasised), or null to clear. */
  setSelectedCandidate(id: string | number | null): void;
  /** Draw the route polyline from origin to a block (replaces any existing). */
  drawRoute(points: LatLng[]): void;
  /** Remove the route polyline. */
  clearRoute(): void;
  /** Fit the camera to the given points with padding. */
  fitBounds(points: LatLng[]): void;
  /** Register a handler for taps on empty map (used for drop-pin mode). */
  onMapClick(handler: (latlng: LatLng) => void): void;

  // --- Viewport-driven (bbox) loading ---
  /** Current visible bounds, or null before the map has mounted. */
  getBounds(): BBox | null;
  /** Register a handler fired (after pan/zoom settles) with the new bounds. */
  onViewportChange(handler: (bounds: BBox) => void): void;

  /** Tear down the map and release resources. */
  unmount(): void;
}

/** A zero-arg constructor for a provider, so consumers can swap implementations. */
export type MapProviderFactory = () => MapProvider;
