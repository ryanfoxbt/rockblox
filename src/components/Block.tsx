"use client";

import { useDroppable } from "@dnd-kit/core";
import { RhythmTile } from "@/lib/rhythm";
import { TileVisual } from "./TileVisual";

export function Block({
  id,
  tile,
  active,
  playing,
  onClear,
}: {
  id: string;
  tile: RhythmTile | null;
  active: boolean;
  playing: boolean;
  onClear: () => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id });

  return (
    <button
      type="button"
      ref={setNodeRef}
      onClick={tile ? onClear : undefined}
      title={tile ? `${tile.label} — click to clear` : "Drop a rhythm tile here"}
      className={[
        "flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border-2 p-1.5 transition",
        active ? "border-white/25" : "border-dashed border-white/10 opacity-40",
        isOver ? "!border-yellow-400 bg-yellow-400/10" : tile ? "bg-white/5" : "bg-transparent",
        playing ? "ring-2 ring-yellow-400 ring-offset-2 ring-offset-slate-900" : "",
      ].join(" ")}
    >
      {tile ? <TileVisual tile={tile} height={44} /> : <span className="text-2xl text-white/20">+</span>}
    </button>
  );
}
