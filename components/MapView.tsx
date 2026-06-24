"use client";

import { useEffect, useRef, useState } from "react";
import type { FeatureCollection } from "geojson";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import type {
  BBox,
  LatLng,
  MapCandidate,
  MapProvider,
  MapProviderFactory,
  MapView as MapViewport,
  SelectHandler,
} from "@/lib/map/types";

/** Debounce between a pan/zoom settling and refetching the viewport's data. */
const REFETCH_DELAY_MS = 250;

/** Grow a viewport by 25% on each side so a small pan stays within loaded data. */
function withBuffer([w, s, e, n]: BBox): BBox {
  const padX = (e - w) * 0.25;
  const padY = (n - s) * 0.25;
  return [w - padX, s - padY, e + padX, n + padY];
}

interface MapViewProps {
  /** Factory for the map implementation. Swap this to change providers. */
  createProvider: MapProviderFactory;
  initialView: MapViewport;
  /** The user's GPS location — drives the blue "you are here" dot only. */
  userLocation: LatLng | null;
  /** The point we search parking near, when it isn't the GPS location. */
  searchOrigin: LatLng | null;
  candidates: MapCandidate[];
  selectedId: string | number | null;
  route: LatLng[] | null;
  /** When this array reference changes, the camera fits to these points. */
  focusBounds: LatLng[] | null;
  /** Increment to fly the camera back to {@link userLocation} (move only). */
  recenterSignal: number;
  onSelect: SelectHandler;
  onMapClick: (latlng: LatLng) => void;
}

/**
 * Declarative React wrapper around a {@link MapProvider}. It knows nothing
 * about Leaflet — only the provider interface — so a MapKit provider drops in
 * by swapping `createProvider`. Props are synced to the provider via effects.
 */
export default function MapView({
  createProvider,
  initialView,
  userLocation,
  searchOrigin,
  candidates,
  selectedId,
  route,
  focusBounds,
  recenterSignal,
  onSelect,
  onMapClick,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const providerRef = useRef<MapProvider | null>(null);
  const [ready, setReady] = useState(false);

  // Keep the latest callbacks without re-registering on every render.
  const onSelectRef = useRef(onSelect);
  const onMapClickRef = useRef(onMapClick);
  useEffect(() => {
    onSelectRef.current = onSelect;
    onMapClickRef.current = onMapClick;
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const provider = createProvider();
    let cancelled = false;

    (async () => {
      await provider.mount(el, initialView);
      if (cancelled) return;
      provider.onSelectFeature((f) => onSelectRef.current(f));
      provider.onMapClick((latlng) => onMapClickRef.current(latlng));
      providerRef.current = provider;
      setReady(true);
    })();

    return () => {
      cancelled = true;
      provider.unmount();
      providerRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Viewport-driven loading: fetch only the parking segments inside the current
  // bounds (plus a buffer) and refetch as the user pans/zooms. The full 34 MB
  // dataset never reaches the client.
  useEffect(() => {
    const provider = providerRef.current;
    if (!ready || !provider) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let inFlight: AbortController | null = null;

    async function load(bounds: BBox) {
      inFlight?.abort();
      const ctrl = new AbortController();
      inFlight = ctrl;
      const [w, s, e, n] = withBuffer(bounds);
      try {
        const res = await fetch(`/api/parking?bbox=${w},${s},${e},${n}`, { signal: ctrl.signal });
        if (!res.ok) return;
        const json = (await res.json()) as FeatureCollection;
        if (!cancelled) providerRef.current?.setData(json);
      } catch {
        // Aborted (stale viewport) or network error — keep the current layer.
      }
    }

    function schedule(bounds: BBox) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => load(bounds), REFETCH_DELAY_MS);
    }

    provider.onViewportChange(schedule);
    const initial = provider.getBounds();
    if (initial) load(initial); // first paint: no debounce

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      inFlight?.abort();
    };
  }, [ready]);

  useEffect(() => {
    if (ready) providerRef.current?.setOrigin(userLocation);
  }, [ready, userLocation]);

  useEffect(() => {
    if (ready) providerRef.current?.setSearchOrigin(searchOrigin);
  }, [ready, searchOrigin]);

  useEffect(() => {
    if (ready) providerRef.current?.setCandidates(candidates);
  }, [ready, candidates]);

  useEffect(() => {
    if (ready) providerRef.current?.setSelectedCandidate(selectedId);
  }, [ready, selectedId]);

  useEffect(() => {
    if (!ready) return;
    if (route) providerRef.current?.drawRoute(route);
    else providerRef.current?.clearRoute();
  }, [ready, route]);

  useEffect(() => {
    if (ready && focusBounds) providerRef.current?.fitBounds(focusBounds);
  }, [ready, focusBounds]);

  // Recenter on the GPS dot (map move only). Fires on each signal bump, not on
  // userLocation changes, so it never fights the initial fit.
  useEffect(() => {
    if (ready && recenterSignal > 0 && userLocation) {
      providerRef.current?.flyTo(userLocation);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, recenterSignal]);

  return <div ref={containerRef} className="absolute inset-0 h-full w-full" />;
}
