import type { FeatureCollection, Feature, LineString, MultiLineString } from "geojson";
import { lineMidpoint } from "./geometry";
import type { LatLng, MapProvider, MapView, SelectHandler } from "./types";

// Leaflet is imported lazily inside mount() so this module is safe to import
// from server components / during the Next.js build (Leaflet touches `window`
// at module load).
type Leaflet = typeof import("leaflet");

/** Zoom at or above which we draw real segment polylines instead of clusters. */
const POLYLINE_ZOOM = 16;

type ParkingFeature = Feature<LineString | MultiLineString>;

export function createLeafletProvider(): MapProvider {
  let L: Leaflet;
  let map: import("leaflet").Map | null = null;
  let polylineLayer: import("leaflet").GeoJSON | null = null;
  let markerLayer: import("leaflet").MarkerClusterGroup | null = null;
  let selectHandler: SelectHandler = () => {};
  // Set synchronously by unmount(). Because mount() awaits a dynamic import,
  // React Strict Mode can tear this provider down before mount() finishes; we
  // check this flag after the awaits so we never init the map on a dead
  // container (avoids Leaflet's "Map container is already initialized").
  let destroyed = false;

  function select(feature: ParkingFeature, center: LatLng) {
    selectHandler({
      id: (feature.properties?.OBJECTID as number | undefined) ?? "",
      properties: feature.properties ?? {},
      center,
    });
  }

  function syncLayersToZoom() {
    if (!map || !polylineLayer || !markerLayer) return;
    const detailed = map.getZoom() >= POLYLINE_ZOOM;
    if (detailed) {
      if (map.hasLayer(markerLayer)) map.removeLayer(markerLayer);
      if (!map.hasLayer(polylineLayer)) map.addLayer(polylineLayer);
    } else {
      if (map.hasLayer(polylineLayer)) map.removeLayer(polylineLayer);
      if (!map.hasLayer(markerLayer)) map.addLayer(markerLayer);
    }
  }

  return {
    async mount(container: HTMLElement, view: MapView) {
      L = (await import("leaflet")).default;
      // markercluster augments the L namespace as a side effect.
      await import("leaflet.markercluster");
      if (destroyed) return; // torn down (e.g. Strict Mode) while importing

      map = L.map(container, {
        center: [view.center.lat, view.center.lng],
        zoom: view.zoom,
        preferCanvas: true, // canvas renderer keeps thousands of polylines fast
        zoomControl: false,
        attributionControl: true,
      });

      L.control.zoom({ position: "topright" }).addTo(map);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(map);

      map.on("zoomend", syncLayersToZoom);
      map.on("click", () => selectHandler(null));
    },

    setData(data: FeatureCollection) {
      if (!map) return;

      polylineLayer?.remove();
      markerLayer?.remove();

      // Detailed view: real segment geometry on the canvas renderer.
      polylineLayer = L.geoJSON(data, {
        style: { color: "#1e9e4a", weight: 4, opacity: 0.85 },
        onEachFeature: (feature, layer) => {
          layer.on("click", (e) => {
            L.DomEvent.stopPropagation(e);
            const f = feature as ParkingFeature;
            const mid = lineMidpoint(f);
            if (mid) select(f, mid);
          });
        },
      });

      // Overview: one clustered tap target at each segment's midpoint.
      markerLayer = L.markerClusterGroup({
        maxClusterRadius: 50,
        showCoverageOnHover: false,
      });
      const dot = L.divIcon({
        className: "parking-dot",
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      for (const feature of data.features as ParkingFeature[]) {
        const mid = lineMidpoint(feature);
        if (!mid) continue;
        const marker = L.marker([mid.lat, mid.lng], { icon: dot });
        marker.on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          select(feature, mid);
        });
        markerLayer.addLayer(marker);
      }

      syncLayersToZoom();
    },

    onSelectFeature(handler: SelectHandler) {
      selectHandler = handler;
    },

    flyTo(target: LatLng, zoom?: number) {
      map?.flyTo([target.lat, target.lng], zoom ?? map.getZoom());
    },

    unmount() {
      destroyed = true;
      map?.remove();
      map = null;
      polylineLayer = null;
      markerLayer = null;
    },
  };
}
