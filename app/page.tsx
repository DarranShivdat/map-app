"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import BottomSheet from "@/components/BottomSheet";
import { createLeafletProvider } from "@/lib/map/leaflet-provider";
import type { MapView as MapViewport, SelectedFeature } from "@/lib/map/types";

// Leaflet needs the DOM, so load the map only on the client.
const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

// Centered on Manhattan; zoomed out enough to start in clustered mode.
const INITIAL_VIEW: MapViewport = {
  center: { lat: 40.7308, lng: -73.9973 },
  zoom: 13,
};

export default function Home() {
  const [selected, setSelected] = useState<SelectedFeature | null>(null);

  return (
    <main className="relative h-[100dvh] w-full overflow-hidden">
      <header className="pointer-events-none absolute inset-x-0 top-0 z-[1000] p-3">
        <div className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-white/95 px-4 py-2 shadow-md backdrop-blur">
          <span className="h-2.5 w-2.5 rounded-full bg-[#1e9e4a]" />
          <span className="text-sm font-semibold text-zinc-900">
            NYC Metered Parking
          </span>
        </div>
      </header>

      <MapView
        createProvider={createLeafletProvider}
        initialView={INITIAL_VIEW}
        dataUrl="/api/parking"
        onSelect={setSelected}
      />

      <BottomSheet feature={selected} onClose={() => setSelected(null)} />
    </main>
  );
}
