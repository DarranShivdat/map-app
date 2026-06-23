"use client";

import type { NearestResult } from "@/lib/parking/nearest";
import type { LatLng } from "@/lib/map/types";
import { blockTitle, prop } from "@/lib/parking/fields";
import { walkingDirectionsUrl } from "@/lib/geo/maps-handoff";

function fmtDist(m: number): string {
  return m < 1000 ? `${Math.round(m / 10) * 10} m away` : `${(m / 1000).toFixed(1)} km away`;
}

export default function ResultCard({
  result,
  rank,
  origin,
  active,
  onSelect,
}: {
  result: NearestResult;
  rank: number;
  origin: LatLng;
  active: boolean;
  onSelect: () => void;
}) {
  const props = result.feature.properties ?? {};
  const { title, between } = blockTitle(props);
  const rate = prop(props, "AllVehiclesRate");
  const limit = prop(props, "AllVehiclesTimeLimit");
  const hours = prop(props, "AllVehiclesHoursInEffect");

  return (
    <div
      className={`overflow-hidden rounded-3xl border bg-white transition-shadow ${
        active
          ? "border-accent/40 shadow-[0_8px_28px_rgba(37,99,235,0.18)] ring-2 ring-accent/30"
          : "border-zinc-200/70 shadow-[0_2px_10px_rgba(15,23,42,0.05)]"
      }`}
    >
      <button
        onClick={onSelect}
        className="block w-full px-4 pb-3 pt-3.5 text-left"
        aria-pressed={active}
      >
        <div className="flex items-start gap-3">
          <span
            className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white shadow-sm ${
              active ? "bg-accent" : "bg-pin"
            }`}
          >
            {rank}
          </span>

          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[15px] font-semibold leading-tight text-zinc-900">
              {title}
            </h3>
            {between && (
              <p className="mt-0.5 truncate text-[13px] text-zinc-500">{between}</p>
            )}
          </div>

          {/* Hero: walk time. */}
          <div className="shrink-0 text-right leading-none">
            <div className="text-[26px] font-bold tracking-tight text-zinc-900">
              {result.walkMin}
              <span className="ml-0.5 text-[13px] font-semibold text-zinc-400">min</span>
            </div>
            <div className="mt-1 text-[11px] font-medium text-zinc-400">
              {fmtDist(result.distanceMeters)}
            </div>
          </div>
        </div>

        {(rate || limit || hours) && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {rate && (
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[12px] font-semibold text-emerald-700">
                {rate}
              </span>
            )}
            {limit && (
              <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[12px] font-medium text-zinc-600">
                {limit} limit
              </span>
            )}
            {hours && (
              <span className="truncate rounded-full bg-zinc-100 px-2.5 py-1 text-[12px] font-medium text-zinc-500">
                {hours}
              </span>
            )}
          </div>
        )}
      </button>

      <div className="px-4 pb-4">
        <a
          href={walkingDirectionsUrl(origin, result.snapped, title)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-3 text-[15px] font-bold text-white shadow-sm transition active:scale-[0.985] active:bg-accent/90"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="13" cy="4" r="2" fill="currentColor" />
            <path
              d="M10.5 9.5l2.5-1 2 2 2.5 1.5M11 22l1.5-6-2.5-2 1-5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M7 14l-1.5 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Walk here
        </a>
      </div>
    </div>
  );
}
