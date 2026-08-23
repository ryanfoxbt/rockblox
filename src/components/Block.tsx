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
  picked,
  movePending,
  onClear,
  onTap,
  onToggleHit,
  onCycleAccent,
  onPickUp,
}: {
  id: string;
  tile: RhythmTile | null;
  active: boolean;
  playing: boolean;
  isMobile: boolean;
  picked: boolean;
  movePending: boolean;
  onClear: () => void;
  onTap: () => void;
  onToggleHit: (hitIndex: number) => void;
  onCycleAccent: (hitIndex: number) => void;
  onPickUp: () => void;
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

  function setRefs(node: HTMLDivElement | null) {
    setDropRef(node);
    setDragRef(node);
  }

  const title = isMobile
    ? tile
      ? "Tap a hit to toggle it as a rest, long-press to cycle accent/ghost — tap ✕ to clear"
      : "Tap to place the selected tile here"
    : tile
      ? picked
        ? "Click another block to drop it here, or click the grip again to cancel"
        : "Click a hit to toggle it as a rest, right-click (or Ctrl/Option-click) to cycle accent/ghost, drag to move, click the grip to pick it up, or click ✕ to clear"
      : movePending
        ? "Click here to drop the picked-up block"
        : "Drop a rhythm tile here";

  return (
    <div
      ref={setRefs}
      {...(isMobile ? {} : tile ? attributes : {})}
      {...(isMobile ? {} : tile ? listeners : {})}
      onClick={!tile ? onTap : undefined}
      title={title}
      className={[
        "relative flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border-2 p-1.5 transition",
        tile && !isMobile ? "cursor-grab active:cursor-grabbing" : "",
        !tile ? "cursor-pointer" : "",
        active
          ? !tile && isMobile
            ? "border-white/40 bg-white/[0.04]"
            : "border-white/25"
          : "border-dashed border-white/10 opacity-40",
        isOver ? "!border-yellow-400 bg-yellow-400/10" : tile ? "bg-white/5" : "bg-transparent",
        playing ? "ring-2 ring-yellow-400 ring-offset-2 ring-offset-slate-900" : "",
        isDragging ? "opacity-30" : "",
        picked ? "!border-yellow-400 bg-yellow-400/15 ring-2 ring-yellow-400/70 ring-offset-2 ring-offset-slate-900" : "",
        !tile && !isMobile && movePending && !picked ? "!border-yellow-400/50 bg-yellow-400/5" : "",
      ].join(" ")}
    >
      {tile ? (
        <>
          <TileVisual tile={tile} height={44} isMobile={isMobile} onToggleHit={onToggleHit} onCycleAccent={onCycleAccent} />
          {!isMobile && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onPickUp();
              }}
              title={picked ? "Cancel move" : "Pick up to move (click another block to drop it)"}
              className={[
                "absolute -left-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full border bg-slate-800 transition",
                picked
                  ? "border-yellow-400 text-yellow-400"
                  : "border-white/20 text-white/60 hover:border-yellow-400 hover:text-yellow-400",
              ].join(" ")}
            >
              <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="currentColor">
                <circle cx="8" cy="6" r="1.6" />
                <circle cx="16" cy="6" r="1.6" />
                <circle cx="8" cy="12" r="1.6" />
                <circle cx="16" cy="12" r="1.6" />
                <circle cx="8" cy="18" r="1.6" />
                <circle cx="16" cy="18" r="1.6" />
              </svg>
            </button>
          )}
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            title="Clear this block"
            className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full border border-white/20 bg-slate-800 text-[9px] leading-none text-white/60 transition hover:border-red-400 hover:text-red-400"
          >
            ×
          </button>
        </>
      ) : (
        <span className={isMobile ? "text-2xl text-white/50" : "text-2xl text-white/20"}>+</span>
      )}
    </div>
  );
}
