"use client";

import { useState } from "react";
import { DEFAULT_COMPLEXITY, MAX_COMPLEXITY, MIN_COMPLEXITY } from "@/lib/randomBeat";

export interface VariationSource {
  slot: string;
  label: string;
}

export type VariationKind = "groove" | "fill";

// Dice button + a small popover: either a fresh random beat, or a
// variation/fill based on another slot's beat — a song is usually one theme
// repeated with small changes plus the occasional fill, not four unrelated
// random beats, so once a source beat exists this defaults to "base it on
// that" rather than "randomize from scratch." Kept as its own component
// (rather than inline in Editor) so this state doesn't clutter the editor's
// already-large state list — same pattern as SongImportButton/FartRecorder.
export function RandomizeButton({
  variationSources,
  onGenerateNew,
  onGenerateVariation,
}: {
  variationSources: VariationSource[];
  onGenerateNew: (complexity: number) => void;
  onGenerateVariation: (sourceSlot: string, kind: VariationKind, complexity: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"new" | "variation">("new");
  const [complexity, setComplexity] = useState(DEFAULT_COMPLEXITY);
  const [sourceSlot, setSourceSlot] = useState<string | null>(null);
  const [variationKind, setVariationKind] = useState<VariationKind>("groove");

  const hasSources = variationSources.length > 0;
  const effectiveSourceSlot = sourceSlot ?? variationSources[0]?.slot ?? null;

  function handleOpen() {
    // Default to Variation when there's something to base it on — the more
    // common ask once a first beat already exists — but always leave "New"
    // one click away.
    setMode(hasSources ? "variation" : "new");
    setOpen(true);
  }

  function generate() {
    if (mode === "variation" && effectiveSourceSlot) {
      onGenerateVariation(effectiveSourceSlot, variationKind, complexity);
    } else {
      onGenerateNew(complexity);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
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

            {hasSources && (
              <div className="mb-3 flex rounded-md border border-white/10 bg-white/5 p-0.5 text-sm">
                <button
                  type="button"
                  onClick={() => setMode("new")}
                  className={`flex-1 rounded px-2 py-1 transition ${
                    mode === "new" ? "bg-yellow-400 font-semibold text-slate-900" : "text-white/60 hover:text-white"
                  }`}
                >
                  New
                </button>
                <button
                  type="button"
                  onClick={() => setMode("variation")}
                  className={`flex-1 rounded px-2 py-1 transition ${
                    mode === "variation"
                      ? "bg-yellow-400 font-semibold text-slate-900"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  Variation
                </button>
              </div>
            )}

            {mode === "variation" && hasSources && (
              <div className="mb-3 flex flex-col gap-2">
                <label className="flex flex-col gap-1 text-sm text-white/70">
                  Base on
                  <select
                    value={effectiveSourceSlot ?? ""}
                    onChange={(e) => setSourceSlot(e.target.value)}
                    className="rounded-md border border-white/15 bg-white/5 px-2 py-1.5 text-sm text-white"
                  >
                    {variationSources.map((s) => (
                      <option key={s.slot} value={s.slot} className="bg-slate-900">
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="flex rounded-md border border-white/10 bg-white/5 p-0.5 text-sm">
                  <button
                    type="button"
                    onClick={() => setVariationKind("groove")}
                    className={`flex-1 rounded px-2 py-1 transition ${
                      variationKind === "groove"
                        ? "bg-yellow-400 font-semibold text-slate-900"
                        : "text-white/60 hover:text-white"
                    }`}
                  >
                    Groove
                  </button>
                  <button
                    type="button"
                    onClick={() => setVariationKind("fill")}
                    className={`flex-1 rounded px-2 py-1 transition ${
                      variationKind === "fill"
                        ? "bg-yellow-400 font-semibold text-slate-900"
                        : "text-white/60 hover:text-white"
                    }`}
                  >
                    Fill
                  </button>
                </div>
              </div>
            )}

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
              onClick={generate}
              className="mt-4 w-full rounded-full bg-yellow-400 px-4 py-1.5 text-sm font-bold text-slate-900 transition hover:bg-yellow-300"
            >
              {mode === "variation" ? "🧬 Generate Variation" : "🎲 Generate"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
