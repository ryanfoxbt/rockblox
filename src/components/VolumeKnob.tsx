"use client";

import { useRef } from "react";

const MIN_ANGLE = -135;
const MAX_ANGLE = 135;
const STEP = 5;

export function VolumeKnob({
  value,
  onChange,
}: {
  value: number; // 0-100
  onChange: (value: number) => void;
}) {
  const dragRef = useRef<{ startY: number; startValue: number } | null>(null);

  function commit(next: number) {
    onChange(Math.round(Math.min(100, Math.max(0, next))));
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startY: e.clientY, startValue: value };
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    const deltaY = dragRef.current.startY - e.clientY;
    commit(dragRef.current.startValue + deltaY);
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.releasePointerCapture(e.pointerId);
    dragRef.current = null;
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowUp" || e.key === "ArrowRight") {
      e.preventDefault();
      commit(value + STEP);
    } else if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
      e.preventDefault();
      commit(value - STEP);
    } else if (e.key === "Home") {
      e.preventDefault();
      commit(0);
    } else if (e.key === "End") {
      e.preventDefault();
      commit(100);
    }
  }

  const angle = MIN_ANGLE + (value / 100) * (MAX_ANGLE - MIN_ANGLE);

  return (
    <div className="flex shrink-0 flex-col items-center gap-0.5" title={`Volume: ${value}%`}>
      <div
        role="slider"
        tabIndex={0}
        aria-label="Volume"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDoubleClick={() => commit(100)}
        onKeyDown={handleKeyDown}
        className="relative h-7 w-7 cursor-ns-resize touch-none rounded-full border border-white/20 bg-slate-800 transition hover:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400"
      >
        <div className="absolute inset-0" style={{ transform: `rotate(${angle}deg)` }}>
          <div className="absolute left-1/2 top-0.5 h-2 w-0.5 -translate-x-1/2 rounded-full bg-yellow-400" />
        </div>
      </div>
      <span className="text-[9px] leading-none text-white/40">{value}%</span>
    </div>
  );
}
