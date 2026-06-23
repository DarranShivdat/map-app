"use client";

import { useEffect, useRef, useState } from "react";
import { geocode, type GeocodeHit } from "@/lib/geo/geocode";

interface SearchBarProps {
  onUseMyLocation: () => void;
  onPickAddress: (hit: GeocodeHit) => void;
  onUseTestPin: () => void;
  locating: boolean;
  /** Parking data loaded — actions stay disabled until then. */
  ready: boolean;
  hasOrigin: boolean;
  onReset: () => void;
  dropPin: boolean;
  onToggleDropPin: () => void;
}

export default function SearchBar({
  onUseMyLocation,
  onPickAddress,
  onUseTestPin,
  locating,
  ready,
  hasOrigin,
  onReset,
  dropPin,
  onToggleDropPin,
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

  function clearSearch() {
    setQuery("");
    setHits([]);
    setOpen(false);
    onReset();
  }

  return (
    <div className="space-y-2.5">
      {/* Floating search pill. */}
      <div className="flex items-center gap-2 rounded-full border border-white/70 bg-white/80 py-1.5 pl-4 pr-1.5 shadow-[0_6px_24px_rgba(15,23,42,0.14)] backdrop-blur-2xl">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0 text-zinc-400">
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <path d="M21 21l-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>

        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => hits.length && setOpen(true)}
          disabled={!ready}
          placeholder={ready ? "Search an address or place" : "Loading parking data…"}
          className="min-w-0 flex-1 bg-transparent text-[15px] text-zinc-900 outline-none placeholder:text-zinc-400 disabled:text-zinc-400"
        />

        {query && (
          <button
            onClick={clearSearch}
            aria-label="Clear search"
            className="shrink-0 rounded-full p-1 text-zinc-400 transition hover:text-zinc-600"
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="9" fill="currentColor" opacity="0.12" />
              <path d="M7 7l6 6M13 7l-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        )}

        {/* "Near me" action. */}
        <button
          onClick={onUseMyLocation}
          disabled={locating || !ready}
          aria-label="Find parking near me"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-white shadow-sm transition active:scale-95 disabled:opacity-60"
        >
          {locating ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden className="animate-spin">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
              <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M21 3L3 10.5l7.5 2.5L13 21l8-18z"
                fill="currentColor"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>
      </div>

      {/* Autocomplete results. */}
      {open && hits.length > 0 && (
        <ul className="overflow-hidden rounded-3xl border border-white/70 bg-white/90 py-1.5 shadow-[0_10px_36px_rgba(15,23,42,0.18)] backdrop-blur-2xl">
          {hits.map((h, i) => (
            <li key={`${h.lat},${h.lng},${i}`}>
              <button
                onClick={() => pick(h)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-zinc-500/5"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0 text-zinc-400">
                  <path d="M12 21s7-5.5 7-11a7 7 0 10-14 0c0 5.5 7 11 7 11z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                  <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="2" />
                </svg>
                <span className="truncate text-[14px] text-zinc-700">{h.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Secondary affordances. */}
      {!open &&
        (hasOrigin ? (
          <div className="flex justify-center">
            <button
              onClick={clearSearch}
              className="rounded-full border border-white/70 bg-white/80 px-4 py-1.5 text-[13px] font-semibold text-zinc-700 shadow-sm backdrop-blur-2xl transition active:scale-95"
            >
              New search
            </button>
          </div>
        ) : (
          <div className="flex justify-center gap-2">
            <Chip active={dropPin} onClick={onToggleDropPin} disabled={!ready}>
              {dropPin ? "Tap the map…" : "Drop a pin"}
            </Chip>
            <Chip onClick={onUseTestPin} disabled={!ready}>
              Test pin
            </Chip>
          </div>
        ))}
    </div>
  );
}

function Chip({
  children,
  onClick,
  active,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full border px-3.5 py-1.5 text-[13px] font-medium shadow-sm backdrop-blur-2xl transition active:scale-95 disabled:opacity-50 ${
        active
          ? "border-accent/30 bg-accent/10 text-accent"
          : "border-white/70 bg-white/80 text-zinc-600"
      }`}
    >
      {children}
    </button>
  );
}
