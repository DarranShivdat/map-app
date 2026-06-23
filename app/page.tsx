"use client";

import dynamic from "next/dynamic";
import { useMemo, useRef, useState } from "react";
import SearchBar from "@/components/SearchBar";
import ResultsSheet from "@/components/ResultsSheet";
import DetailSheet from "@/components/DetailSheet";
import StatusBanner from "@/components/StatusBanner";
import type { Snap } from "@/components/Sheet";
import { useGeolocation } from "@/hooks/useGeolocation";
import { createLeafletProvider } from "@/lib/map/leaflet-provider";
import { fetchWalkingRoute } from "@/lib/geo/route";
import { fetchNearest } from "@/lib/parking/nearest-client";
import type { NearestResult } from "@/lib/parking/nearest";
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
  const geo = useGeolocation();

  const [origin, setOrigin] = useState<Origin | null>(null);
  const [results, setResults] = useState<NearestResult[]>([]);
  const [selectedId, setSelectedId] = useState<string | number | null>(null);
  const [route, setRoute] = useState<LatLng[] | null>(null);
  const [focusBounds, setFocusBounds] = useState<LatLng[] | null>(null);
  const [feature, setFeature] = useState<SelectedFeature | null>(null);
  const [dropPin, setDropPin] = useState(false);
  const [sheetSnap, setSheetSnap] = useState<Snap>("half");

  const routeReq = useRef(0);

  // Set a new origin and compute the nearest blocks. The ranking runs on the
  // server over the full dataset (the client only holds the current viewport),
  // so this is async — origin is set immediately, results land when the fetch
  // resolves and the sheet opens at "half".
  async function applyOrigin(o: Origin) {
    setOrigin(o);
    setResults([]); // drop the previous origin's results until the fetch lands
    setSelectedId(null);
    setRoute(null);
    setFeature(null);
    try {
      const res = await fetchNearest(o.latlng, 5);
      setResults(res);
      setFocusBounds([o.latlng, ...res.map((r) => r.snapped)]);
      setSheetSnap("half");
    } catch {
      setResults([]);
      setFocusBounds([o.latlng]);
    }
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
    setSheetSnap("peek"); // clear the map to reveal the route

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
    setSheetSnap("half");
  }

  const statusMessage =
    geo.status === "denied"
      ? "Location is off. Search an address or drop a pin."
      : geo.status === "unavailable"
      ? "Couldn't find your location. Try searching instead."
      : null;

  const hasResults = !!origin && results.length > 0;

  return (
    <main className="relative h-[100dvh] w-full overflow-hidden">
      <MapView
        createProvider={createLeafletProvider}
        initialView={INITIAL_VIEW}
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

      {/* Floating top chrome: search + status. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-[1000] px-3 pt-3"
        style={{ paddingTop: "max(env(safe-area-inset-top), 0.75rem)" }}
      >
        <div className="pointer-events-auto mx-auto max-w-xl space-y-2.5">
          <SearchBar
            onUseMyLocation={handleUseMyLocation}
            onPickAddress={(hit) =>
              applyOrigin({ source: "address", latlng: { lat: hit.lat, lng: hit.lng }, label: hit.label })
            }
            onUseTestPin={() =>
              applyOrigin({ source: "simulated", latlng: MANHATTAN, label: "Manhattan test pin" })
            }
            locating={geo.status === "locating"}
            ready
            hasOrigin={!!origin}
            onReset={reset}
            dropPin={dropPin}
            onToggleDropPin={() => setDropPin((v) => !v)}
          />
          {statusMessage && !hasResults && (
            <StatusBanner message={statusMessage} tone="info" />
          )}
        </div>
      </div>

      {/* Results sheet (search flow). */}
      {hasResults && (
        <ResultsSheet
          results={results}
          origin={origin!.latlng}
          originLabel={origin!.label}
          selectedId={selectedId}
          idOf={idOf}
          snap={sheetSnap}
          onSnapChange={setSheetSnap}
          onSelect={selectResult}
        />
      )}

      {/* Idle exploration: tap a metered block for details. */}
      {!hasResults && <DetailSheet feature={feature} onClose={() => setFeature(null)} />}
    </main>
  );
}
