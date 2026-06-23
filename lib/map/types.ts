import type { FeatureCollection } from "geojson";

/** A geographic coordinate. */
export interface LatLng {
  lat: number;
  lng: number;
}

/** Initial camera position for the map. */
export interface MapView {
  center: LatLng;
  zoom: number;
}

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
  /** Tear down the map and release resources. */
  unmount(): void;
}

/** A zero-arg constructor for a provider, so consumers can swap implementations. */
export type MapProviderFactory = () => MapProvider;
