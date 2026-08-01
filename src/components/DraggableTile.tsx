"use client";

import { useDraggable } from "@dnd-kit/core";
import { RhythmTile } from "@/lib/rhythm";
import { TileVisual } from "./TileVisual";

export function DraggableTile({
  tile,
  isMobile,
  isArmed,
  onArm,
}: {
  tile: RhythmTile;
  isMobile: boolean;
  isArmed: boolean;
  onArm: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${tile.id}`,
    data: { tile },
    disabled: isMobile,
  });

  return (
    <button
      ref={setNodeRef}
      {...(isMobile ? {} : listeners)}
      {...(isMobile ? {} : attributes)}
      onClick={onArm}
      type="button"
      title={tile.label}
      className={`flex w-full flex-col gap-1 rounded-md border p-1.5 text-left transition ${
        isArmed
          ? "border-yellow-400 bg-yellow-400/10"
          : "border-white/10 bg-white/5 hover:border-white/30 hover:bg-white/10"
      } ${isMobile ? "" : "active:cursor-grabbing"} ${
        isDragging ? "opacity-30" : isMobile ? "" : "cursor-grab"
      }`}
    >
      <TileVisual tile={tile} height={20} />
      <span className="truncate text-[10px] leading-tight text-white/70">{tile.label}</span>
    </button>
  );
}
