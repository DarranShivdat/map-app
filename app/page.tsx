"use client";

import dynamic from "next/dynamic";
import { useMemo, useRef, useState } from "react";
import BottomSheet from "@/components/BottomSheet";
import SearchBar from "@/components/SearchBar";
import ResultsList from "@/components/ResultsList";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useParkingData } from "@/hooks/useParkingData";
import { createLeafletProvider } from "@/lib/map/leaflet-provider";
import { fetchWalkingRoute } from "@/lib/geo/route";
import { findNearest, type NearestResult } from "@/lib/parking/nearest";
import type {
  LatLng,
  MapCandidate,
  MapView as MapViewport,
  SelectedFeature,
} from "@/lib/map/types";

// Leaflet needs the DOM, so load the map only on the client.
const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

const MANHATTAN: LatLng = { lat: 40.7359, lng: -73.9911 }; // ~Union Square
const INITIAL_VIEW: MapViewport = { center: MANHATTAN, zoom: 13 };

type OriginSource = "geo" | "address" | "simulated";
interface Origin {
  source: OriginSource;
  latlng: LatLng;
  label: string;
}

function idOf(r: NearestResult): string | number {
  return (r.feature.properties?.OBJECTID as number) ?? "";
}

export default function Home() {
  const { data } = useParkingData();
  const geo = useGeolocation();

  const [origin, setOrigin] = useState<Origin | null>(null);
  const [results, setResults] = useState<NearestResult[]>([]);
  const [selectedId, setSelectedId] = useState<string | number | null>(null);
  const [route, setRoute] = useState<LatLng[] | null>(null);
  const [focusBounds, setFocusBounds] = useState<LatLng[] | null>(null);
  const [feature, setFeature] = useState<SelectedFeature | null>(null);
  const [dropPin, setDropPin] = useState(false);

  const routeReq = useRef(0);

  // Set a new origin and compute the nearest blocks. Called from event
  // handlers (not an effect); the search controls stay disabled until `data`
  // is loaded, so it's always available here.
  function applyOrigin(o: Origin) {
    if (!data) return;
    const res = findNearest(o.latlng, data, 5);
    setOrigin(o);
    setResults(res);
    setSelectedId(null);
    setRoute(null);
    setFeature(null);
    setFocusBounds([o.latlng, ...res.map((r) => r.snapped)]);
  }

  const candidates = useMemo<MapCandidate[]>(
    () =>
      results.map((r, i) => ({
        id: idOf(r),
        geometry: r.feature.geometry,
        snapped: r.snapped,
        rank: i + 1,
      })),
    [results]
  );

  async function selectResult(r: NearestResult) {
    if (!origin) return;
    const id = idOf(r);
    setSelectedId(id);
    setRoute([origin.latlng, r.snapped]); // straight line immediately
    setFocusBounds([origin.latlng, r.snapped]);

    // Best-effort upgrade to a real walking path; ignore if stale or failed.
    const token = ++routeReq.current;
    const path = await fetchWalkingRoute(origin.latlng, r.snapped);
    if (path && routeReq.current === token) setRoute(path);
  }

  async function handleUseMyLocation() {
    const ll = await geo.locate();
    if (ll) applyOrigin({ source: "geo", latlng: ll, label: "Current location" });
  }

  function reset() {
    setOrigin(null);
    setResults([]);
    setSelectedId(null);
    setRoute(null);
    setFeature(null);
    setFocusBounds(null);
    setDropPin(false);
  }

  const locationError =
    geo.status === "denied"
      ? "Location permission denied — search an address or drop a test pin."
      : geo.status === "unavailable"
      ? "Couldn't get your location — search an address or drop a test pin."
      : null;

  const hasResults = origin && results.length > 0;

  return (
    <main className="relative h-[100dvh] w-full overflow-hidden">
      <MapView
        createProvider={createLeafletProvider}
        initialView={INITIAL_VIEW}
        data={data}
        origin={origin?.latlng ?? null}
        candidates={candidates}
        selectedId={selectedId}
        route={route}
        focusBounds={focusBounds}
        onSelect={(f) => {
          if (!f) {
            setFeature(null);
            return;
          }
          const match = results.find((r) => idOf(r) === f.id);
          if (match) selectResult(match);
          else setFeature(f);
        }}
        onMapClick={(latlng) => {
          if (dropPin) {
            applyOrigin({ source: "simulated", latlng, label: "Dropped pin" });
            setDropPin(false);
          } else {
            setFeature(null);
          }
        }}
      />

      {/* Search / origin panel */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1000] p-3">
        <div className="pointer-events-auto mx-auto max-w-xl rounded-2xl bg-white/95 p-3 shadow-lg backdrop-blur">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#1e9e4a]" />
              <h1 className="text-sm font-bold text-zinc-900">NYC Parking Finder</h1>
            </div>
            {origin && (
              <button onClick={reset} className="text-xs font-medium text-zinc-500 hover:text-zinc-800">
                New search
              </button>
            )}
          </div>

          <SearchBar
            onUseMyLocation={handleUseMyLocation}
            onPickAddress={(hit) =>
              applyOrigin({ source: "address", latlng: { lat: hit.lat, lng: hit.lng }, label: hit.label })
            }
            onUseTestPin={() =>
              applyOrigin({ source: "simulated", latlng: MANHATTAN, label: "Manhattan test pin" })
            }
            locating={geo.status === "locating"}
            locationError={locationError}
            ready={!!data}
          />

          <button
            onClick={() => setDropPin((v) => !v)}
            className={`mt-2 text-xs font-medium ${dropPin ? "text-[#2563eb]" : "text-zinc-400"} hover:text-zinc-700`}
          >
            {dropPin ? "Tap the map to drop your location…" : "…or drop a pin on the map"}
          </button>
        </div>
      </div>

      {/* Results sheet */}
      {hasResults && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1000]">
          <div
            className="pointer-events-auto mx-auto flex max-h-[52dvh] max-w-xl flex-col rounded-t-2xl bg-zinc-50 shadow-[0_-4px_24px_rgba(0,0,0,0.18)]"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <div className="px-4 pb-2 pt-3">
              <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-zinc-300" />
              <h2 className="text-sm font-semibold text-zinc-900">
                {results.length} nearest metered blocks
              </h2>
              <p className="truncate text-xs text-zinc-500">from {origin!.label}</p>
            </div>
            <div className="overflow-auto px-3 pb-3">
              <ResultsList
                results={results}
                origin={origin!.latlng}
                selectedId={selectedId}
                onSelect={selectResult}
              />
            </div>
          </div>
        </div>
      )}

      {/* Idle exploration: tap a metered block for details */}
      {!hasResults && <BottomSheet feature={feature} onClose={() => setFeature(null)} />}
    </main>
  );
}
