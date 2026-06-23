"use client";

import type { NearestResult } from "@/lib/parking/nearest";
import type { LatLng } from "@/lib/map/types";
import { blockTitle, prop } from "@/lib/parking/fields";
import { walkingDirectionsUrl } from "@/lib/geo/maps-handoff";

function idOf(r: NearestResult): string | number {
  return (r.feature.properties?.OBJECTID as number) ?? "";
}

function fmtDist(m: number): string {
  return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`;
}

export default function ResultsList({
  results,
  origin,
  selectedId,
  onSelect,
}: {
  results: NearestResult[];
  origin: LatLng;
  selectedId: string | number | null;
  onSelect: (r: NearestResult) => void;
}) {
  return (
    <ul className="space-y-2">
      {results.map((r, i) => {
        const id = idOf(r);
        const props = r.feature.properties ?? {};
        const { title, between } = blockTitle(props);
        const rate = prop(props, "AllVehiclesRate");
        const limit = prop(props, "AllVehiclesTimeLimit");
        const hours = prop(props, "AllVehiclesHoursInEffect");
        const active = id === selectedId;

        return (
          <li key={`${id}-${i}`}>
            <button
              onClick={() => onSelect(r)}
              className={`w-full rounded-xl border bg-white p-3 text-left transition ${
                active ? "border-[#2563eb] ring-1 ring-[#2563eb]" : "border-zinc-200 hover:border-zinc-300"
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${
                    active ? "bg-[#2563eb]" : "bg-[#1e9e4a]"
                  }`}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="truncate font-semibold text-zinc-900">{title}</h3>
                    <span className="shrink-0 text-sm font-medium text-zinc-500">
                      {r.walkMin} min · {fmtDist(r.distanceMeters)}
                    </span>
                  </div>
                  {between && <p className="truncate text-xs text-zinc-500">{between}</p>}

                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-zinc-600">
                    {rate && <span><span className="text-zinc-400">Rate</span> {rate}</span>}
                    {limit && <span><span className="text-zinc-400">Limit</span> {limit}</span>}
                  </div>
                  {hours && <p className="mt-0.5 truncate text-xs text-zinc-500">{hours}</p>}

                  <a
                    href={walkingDirectionsUrl(origin, r.snapped, title)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#2563eb] hover:underline"
                  >
                    Walk · Open in Maps
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path d="M7 17L17 7M17 7H9M17 7v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </a>
                </div>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
