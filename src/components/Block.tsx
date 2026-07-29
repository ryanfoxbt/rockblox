"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import { RhythmTile } from "@/lib/rhythm";
import { TileVisual } from "./TileVisual";

export function Block({
  id,
  tile,
  active,
  playing,
  isMobile,
  onClear,
  onTap,
}: {
  id: string;
  tile: RhythmTile | null;
  active: boolean;
  playing: boolean;
  isMobile: boolean;
  onClear: () => void;
  onTap: () => void;
}) {
  const { isOver, setNodeRef: setDropRef } = useDroppable({ id });
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({
    id: `block-${id}`,
    data: { tile, source: id },
    disabled: isMobile || !tile,
  });

  function setRefs(node: HTMLButtonElement | null) {
    setDropRef(node);
    setDragRef(node);
  }

  const title = isMobile
    ? tile
      ? `${tile.label} — tap to place selected tile, or clear`
      : "Tap to place the selected tile here"
    : tile
      ? `${tile.label} — drag to move, click to clear`
      : "Drop a rhythm tile here";

  return (
    <button
      type="button"
      ref={setRefs}
      {...(isMobile ? {} : tile ? attributes : {})}
      {...(isMobile ? {} : tile ? listeners : {})}
      onClick={isMobile ? onTap : tile ? onClear : undefined}
      title={title}
      className={[
        "flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border-2 p-1.5 transition",
        tile && !isMobile ? "cursor-grab active:cursor-grabbing" : "",
        active ? "border-white/25" : "border-dashed border-white/10 opacity-40",
        isOver ? "!border-yellow-400 bg-yellow-400/10" : tile ? "bg-white/5" : "bg-transparent",
        playing ? "ring-2 ring-yellow-400 ring-offset-2 ring-offset-slate-900" : "",
        isDragging ? "opacity-30" : "",
      ].join(" ")}
    >
      {tile ? <TileVisual tile={tile} height={44} /> : <span className="text-2xl text-white/20">+</span>}
    </button>
  );
}
