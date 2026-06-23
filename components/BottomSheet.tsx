"use client";

import type { SelectedFeature } from "@/lib/map/types";
import { blockTitle, detailRows } from "@/lib/parking/fields";

export default function BottomSheet({
  feature,
  onClose,
}: {
  feature: SelectedFeature | null;
  onClose: () => void;
}) {
  if (!feature) return null;
  const { title, between } = blockTitle(feature.properties);
  const rows = detailRows(feature.properties);

  return (
    <div
      className="absolute inset-x-0 bottom-0 z-[1000] rounded-t-2xl bg-white shadow-[0_-4px_24px_rgba(0,0,0,0.18)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto max-w-xl px-5 pb-5 pt-3">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-zinc-300" />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-zinc-900">{title}</h2>
            {between && <p className="mt-0.5 text-sm text-zinc-500">{between}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 shrink-0 rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
          {rows.map((r) => (
            <div key={r.key}>
              <dt className="text-xs font-medium uppercase tracking-wide text-zinc-400">{r.label}</dt>
              <dd className="mt-0.5 text-sm text-zinc-900">{r.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
