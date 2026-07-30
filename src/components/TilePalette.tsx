"use client";

import { useState } from "react";
import { NOTE_TILES, RhythmTile, TRIPLET_TILES } from "@/lib/rhythm";
import { DraggableTile } from "./DraggableTile";

type Mode = "straight" | "triplet";

export function TilePalette({
  isMobile,
  armedTile,
  onArmTile,
}: {
  isMobile: boolean;
  armedTile: RhythmTile | null;
  onArmTile: (tile: RhythmTile) => void;
}) {
  const [mode, setMode] = useState<Mode>("straight");
  const tiles = mode === "straight" ? NOTE_TILES : TRIPLET_TILES;

  function renderTile(t: RhythmTile) {
    return (
      <DraggableTile
        key={t.id}
        tile={t}
        isMobile={isMobile}
        isArmed={armedTile?.id === t.id}
        onArm={() => onArmTile(t)}
      />
    );
  }

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

      <div className="flex-1 overflow-y-auto pr-1">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-white/60">
          {mode === "straight" ? "Notes" : "Triplet notes"} <span className="text-white/30">({tiles.length})</span>
        </h2>
        <p className="mb-2 text-xs leading-snug text-white/40">
          Need a rest? Place a tile, then {isMobile ? "tap" : "click"} any hit on it to silence just that part.
        </p>
        <div className="grid grid-cols-2 gap-2 pb-2">{tiles.map(renderTile)}</div>
      </div>
    </div>
  );
}
