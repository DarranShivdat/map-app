"use client";

import Sheet, { type Snap } from "@/components/Sheet";
import ResultCard from "@/components/ResultCard";
import type { NearestResult } from "@/lib/parking/nearest";
import type { LatLng } from "@/lib/map/types";

export default function ResultsSheet({
  results,
  origin,
  originLabel,
  selectedId,
  idOf,
  snap,
  onSnapChange,
  onSelect,
}: {
  results: NearestResult[];
  origin: LatLng;
  originLabel: string;
  selectedId: string | number | null;
  idOf: (r: NearestResult) => string | number;
  snap: Snap;
  onSnapChange: (s: Snap) => void;
  onSelect: (r: NearestResult) => void;
}) {
  return (
    <Sheet
      snap={snap}
      onSnapChange={onSnapChange}
      label="Nearby parking results"
      header={
        <div className="px-1">
          <h2 className="text-[19px] font-bold tracking-tight text-zinc-900">
            {results.length} {results.length === 1 ? "spot" : "spots"} nearby
          </h2>
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-[13px] text-zinc-500">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0">
              <path
                d="M12 21s7-5.5 7-11a7 7 0 10-14 0c0 5.5 7 11 7 11z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="2" />
            </svg>
            <span className="truncate">from {originLabel}</span>
          </p>
        </div>
      }
    >
      {results.length === 0 ? (
        <div className="flex flex-col items-center px-6 py-12 text-center">
          <p className="text-[15px] font-semibold text-zinc-800">No metered blocks nearby</p>
          <p className="mt-1 text-[13px] text-zinc-500">
            Try a different address or drop a pin elsewhere.
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5 pb-2 pt-1.5">
          {results.map((r, i) => {
            const id = idOf(r);
            return (
              <li key={`${id}-${i}`}>
                <ResultCard
                  result={r}
                  rank={i + 1}
                  origin={origin}
                  active={id === selectedId}
                  onSelect={() => onSelect(r)}
                />
              </li>
            );
          })}
        </ul>
      )}
    </Sheet>
  );
}
