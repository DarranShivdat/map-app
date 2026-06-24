"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
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

  // The user's GPS position (blue dot). Set ONLY by geolocation — never by a
  // typed address. Distinct from the search origin below.
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  // The point we rank parking near. Defaults to the user's location but can be
  // overridden by a typed address or dropped pin without moving the blue dot.
  const [origin, setOrigin] = useState<Origin | null>(null);
  const [results, setResults] = useState<NearestResult[]>([]);
  const [selectedId, setSelectedId] = useState<string | number | null>(null);
  const [route, setRoute] = useState<LatLng[] | null>(null);
  const [focusBounds, setFocusBounds] = useState<LatLng[] | null>(null);
  const [feature, setFeature] = useState<SelectedFeature | null>(null);
  const [dropPin, setDropPin] = useState(false);
  const [sheetSnap, setSheetSnap] = useState<Snap>("half");
  // Bumped to tell the search bar to blank itself (e.g. when results dismissed).
  const [clearSignal, setClearSignal] = useState(0);
  // Bumped to fly the map back to the blue GPS dot (recenter button).
  const [recenterSignal, setRecenterSignal] = useState(0);

  const routeReq = useRef(0);

  // Request geolocation immediately on load (not gated behind a button). On
  // success we drop the blue dot and recenter; we do NOT auto-search — the
  // search bar is prefilled with "Current location" and runs only on submit.
  useEffect(() => {
    let cancelled = false;
    geo.locate().then((ll) => {
      if (ll && !cancelled) {
        setUserLocation(ll);
        setFocusBounds([ll]);
      }
    });
    return () => {
      cancelled = true;
    };
    // Run once on mount; geo.locate is stable (useCallback).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Search from the user's GPS location. Reuses the location we already have;
  // only re-prompts if we don't (e.g. the initial request was denied).
  async function searchFromLocation() {
    let ll = userLocation;
    if (!ll) {
      ll = await geo.locate();
      if (ll) setUserLocation(ll);
    }
    if (ll) applyOrigin({ source: "geo", latlng: ll, label: "Current location" });
  }

  // Clear the search origin, results, and route back to a clean slate. Leaves
  // the blue GPS dot (userLocation) untouched.
  function clearSearchState() {
    setOrigin(null);
    setResults([]);
    setSelectedId(null);
    setRoute(null);
    setFocusBounds(null);
    setFeature(null);
    setDropPin(false);
    setSheetSnap("half");
  }

  // Sheet's own ✕ / drag-dismiss: clear state AND blank+close the search field.
  function dismissResults() {
    clearSearchState();
    setClearSignal((n) => n + 1);
  }

  const statusMessage =
    geo.status === "denied"
      ? "Location is off. Search an address or drop a pin."
      : geo.status === "unavailable"
      ? "Couldn't find your location. Try searching instead."
      : null;

  const hasResults = !!origin && results.length > 0;

  // Recenter button: shown when we have a GPS dot, hidden behind any expanded
  // sheet (so it's never occluded). Sits above the results sheet at "peek".
  const detailUp = !hasResults && !!feature;
  const showRecenter = !!userLocation && !detailUp && (!hasResults || sheetSnap === "peek");
  const recenterRaised = hasResults && sheetSnap === "peek";

  // The search-origin marker only appears when the origin isn't the GPS dot
  // (typed address / dropped pin); otherwise the blue dot already marks it.
  const searchMarker = origin && origin.source !== "geo" ? origin.latlng : null;

  return (
    <main className="relative h-[100dvh] w-full overflow-hidden">
      <MapView
        createProvider={createLeafletProvider}
        initialView={INITIAL_VIEW}
        userLocation={userLocation}
        searchOrigin={searchMarker}
        candidates={candidates}
        selectedId={selectedId}
        route={route}
        focusBounds={focusBounds}
        recenterSignal={recenterSignal}
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
            onSearchFromLocation={searchFromLocation}
            onPickAddress={(hit) =>
              applyOrigin({ source: "address", latlng: { lat: hit.lat, lng: hit.lng }, label: hit.label })
            }
            onUseTestPin={() =>
              applyOrigin({ source: "simulated", latlng: MANHATTAN, label: "Manhattan test pin" })
            }
            locating={geo.status === "locating"}
            ready
            hasUserLocation={!!userLocation}
            dropPin={dropPin}
            onToggleDropPin={() => setDropPin((v) => !v)}
            clearSignal={clearSignal}
            onClear={clearSearchState}
          />
          {statusMessage && !hasResults && (
            <StatusBanner message={statusMessage} tone="info" />
          )}
        </div>
      </div>

      {/* Recenter on my location (map move only — no search). */}
      {showRecenter && (
        <button
          type="button"
          onClick={() => setRecenterSignal((n) => n + 1)}
          aria-label="Recenter on my location"
          className="absolute right-3 z-[1000] flex h-11 w-11 items-center justify-center rounded-full border border-white/70 bg-white/85 text-zinc-700 shadow-[0_4px_16px_rgba(15,23,42,0.18)] backdrop-blur-2xl transition active:scale-95"
          style={{
            bottom: recenterRaised
              ? "calc(env(safe-area-inset-bottom) + 164px)"
              : "calc(env(safe-area-inset-bottom) + 1.5rem)",
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      )}

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
          onDismiss={dismissResults}
        />
      )}

      {/* Idle exploration: tap a metered block for details. */}
      {!hasResults && <DetailSheet feature={feature} onClose={() => setFeature(null)} />}
    </main>
  );
}
