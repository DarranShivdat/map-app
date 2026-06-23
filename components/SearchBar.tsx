"use client";

import { useEffect, useRef, useState } from "react";
import { geocode, type GeocodeHit } from "@/lib/geo/geocode";

interface SearchBarProps {
  onUseMyLocation: () => void;
  onPickAddress: (hit: GeocodeHit) => void;
  onUseTestPin: () => void;
  locating: boolean;
  locationError: string | null;
  /** Parking data loaded — actions stay disabled until then. */
  ready: boolean;
}

export default function SearchBar({
  onUseMyLocation,
  onPickAddress,
  onUseTestPin,
  locating,
  locationError,
  ready,
}: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<GeocodeHit[]>([]);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounced geocoding (Nominatim policy: don't hammer the endpoint).
  useEffect(() => {
    const q = query.trim();
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      if (q.length < 3) {
        setHits([]);
        return;
      }
      const res = await geocode(q, ctrl.signal);
      setHits(res);
      setOpen(true);
    }, 500);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  function pick(hit: GeocodeHit) {
    setQuery(hit.label.split(",").slice(0, 2).join(",").trim());
    setOpen(false);
    setHits([]);
    inputRef.current?.blur();
    onPickAddress(hit);
  }

  return (
    <div className="space-y-2">
      <button
        onClick={onUseMyLocation}
        disabled={locating || !ready}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1e9e4a] px-4 py-3 font-semibold text-white shadow-sm transition active:scale-[0.99] disabled:opacity-70"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 2v3m0 14v3m10-10h-3M5 12H2m15.5-5.5l-2 2m-7 7l-2 2m11 0l-2-2m-7-7l-2-2"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="2" />
        </svg>
        {!ready ? "Loading parking data…" : locating ? "Locating…" : "Find parking near me"}
      </button>

      <div className="relative">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => hits.length && setOpen(true)}
          disabled={!ready}
          placeholder="Or search an NYC address…"
          className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-[#1e9e4a] disabled:bg-zinc-50"
        />
        {open && hits.length > 0 && (
          <ul className="absolute z-[1100] mt-1 max-h-64 w-full overflow-auto rounded-xl border border-zinc-200 bg-white py-1 shadow-lg">
            {hits.map((h, i) => (
              <li key={`${h.lat},${h.lng},${i}`}>
                <button
                  onClick={() => pick(h)}
                  className="block w-full px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50"
                >
                  {h.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-between text-xs">
        <button
          onClick={onUseTestPin}
          disabled={!ready}
          className="font-medium text-[#1e9e4a] underline-offset-2 hover:underline disabled:text-zinc-400 disabled:no-underline"
        >
          Use a Manhattan test pin
        </button>
        {locationError && <span className="text-amber-600">{locationError}</span>}
      </div>
    </div>
  );
}
