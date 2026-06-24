"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { geocode, type GeocodeHit } from "@/lib/geo/geocode";
import { useSearchHistory } from "@/hooks/useSearchHistory";
import { NYC_HOTSPOTS } from "@/lib/geo/nyc-hotspots";

interface SearchBarProps {
  /** Run a search from the user's GPS location (locating first if needed). */
  onSearchFromLocation: () => void;
  onPickAddress: (hit: GeocodeHit) => void;
  onUseTestPin: () => void;
  locating: boolean;
  /** Parking data loaded — actions stay disabled until then. */
  ready: boolean;
  /** True once we have a GPS fix (used only for the dropdown's subtext). */
  hasUserLocation: boolean;
  dropPin: boolean;
  onToggleDropPin: () => void;
  /** Increment to blank the field + close the dropdown (e.g. results dismissed). */
  clearSignal: number;
  /** Called when the field's ✕ is pressed — clears the results sheet too. */
  onClear: () => void;
}

const cellKey = (h: GeocodeHit) => `${h.lat.toFixed(4)},${h.lng.toFixed(4)}`;

export default function SearchBar({
  onSearchFromLocation,
  onPickAddress,
  onUseTestPin,
  locating,
  ready,
  hasUserLocation,
  dropPin,
  onToggleDropPin,
  clearSignal,
  onClear,
}: SearchBarProps) {
  // The field behaves like a directions origin. `mode` tracks what the current
  // text means: "current" → the GPS sentinel; "custom" → a typed/picked address.
  const [mode, setMode] = useState<"current" | "custom">("custom");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<GeocodeHit[]>([]);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { recents, add } = useSearchHistory();

  // Debounced geocoding (Nominatim policy: don't hammer the endpoint). Skipped
  // while the field is empty or holds the "Current location" sentinel.
  useEffect(() => {
    if (mode === "current") return;
    const q = query.trim();
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      if (q.length < 3) {
        setHits([]);
        return;
      }
      const res = await geocode(q, ctrl.signal);
      setHits(res);
    }, 500);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, mode]);

  // External request to blank the field (results dismissed) — close the dropdown
  // and reset to empty. Skip the initial mount so we don't clobber nothing.
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    setMode("custom");
    setQuery("");
    setHits([]);
    setOpen(false);
  }, [clearSignal]);

  function handleFocus(e: React.FocusEvent<HTMLInputElement>) {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    if (mode === "current") e.target.select(); // first keystroke replaces sentinel
    setOpen(true);
  }

  function handleBlur() {
    // Delay so a tap on a dropdown row registers before we close.
    blurTimer.current = setTimeout(() => setOpen(false), 150);
  }

  function changeText(value: string) {
    setMode("custom");
    setQuery(value);
    setOpen(true);
  }

  function choosePlace(hit: GeocodeHit) {
    setMode("custom");
    setQuery(hit.label);
    setHits([]);
    setOpen(false);
    inputRef.current?.blur();
    add(hit); // remember real searches
    onPickAddress(hit);
  }

  function chooseCurrentLocation() {
    setMode("current");
    setQuery("Current location");
    setHits([]);
    setOpen(false);
    inputRef.current?.blur();
    onSearchFromLocation();
  }

  // Submit whatever's in the field: the sentinel searches from GPS; typed text
  // resolves to the best geocode match.
  async function submit() {
    setOpen(false);
    inputRef.current?.blur();
    if (mode === "current") {
      onSearchFromLocation();
      return;
    }
    const q = query.trim();
    if (!q) return;
    if (hits.length) {
      choosePlace(hits[0]);
      return;
    }
    const res = await geocode(q);
    if (res.length) choosePlace(res[0]);
  }

  // ✕ → truly empty, keep focus, re-show the suggestions list, AND dismiss any
  // stale results sheet. No CTA, no "Current location" refill.
  function clearText() {
    setMode("custom");
    setQuery("");
    setHits([]);
    setOpen(true);
    inputRef.current?.focus();
    onClear();
  }

  // The suggestions shown before typing: recents first, back-filled with NYC
  // hotspots so the list is never empty.
  const recentCount = Math.min(recents.length, 4);
  const suggestions: GeocodeHit[] = recents.slice(0, 4);
  if (suggestions.length < 4) {
    const have = new Set(suggestions.map(cellKey));
    for (const h of NYC_HOTSPOTS) {
      if (suggestions.length >= 4) break;
      if (!have.has(cellKey(h))) suggestions.push(h);
    }
  }

  const showingSuggestions = mode === "current" || query.trim().length === 0;
  const submitDisabled = !ready || (mode === "custom" && !query.trim());

  return (
    <div className="space-y-2.5">
      {/* Floating search pill. */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex items-center gap-2 rounded-full border border-white/70 bg-white/80 py-1.5 pl-4 pr-1.5 shadow-[0_6px_24px_rgba(15,23,42,0.14)] backdrop-blur-2xl"
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0 text-zinc-400">
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <path d="M21 21l-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>

        <input
          ref={inputRef}
          value={query}
          onChange={(e) => changeText(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={!ready}
          placeholder={ready ? "Search an address or place" : "Loading parking data…"}
          className={`min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-zinc-400 disabled:text-zinc-400 ${
            mode === "current" ? "font-medium text-accent" : "text-zinc-900"
          }`}
        />

        {query && (
          <button
            type="button"
            onClick={clearText}
            aria-label="Clear search"
            className="shrink-0 rounded-full p-1 text-zinc-400 transition hover:text-zinc-600"
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="9" fill="currentColor" opacity="0.12" />
              <path d="M7 7l6 6M13 7l-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        )}

        {/* Search (submit) action. */}
        <button
          type="submit"
          disabled={submitDisabled}
          aria-label="Search"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-white shadow-sm transition active:scale-95 disabled:opacity-60"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2.5" />
            <path d="M21 21l-4.2-4.2" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </button>
      </form>

      {/* Focus dropdown: suggestions (current location + recents/hotspots) before
          typing, live autocomplete while typing. */}
      {open && showingSuggestions && (
        <ul className="overflow-hidden rounded-3xl border border-white/70 bg-white/90 py-1.5 shadow-[0_10px_36px_rgba(15,23,42,0.18)] backdrop-blur-2xl">
          <Row
            onSelect={chooseCurrentLocation}
            title="Current location"
            subtitle={locating ? "Locating…" : hasUserLocation ? "Search nearby parking" : "Use your GPS location"}
            tint
            icon={
              locating ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden className="animate-spin">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
                  <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M21 3L3 10.5l7.5 2.5L13 21l8-18z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                </svg>
              )
            }
          />
          {suggestions.map((s, i) => (
            <Row
              key={`${cellKey(s)}-${i}`}
              onSelect={() => choosePlace(s)}
              title={s.label}
              subtitle={s.sublabel}
              icon={i < recentCount ? <ClockIcon /> : <PinIcon />}
            />
          ))}
        </ul>
      )}

      {open && !showingSuggestions && hits.length > 0 && (
        <ul className="overflow-hidden rounded-3xl border border-white/70 bg-white/90 py-1.5 shadow-[0_10px_36px_rgba(15,23,42,0.18)] backdrop-blur-2xl">
          {hits.map((h, i) => (
            <Row
              key={`${cellKey(h)}-${i}`}
              onSelect={() => choosePlace(h)}
              title={h.label}
              subtitle={h.sublabel}
              icon={<PinIcon />}
            />
          ))}
        </ul>
      )}

      {/* Secondary affordances (resting state only). */}
      {!open && (
        <div className="flex justify-center gap-2">
          <Chip active={dropPin} onClick={onToggleDropPin} disabled={!ready}>
            {dropPin ? "Tap the map…" : "Drop a pin"}
          </Chip>
          <Chip onClick={onUseTestPin} disabled={!ready}>
            Test pin
          </Chip>
        </div>
      )}
    </div>
  );
}

function Row({
  onSelect,
  title,
  subtitle,
  icon,
  tint,
}: {
  onSelect: () => void;
  title: string;
  subtitle?: string;
  icon: ReactNode;
  tint?: boolean;
}) {
  return (
    <li>
      <button
        type="button"
        // Run before the input's blur-close timer fires.
        onMouseDown={(e) => e.preventDefault()}
        onClick={onSelect}
        className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-zinc-500/5"
      >
        <span className={`mt-0.5 shrink-0 ${tint ? "text-accent" : "text-zinc-400"}`}>{icon}</span>
        <span className="min-w-0">
          <span className={`block truncate text-[14px] font-medium ${tint ? "text-accent" : "text-zinc-800"}`}>
            {title}
          </span>
          {subtitle && <span className="block truncate text-[12px] text-zinc-500">{subtitle}</span>}
        </span>
      </button>
    </li>
  );
}

function ClockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M12 7.5V12l3 1.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 21s7-5.5 7-11a7 7 0 10-14 0c0 5.5 7 11 7 11z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function Chip({
  children,
  onClick,
  active,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
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
