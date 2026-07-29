"use client";

import { useDraggable } from "@dnd-kit/core";
import { RhythmTile } from "@/lib/rhythm";
import { TileVisual } from "./TileVisual";

export function DraggableTile({ tile }: { tile: RhythmTile }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${tile.id}`,
    data: { tile },
  });

  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      type="button"
      title={tile.label}
      className={`flex w-full flex-col gap-1 rounded-md border border-white/10 bg-white/5 p-1.5 text-left transition hover:border-white/30 hover:bg-white/10 active:cursor-grabbing ${
        isDragging ? "opacity-30" : "cursor-grab"
      }`}
    >
      <TileVisual tile={tile} height={20} />
      <span className="truncate text-[10px] leading-tight text-white/70">{tile.label}</span>
    </button>
  );
}
