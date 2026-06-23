"use client";

import { useEffect, useRef, useState } from "react";
import type { FeatureCollection } from "geojson";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import type {
  LatLng,
  MapCandidate,
  MapProvider,
  MapProviderFactory,
  MapView as MapViewport,
  SelectHandler,
} from "@/lib/map/types";

interface MapViewProps {
  /** Factory for the map implementation. Swap this to change providers. */
  createProvider: MapProviderFactory;
  initialView: MapViewport;
  /** Parsed parking data (fetched once by the page). */
  data: FeatureCollection | null;
  origin: LatLng | null;
  candidates: MapCandidate[];
  selectedId: string | number | null;
  route: LatLng[] | null;
  /** When this array reference changes, the camera fits to these points. */
  focusBounds: LatLng[] | null;
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
  data,
  origin,
  candidates,
  selectedId,
  route,
  focusBounds,
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

  useEffect(() => {
    if (ready && data) providerRef.current?.setData(data);
  }, [ready, data]);

  useEffect(() => {
    if (ready) providerRef.current?.setOrigin(origin);
  }, [ready, origin]);

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

  return <div ref={containerRef} className="absolute inset-0 h-full w-full" />;
}
