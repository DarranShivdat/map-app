"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

export type Snap = "peek" | "half" | "full";

interface SheetProps {
  /** Current snap (controlled). */
  snap: Snap;
  onSnapChange: (snap: Snap) => void;
  /** Which snaps are reachable, low → high. Default peek/half/full. */
  snapPoints?: Snap[];
  /** If provided, dragging below the lowest snap and releasing dismisses. */
  onDismiss?: () => void;
  /** Drag-region content (rendered under the grabber). */
  header?: ReactNode;
  /** Scrollable body. */
  children?: ReactNode;
  /** Accessible label for the sheet. */
  label?: string;
}

const PEEK_PX = 148; // visible height at the "peek" snap
const SHEET_VH = 0.92; // sheet is 92% of the viewport tall
const DISMISS_SLOP = 64; // drag this far below peek to dismiss

/**
 * Apple-Maps-style draggable bottom sheet. Full-bleed map shows behind it.
 *
 * Mechanics: the sheet is a fixed element `SHEET_VH` of the viewport tall,
 * translated down so the chosen snap's height stays visible. The resting
 * position is derived straight from `snap` during render; a transient drag
 * offset (in px) overrides it only while a pointer is down. Dragging is bound
 * to the header region so the body scrolls independently.
 */
export default function Sheet({
  snap,
  onSnapChange,
  snapPoints = ["peek", "half", "full"],
  onDismiss,
  header,
  children,
  label,
}: SheetProps) {
  // Viewport height for px math. Sheet only mounts client-side (its parent
  // gates on runtime state), so reading window here is safe.
  const [vh, setVh] = useState(() =>
    typeof window !== "undefined" ? window.innerHeight : 0
  );
  // Live translateY while dragging, in px; null when resting.
  const [dragTy, setDragTy] = useState<number | null>(null);
  const drag = useRef<{ startY: number; startTy: number } | null>(null);

  useEffect(() => {
    const measure = () => setVh(window.innerHeight);
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Resting translateY offset for a snap (visible-height target).
  const offsetFor = useCallback(
    (s: Snap): number => {
      const height = vh * SHEET_VH;
      if (s === "full") return 0;
      if (s === "half") return Math.max(0, height - vh * 0.5);
      return Math.max(0, height - PEEK_PX); // peek
    },
    [vh]
  );

  const restTy = offsetFor(snap);
  const ty = dragTy ?? restTy;
  const dragging = dragTy !== null;

  const onPointerDown = (e: ReactPointerEvent) => {
    if (!vh) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { startY: e.clientY, startTy: restTy };
    setDragTy(restTy);
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    if (!drag.current) return;
    const peekTy = offsetFor("peek");
    const next = drag.current.startTy + (e.clientY - drag.current.startY);
    // Allow extra travel below peek when the sheet can be dismissed.
    const max = peekTy + (onDismiss ? DISMISS_SLOP + 40 : 12);
    setDragTy(Math.max(-12, Math.min(max, next)));
  };

  const onPointerUp = () => {
    if (!drag.current) return;
    const released = dragTy ?? restTy;
    const peekTy = offsetFor("peek");
    drag.current = null;
    setDragTy(null);

    if (onDismiss && released > peekTy + DISMISS_SLOP) {
      onDismiss();
      return;
    }
    // Snap to whichever enabled point is closest to where we let go.
    let best: Snap = snapPoints[0];
    let bestDist = Infinity;
    for (const s of snapPoints) {
      const d = Math.abs(offsetFor(s) - released);
      if (d < bestDist) {
        bestDist = d;
        best = s;
      }
    }
    if (best !== snap) onSnapChange(best);
  };

  return (
    <div className="sheet-in pointer-events-none fixed inset-x-0 bottom-0 z-[1000]">
      <section
        role="dialog"
        aria-label={label}
        className={`pointer-events-auto mx-auto flex max-w-2xl flex-col rounded-t-[28px] border-t border-white/60 bg-white/80 shadow-[0_-10px_50px_rgba(15,23,42,0.18)] backdrop-blur-2xl ${
          dragging ? "" : "sheet-rest"
        }`}
        style={{
          height: `${SHEET_VH * 100}dvh`,
          transform: `translateY(${ty}px)`,
        }}
      >
        {/* Drag region: grabber + header. */}
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="shrink-0 cursor-grab touch-none select-none px-5 pb-1 pt-2.5 active:cursor-grabbing"
        >
          <div className="mx-auto mb-2 h-1.5 w-9 rounded-full bg-zinc-300/90" />
          {header}
        </div>

        {/* Scrollable body. */}
        <div
          className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-4"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom), 1rem)" }}
        >
          {children}
        </div>
      </section>
    </div>
  );
}
