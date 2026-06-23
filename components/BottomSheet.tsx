"use client";

import type { SelectedFeature } from "@/lib/map/types";

// Field keys verified against FeatureServer/1 metadata + a sample GeoJSON
// feature (the GeoJSON keys use the raw field `name`, not the alias).
const FIELDS: { key: string; label: string }[] = [
  { key: "AllVehiclesRate", label: "Rate" },
  { key: "AllVehiclesTimeLimit", label: "Time limit" },
  { key: "AllVehiclesHoursInEffect", label: "Hours in effect" },
  { key: "AllVehiclesMaxPayment", label: "Max payment" },
  { key: "SideOfStreet", label: "Side of street" },
  { key: "MeterRateZone", label: "Rate zone" },
  { key: "Borough", label: "Borough" },
  { key: "PayByCellNumber", label: "Pay-by-cell #" },
];

function str(props: Record<string, unknown>, key: string): string | null {
  const v = props[key];
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" || s.toUpperCase() === "N/A" ? null : s;
}

export default function BottomSheet({
  feature,
  onClose,
}: {
  feature: SelectedFeature | null;
  onClose: () => void;
}) {
  if (!feature) return null;
  const p = feature.properties;

  const onStreet = str(p, "OnStreet") ?? "Metered block";
  const from = str(p, "FromStreet");
  const to = str(p, "ToStreet");
  const between = from && to ? `Between ${from} and ${to}` : from ?? to;

  const rows = FIELDS.map((f) => ({ ...f, value: str(p, f.key) })).filter(
    (r) => r.value !== null
  );

  return (
    <div
      className="absolute inset-x-0 bottom-0 z-[1000] rounded-t-2xl bg-white shadow-[0_-4px_24px_rgba(0,0,0,0.18)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto max-w-xl px-5 pb-5 pt-3">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-zinc-300" />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-zinc-900">
              {onStreet}
            </h2>
            {between && (
              <p className="mt-0.5 text-sm text-zinc-500">{between}</p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 shrink-0 rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M5 5l10 10M15 5L5 15"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
          {rows.map((r) => (
            <div key={r.key}>
              <dt className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                {r.label}
              </dt>
              <dd className="mt-0.5 text-sm text-zinc-900">{r.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
