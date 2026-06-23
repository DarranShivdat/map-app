"use client";

import { useState } from "react";
import Sheet, { type Snap } from "@/components/Sheet";
import type { SelectedFeature } from "@/lib/map/types";
import { blockTitle, detailRows } from "@/lib/parking/fields";

/**
 * Idle-exploration detail for a tapped block. Reuses the draggable sheet but
 * with a single snap and drag-to-dismiss (no peek/full ladder needed here).
 */
export default function DetailSheet({
  feature,
  onClose,
}: {
  feature: SelectedFeature | null;
  onClose: () => void;
}) {
  const [snap, setSnap] = useState<Snap>("half");

  if (!feature) return null;
  const { title, between } = blockTitle(feature.properties);
  const rows = detailRows(feature.properties);

  return (
    <Sheet
      snap={snap}
      onSnapChange={setSnap}
      snapPoints={["half"]}
      onDismiss={onClose}
      label="Block details"
      header={
        <div className="flex items-start justify-between gap-3 px-1">
          <div className="min-w-0">
            <h2 className="truncate text-[19px] font-bold tracking-tight text-zinc-900">
              {title}
            </h2>
            {between && <p className="mt-0.5 truncate text-[13px] text-zinc-500">{between}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 shrink-0 rounded-full bg-zinc-100 p-1.5 text-zinc-500 transition hover:bg-zinc-200 hover:text-zinc-700"
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      }
    >
      <dl className="grid grid-cols-2 gap-x-4 gap-y-4 pb-2 pt-2">
        {rows.map((r) => (
          <div key={r.key}>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
              {r.label}
            </dt>
            <dd className="mt-1 text-[15px] font-medium text-zinc-900">{r.value}</dd>
          </div>
        ))}
      </dl>
    </Sheet>
  );
}
