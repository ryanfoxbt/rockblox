"use client";

import { useDraggable } from "@dnd-kit/core";
import { SlotLetter } from "@/lib/board";

export function StackPaletteBlock({
  slot,
  summary,
  disabled,
  isMobile,
  isArmed,
  onArm,
}: {
  slot: SlotLetter;
  summary: string;
  disabled: boolean;
  isMobile: boolean;
  isArmed: boolean;
  onArm: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${slot}`,
    data: { slot },
    disabled: isMobile || disabled,
  });

  return (
    <button
      ref={setNodeRef}
      {...(isMobile || disabled ? {} : listeners)}
      {...(isMobile || disabled ? {} : attributes)}
      type="button"
      disabled={disabled}
      onClick={disabled ? undefined : onArm}
      title={disabled ? `Beat ${slot} is empty — build it on your page first` : `Drag or tap to add Beat ${slot}`}
      className={[
        "flex w-20 shrink-0 flex-col items-center gap-1 rounded-lg border p-2 text-center transition",
        disabled
          ? "cursor-not-allowed border-white/5 bg-white/[0.02] opacity-40"
          : isArmed
            ? "border-yellow-400 bg-yellow-400/10"
            : "border-white/10 bg-white/5 hover:border-white/30 hover:bg-white/10",
        !disabled && !isMobile ? "cursor-grab active:cursor-grabbing" : "",
        isDragging ? "opacity-30" : "",
      ].join(" ")}
    >
      <span className="text-xl font-black text-yellow-400">{slot}</span>
      <span className="w-full truncate text-[10px] leading-tight text-white/50">{summary}</span>
    </button>
  );
}
