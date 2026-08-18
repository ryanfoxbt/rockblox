"use client";

import { useState } from "react";
import { DEFAULT_COMPLEXITY, MAX_COMPLEXITY, MIN_COMPLEXITY } from "@/lib/randomBeat";

// Dice button + a small popover for the Complexity/Craziness dial. Kept as
// its own component (rather than inline in Editor) so the open/complexity
// state doesn't clutter the editor's already-large state list — same
// pattern as SongImportButton/FartRecorder.
export function RandomizeButton({ onGenerate }: { onGenerate: (complexity: number) => void }) {
  const [open, setOpen] = useState(false);
  const [complexity, setComplexity] = useState(DEFAULT_COMPLEXITY);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Randomize this beat"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/15 bg-white/5 text-base text-white/70 transition hover:border-yellow-400 hover:text-yellow-400"
      >
        🎲
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-xs rounded-lg border border-white/15 bg-slate-900 p-5 text-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">🎲 Randomize</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                title="Close"
                className="rounded-md px-2 py-0.5 text-white/50 transition hover:text-red-400"
              >
                ✕
              </button>
            </div>

            <label className="mb-1 flex items-center justify-between text-sm text-white/70">
              <span>Complexity / Craziness</span>
              <span className="font-mono text-yellow-400">{complexity}</span>
            </label>
            <input
              type="range"
              min={MIN_COMPLEXITY}
              max={MAX_COMPLEXITY}
              step={1}
              value={complexity}
              onChange={(e) => setComplexity(Number(e.target.value))}
              className="w-full accent-yellow-400"
            />
            <div className="mt-1 flex justify-between text-[10px] uppercase tracking-wide text-white/40">
              <span>Steady</span>
              <span>Chaotic</span>
            </div>

            <button
              type="button"
              onClick={() => onGenerate(complexity)}
              className="mt-4 w-full rounded-full bg-yellow-400 px-4 py-1.5 text-sm font-bold text-slate-900 transition hover:bg-yellow-300"
            >
              🎲 Generate
            </button>
          </div>
        </div>
      )}
    </>
  );
}
