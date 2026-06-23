"use client";

import { useEffect, useRef } from "react";
import type { FeatureCollection } from "geojson";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import type {
  MapProviderFactory,
  MapView as MapViewport,
  SelectHandler,
} from "@/lib/map/types";

interface MapViewProps {
  /** Factory for the map implementation. Swap this to change providers. */
  createProvider: MapProviderFactory;
  initialView: MapViewport;
  /** URL returning a GeoJSON FeatureCollection. */
  dataUrl: string;
  onSelect: SelectHandler;
}

/**
 * Thin React lifecycle wrapper around a {@link MapProvider}. It knows nothing
 * about Leaflet — only the provider interface — so a MapKit provider drops in
 * by swapping `createProvider`.
 */
export default function MapView({
  createProvider,
  initialView,
  dataUrl,
  onSelect,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const provider = createProvider();
    let cancelled = false;

    (async () => {
      await provider.mount(el, initialView);
      if (cancelled) return;
      provider.onSelectFeature(onSelect);
      const res = await fetch(dataUrl);
      const data = (await res.json()) as FeatureCollection;
      if (cancelled) return;
      await provider.setData(data);
    })();

    return () => {
      cancelled = true;
      provider.unmount();
    };
    // Mount once; provider lifecycle is self-contained.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} className="absolute inset-0 h-full w-full" />;
}
