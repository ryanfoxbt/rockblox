"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import { SlotLetter } from "@/lib/board";

export function StackStepChip({
  index,
  slot,
  label,
  isMobile,
  picked,
  movePending,
  playing,
  onTap,
  onPickUp,
  onRemove,
}: {
  index: number;
  slot: SlotLetter;
  label: string;
  isMobile: boolean;
  picked: boolean;
  movePending: boolean;
  playing: boolean;
  onTap: () => void;
  onPickUp: () => void;
  onRemove: () => void;
}) {
  const { isOver, setNodeRef: setDropRef } = useDroppable({ id: `step:${index}` });
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({
    id: `step-drag:${index}`,
    data: { slot, source: index },
    disabled: isMobile,
  });

  function setRefs(node: HTMLDivElement | null) {
    setDropRef(node);
    setDragRef(node);
  }

  return (
    <div
      ref={setRefs}
      {...(isMobile ? {} : listeners)}
      {...(isMobile ? {} : attributes)}
      onClick={onTap}
      title={
        isMobile
          ? "Tap a gap to move it here — tap ✕ to remove"
          : "Drag to reorder, click to drop an armed/picked-up beat here, or click ✕ to remove"
      }
      className={[
        "relative flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border-2 transition",
        isMobile ? "cursor-pointer" : "cursor-grab active:cursor-grabbing",
        picked
          ? "!border-yellow-400 bg-yellow-400/15 ring-2 ring-yellow-400/70 ring-offset-2 ring-offset-slate-900"
          : "border-white/20 bg-white/5",
        isOver ? "!border-yellow-400 bg-yellow-400/10" : "",
        playing ? "ring-2 ring-yellow-400 ring-offset-2 ring-offset-slate-900" : "",
        isDragging ? "opacity-30" : "",
        !isMobile && movePending && !picked ? "!border-yellow-400/50" : "",
      ].join(" ")}
    >
      <span className="text-lg font-black text-yellow-400">{slot}</span>
      <span className="absolute -bottom-4 text-[9px] text-white/40">{label}</span>
      {!isMobile && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onPickUp();
          }}
          title={picked ? "Cancel move" : "Pick up to move"}
          className={[
            "absolute -left-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full border bg-slate-800 transition",
            picked ? "border-yellow-400 text-yellow-400" : "border-white/20 text-white/60 hover:border-yellow-400 hover:text-yellow-400",
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
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        title="Remove"
        className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full border border-white/20 bg-slate-800 text-[9px] leading-none text-white/60 transition hover:border-red-400 hover:text-red-400"
      >
        ×
      </button>
    </div>
  );
}
