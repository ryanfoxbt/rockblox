import { NOTE_FRACTION, RhythmTile } from "@/lib/rhythm";

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
  onToggleHit,
  onCycleAccent,
}: {
  tile: RhythmTile;
  height?: number;
  onToggleHit?: (index: number) => void;
  // Cycles a note's dynamic level: normal -> accent -> ghost -> normal. Only
  // ever called for a "note" hit — rests have nothing to accent.
  onCycleAccent?: (index: number) => void;
}) {
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
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onToggleHit(i)}
            onDoubleClick={(e) => {
              // A double-click/double-tap fires two plain clicks first (which
              // toggle rest twice — a net no-op) followed by this — so it
              // reads as "leave the note/rest alone, just cycle its
              // dynamics" without needing a second, separately-clickable
              // target crammed into a hit that can be a few pixels wide.
              e.stopPropagation();
              if (!isRest) onCycleAccent?.(i);
            }}
            title={
              isRest
                ? "Rest — tap to sound this hit"
                : `Tap to turn this hit into a rest — double-tap to cycle accent/ghost/normal${
                    h.accent ? ` (currently ${h.accent})` : ""
                  }`
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
