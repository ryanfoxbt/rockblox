"use client";

import { useState } from "react";
import { NOTE_TILES, REST_TILES, TRIPLET_TILES } from "@/lib/rhythm";
import { DraggableTile } from "./DraggableTile";

type Mode = "straight" | "triplet";

export function TilePalette() {
  const [mode, setMode] = useState<Mode>("straight");

  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden">
      <div className="flex rounded-md border border-white/10 bg-white/5 p-0.5 text-sm">
        <button
          type="button"
          onClick={() => setMode("straight")}
          className={`flex-1 rounded px-2 py-1 transition ${
            mode === "straight" ? "bg-yellow-400 text-slate-900 font-semibold" : "text-white/60 hover:text-white"
          }`}
        >
          Straight
        </button>
        <button
          type="button"
          onClick={() => setMode("triplet")}
          className={`flex-1 rounded px-2 py-1 transition ${
            mode === "triplet" ? "bg-yellow-400 text-slate-900 font-semibold" : "text-white/60 hover:text-white"
          }`}
        >
          Triplet
        </button>
      </div>

      {mode === "straight" ? (
        <>
          <div>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-white/60">
              Notes <span className="text-white/30">({NOTE_TILES.length})</span>
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {NOTE_TILES.map((t) => (
                <DraggableTile key={t.id} tile={t} />
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto pr-1">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-white/60">
              Rests <span className="text-white/30">({REST_TILES.length})</span>
            </h2>
            <div className="grid grid-cols-2 gap-2 pb-2">
              {REST_TILES.map((t) => (
                <DraggableTile key={t.id} tile={t} />
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="flex-1 overflow-y-auto pr-1">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-white/60">
            Triplet Notes <span className="text-white/30">({TRIPLET_TILES.length})</span>
          </h2>
          <div className="grid grid-cols-2 gap-2 pb-2">
            {TRIPLET_TILES.map((t) => (
              <DraggableTile key={t.id} tile={t} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
