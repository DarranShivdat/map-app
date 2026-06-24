import type { FeatureCollection, Feature, LineString, MultiLineString } from "geojson";
import { lineMidpoint } from "./geometry";
import type {
  BBox,
  LatLng,
  MapCandidate,
  MapProvider,
  MapView,
  SelectedFeature,
  SelectHandler,
} from "./types";

// Leaflet is imported lazily inside mount() so this module is safe to import
// from server components / during the Next.js build (Leaflet touches `window`
// at module load).
type Leaflet = typeof import("leaflet");

/** Zoom at or above which we draw real segment polylines instead of clusters. */
const POLYLINE_ZOOM = 16;
const GREEN = "#1e9e4a";
const BLUE = "#2563eb";

type ParkingFeature = Feature<LineString | MultiLineString>;

interface CandidateEntry {
  id: string | number;
  line: import("leaflet").GeoJSON;
  marker: import("leaflet").Marker;
}

export function createLeafletProvider(): MapProvider {
  let L: Leaflet;
  let map: import("leaflet").Map | null = null;
  let polylineLayer: import("leaflet").GeoJSON | null = null;
  let markerLayer: import("leaflet").MarkerClusterGroup | null = null;
  let originMarker: import("leaflet").Marker | null = null;
  let searchOriginMarker: import("leaflet").Marker | null = null;
  let candidateLayer: import("leaflet").LayerGroup | null = null;
  let routeLayer: import("leaflet").Polyline | null = null;
  let candidateEntries: CandidateEntry[] = [];
  let selectedId: string | number | null = null;

  let selectHandler: SelectHandler = () => {};
  let mapClickHandler: (latlng: LatLng) => void = () => selectHandler(null);
  let viewportHandler: (bounds: BBox) => void = () => {};
  // True while nearest-candidates are shown: the full ~11k overview is hidden.
  let focused = false;
  // Set synchronously by unmount(); checked after the dynamic import so Strict
  // Mode can't init a map on a dead container.
  let destroyed = false;

  function emit(feature: SelectedFeature) {
    selectHandler(feature);
  }

  function syncLayersToZoom() {
    if (!map || !polylineLayer || !markerLayer || focused) return;
    const detailed = map.getZoom() >= POLYLINE_ZOOM;
    if (detailed) {
      if (map.hasLayer(markerLayer)) map.removeLayer(markerLayer);
      if (!map.hasLayer(polylineLayer)) map.addLayer(polylineLayer);
    } else {
      if (map.hasLayer(polylineLayer)) map.removeLayer(polylineLayer);
      if (!map.hasLayer(markerLayer)) map.addLayer(markerLayer);
    }
  }

  function currentBBox(): BBox | null {
    if (!map) return null;
    const b = map.getBounds();
    return [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
  }

  function restyleCandidates() {
    for (const e of candidateEntries) {
      const active = e.id === selectedId;
      e.line.setStyle({ color: active ? BLUE : GREEN, weight: active ? 7 : 5, opacity: 0.9 });
      const el = e.marker.getElement();
      if (el) el.classList.toggle("parking-candidate--active", active);
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
      // `moveend` fires after both pans and zooms settle — the cue to refetch
      // the features for the new viewport.
      map.on("moveend", () => {
        const b = currentBBox();
        if (b) viewportHandler(b);
      });
      map.on("click", (e) => mapClickHandler({ lat: e.latlng.lat, lng: e.latlng.lng }));
    },

    setData(data: FeatureCollection) {
      if (!map) return;

      polylineLayer?.remove();
      markerLayer?.remove();

      // Detailed view: real segment geometry on the canvas renderer.
      polylineLayer = L.geoJSON(data, {
        style: { color: GREEN, weight: 4, opacity: 0.85 },
        onEachFeature: (feature, layer) => {
          layer.on("click", (e) => {
            L.DomEvent.stopPropagation(e);
            const f = feature as ParkingFeature;
            const mid = lineMidpoint(f);
            if (mid)
              emit({
                id: (f.properties?.OBJECTID as number) ?? "",
                properties: f.properties ?? {},
                center: mid,
              });
          });
        },
      });

      // Overview: one clustered tap target at each segment's midpoint.
      markerLayer = L.markerClusterGroup({ maxClusterRadius: 50, showCoverageOnHover: false });
      const dot = L.divIcon({ className: "parking-dot", iconSize: [14, 14], iconAnchor: [7, 7] });
      for (const feature of data.features as ParkingFeature[]) {
        const mid = lineMidpoint(feature);
        if (!mid) continue;
        const marker = L.marker([mid.lat, mid.lng], { icon: dot });
        marker.on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          emit({
            id: (feature.properties?.OBJECTID as number) ?? "",
            properties: feature.properties ?? {},
            center: mid,
          });
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

    setOrigin(origin: LatLng | null) {
      if (!map) return;
      originMarker?.remove();
      originMarker = null;
      if (!origin) return;
      const icon = L.divIcon({ className: "origin-dot", iconSize: [20, 20], iconAnchor: [10, 10] });
      originMarker = L.marker([origin.lat, origin.lng], { icon, zIndexOffset: 1000 }).addTo(map);
    },

    setSearchOrigin(origin: LatLng | null) {
      if (!map) return;
      searchOriginMarker?.remove();
      searchOriginMarker = null;
      if (!origin) return;
      const icon = L.divIcon({ className: "search-origin", iconSize: [28, 36], iconAnchor: [14, 34] });
      searchOriginMarker = L.marker([origin.lat, origin.lng], { icon, zIndexOffset: 900 }).addTo(map);
    },

    setCandidates(candidates: MapCandidate[]) {
      if (!map) return;
      candidateLayer?.remove();
      candidateLayer = null;
      candidateEntries = [];

      if (candidates.length === 0) {
        // Restore the overview.
        focused = false;
        syncLayersToZoom();
        return;
      }

      // Enter focused mode: hide the full overview.
      focused = true;
      if (polylineLayer && map.hasLayer(polylineLayer)) map.removeLayer(polylineLayer);
      if (markerLayer && map.hasLayer(markerLayer)) map.removeLayer(markerLayer);

      candidateLayer = L.layerGroup().addTo(map);
      for (const c of candidates) {
        const line = L.geoJSON(
          { type: "Feature", geometry: c.geometry, properties: {} } as Feature,
          { style: { color: GREEN, weight: 5, opacity: 0.9 } }
        );
        const marker = L.marker([c.snapped.lat, c.snapped.lng], {
          icon: L.divIcon({
            className: "parking-candidate",
            html: `<span>${c.rank}</span>`,
            iconSize: [26, 26],
            iconAnchor: [13, 13],
          }),
          zIndexOffset: 500,
        });
        const select = (e: { originalEvent?: Event } | unknown) => {
          if (e && typeof e === "object" && "originalEvent" in e) L.DomEvent.stop(e as never);
          emit({ id: c.id, properties: {}, center: c.snapped });
        };
        line.on("click", select);
        marker.on("click", select);
        candidateLayer.addLayer(line);
        candidateLayer.addLayer(marker);
        candidateEntries.push({ id: c.id, line, marker });
      }
      restyleCandidates();
    },

    setSelectedCandidate(id: string | number | null) {
      selectedId = id;
      restyleCandidates();
    },

    drawRoute(points: LatLng[]) {
      if (!map) return;
      routeLayer?.remove();
      routeLayer = L.polyline(
        points.map((p) => [p.lat, p.lng]),
        { color: BLUE, weight: 5, opacity: 0.85, dashArray: points.length <= 2 ? "8 8" : undefined }
      ).addTo(map);
    },

    clearRoute() {
      routeLayer?.remove();
      routeLayer = null;
    },

    fitBounds(points: LatLng[]) {
      if (!map || points.length === 0) return;
      const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
      map.fitBounds(bounds, { paddingTopLeft: [40, 80], paddingBottomRight: [40, 40], maxZoom: 17 });
    },

    onMapClick(handler: (latlng: LatLng) => void) {
      mapClickHandler = handler;
    },

    getBounds() {
      return currentBBox();
    },

    onViewportChange(handler: (bounds: BBox) => void) {
      viewportHandler = handler;
    },

    unmount() {
      destroyed = true;
      map?.remove();
      map = null;
      polylineLayer = null;
      markerLayer = null;
      originMarker = null;
      searchOriginMarker = null;
      candidateLayer = null;
      routeLayer = null;
      candidateEntries = [];
    },
  };
}
