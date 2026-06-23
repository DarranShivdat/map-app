// Field keys verified against FeatureServer/1 metadata + sample GeoJSON.
// (GeoJSON property keys use the raw field `name`, not the alias.)

export type Props = Record<string, unknown>;

/** Read a string field, treating blank / "N/A" as absent. */
export function prop(props: Props, key: string): string | null {
  const v = props[key];
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" || s.toUpperCase() === "N/A" ? null : s;
}

/** Human title + cross-streets for a block segment. */
export function blockTitle(props: Props): { title: string; between: string | null } {
  const onStreet = prop(props, "OnStreet") ?? "Metered block";
  const from = prop(props, "FromStreet");
  const to = prop(props, "ToStreet");
  const between = from && to ? `Between ${from} and ${to}` : from ?? to;
  return { title: onStreet, between };
}

/** Detail rows shown in cards and the bottom sheet, in priority order. */
export const DETAIL_FIELDS: { key: string; label: string }[] = [
  { key: "AllVehiclesRate", label: "Rate" },
  { key: "AllVehiclesTimeLimit", label: "Time limit" },
  { key: "AllVehiclesHoursInEffect", label: "Hours in effect" },
  { key: "AllVehiclesMaxPayment", label: "Max payment" },
  { key: "SideOfStreet", label: "Side of street" },
  { key: "MeterRateZone", label: "Rate zone" },
  { key: "Borough", label: "Borough" },
  { key: "PayByCellNumber", label: "Pay-by-cell #" },
];

export function detailRows(props: Props) {
  return DETAIL_FIELDS.map((f) => ({ ...f, value: prop(props, f.key) })).filter(
    (r) => r.value !== null
  );
}
