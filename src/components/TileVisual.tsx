import { useRef } from "react";
import { NOTE_FRACTION, RhythmTile } from "@/lib/rhythm";

// How long a touch has to be held before it counts as a long-press (mobile's
// accent/ghost trigger, replacing desktop's right-click/Ctrl-click) rather
// than a plain tap (toggle rest).
const LONG_PRESS_MS = 450;

// A ghost note plays quietly (see rhythm.ts's ACCENT_VELOCITY) — shown here
// as a dimmed, parenthesized fill, the same convention real drum charts use.
// An accent plays louder — shown as a brighter fill with a ">" mark, again
// mirroring standard notation.
function hitFill(isRest: boolean, accent?: "accent" | "ghost"): string {
  if (isRest) return "repeating-linear-gradient(45deg, rgba(255,255,255,0.12) 0 4px, transparent 4px 8px)";
  if (accent === "ghost") return "rgba(255,255,255,0.35)";
  return "rgba(255,255,255,0.85)";
}

export function TileVisual({
  tile,
  height = 32,
  isMobile = false,
  onToggleHit,
  onCycleAccent,
}: {
  tile: RhythmTile;
  height?: number;
  isMobile?: boolean;
  onToggleHit?: (index: number) => void;
  // Cycles a note's dynamic level: normal -> accent -> ghost -> normal. Only
  // ever called for a "note" hit — rests have nothing to accent.
  onCycleAccent?: (index: number) => void;
}) {
  // Tracks an in-progress long-press (mobile) so the tap-release that
  // follows it doesn't also fire a toggle-to-rest — a long-press already
  // fires its own accent-cycle action, so the trailing click needs to be a
  // no-op rather than undoing/redoing the rest state.
  const longPressTimer = useRef<number | null>(null);
  const longPressFired = useRef(false);

  function clearLongPress() {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  return (
    <div className="flex w-full overflow-hidden rounded border border-white/20" style={{ height }}>
      {tile.hits.map((h, i) => {
        const widthPct = NOTE_FRACTION[h.note] * 100;
        const isRest = h.type === "rest";
        const style = { width: `${widthPct}%`, background: hitFill(isRest, h.accent) };
        const mark = !isRest && h.accent === "accent" ? ">" : !isRest && h.accent === "ghost" ? "( )" : null;

        if (!onToggleHit) {
          return (
            <div key={i} className="relative h-full border-r border-black/20 last:border-r-0" style={style}>
              {mark && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 flex items-center justify-center text-[8px] font-black leading-none text-slate-900"
                >
                  {mark}
                </span>
              )}
            </div>
          );
        }

        return (
          <button
            key={i}
            type="button"
            // The parent Block is itself a dnd-kit draggable (see Block.tsx),
            // with its drag listeners bound to pointerdown on the whole
            // container — without stopping propagation here, a click on this
            // button starts out as a pointerdown the drag sensor sees first,
            // so it can hijack the click into a phantom drag-and-drop instead
            // of a clean toggle of just this one hit.
            onPointerDown={(e) => {
              e.stopPropagation();
              longPressFired.current = false;
              if (!isMobile || isRest) return;
              longPressTimer.current = window.setTimeout(() => {
                longPressFired.current = true;
                onCycleAccent?.(i);
              }, LONG_PRESS_MS);
            }}
            onPointerUp={clearLongPress}
            onPointerLeave={clearLongPress}
            onPointerCancel={clearLongPress}
            onClick={(e) => {
              if (isMobile) {
                // The long-press already fired its own accent-cycle action —
                // don't let the release's trailing click also toggle rest.
                if (longPressFired.current) {
                  longPressFired.current = false;
                  return;
                }
                onToggleHit(i);
                return;
              }
              // Ctrl-click (Windows) or Option/Alt-click (Mac) — an
              // alternative to right-click for cycling accent/ghost, for
              // anyone on a trackpad/mouse without an easy secondary click.
              if ((e.ctrlKey || e.metaKey || e.altKey) && !isRest) {
                onCycleAccent?.(i);
                return;
              }
              onToggleHit(i);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!isRest) onCycleAccent?.(i);
            }}
            title={
              isRest
                ? "Rest — tap to sound this hit"
                : `${isMobile ? "Tap" : "Click"} to turn this hit into a rest — ${
                    isMobile ? "long-press" : "right-click, or Ctrl/Option-click,"
                  } to cycle accent/ghost/normal${h.accent ? ` (currently ${h.accent})` : ""}`
            }
            className="relative h-full border-r border-black/20 transition last:border-r-0 hover:brightness-90"
            style={style}
          >
            {mark && (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 flex items-center justify-center text-[8px] font-black leading-none text-slate-900"
              >
                {mark}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
