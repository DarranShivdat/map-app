"use client";

/** Small frosted, friendly status pill shown under the search bar. */
export default function StatusBanner({
  message,
  tone = "info",
}: {
  message: string;
  tone?: "info" | "warn";
}) {
  const accent =
    tone === "warn" ? "text-amber-600" : "text-accent";
  return (
    <div className="flex justify-center">
      <div className="flex max-w-full items-center gap-2 rounded-full border border-white/70 bg-white/85 px-3.5 py-2 shadow-[0_4px_18px_rgba(15,23,42,0.12)] backdrop-blur-2xl">
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
          className={`shrink-0 ${accent}`}
        >
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
          <path d="M12 8h.01M11 12h1v4h1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-[13px] font-medium text-zinc-700">{message}</span>
      </div>
    </div>
  );
}
