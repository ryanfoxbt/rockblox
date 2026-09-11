"use client";

import { useRef } from "react";
import { INSTRUMENTS, InstrumentId, getInstrument } from "@/lib/instruments";
import { RhythmTile } from "@/lib/rhythm";
import { STEPS_PER_BEAT, StepCell, tileToSteps } from "@/lib/stepGrid";

// Mirrors TileVisual's mobile long-press timing — same gesture (tap toggles,
// long-press cycles accent/ghost) reused here so the two views feel like one
// app, not two.
const LONG_PRESS_MS = 450;

function Step({
  cell,
  colorClass,
  isMobile,
  playing,
  onToggle,
  onCycleAccent,
}: {
  cell: StepCell | null; // null = this beat holds a triplet tile, locked in this view
  colorClass: string;
  isMobile: boolean;
  playing: boolean;
  onToggle: () => void;
  onCycleAccent: () => void;
}) {
  const longPressTimer = useRef<number | null>(null);
  const longPressFired = useRef(false);

  function clearLongPress() {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  if (!cell) {
    return (
      <div
        title="This beat has a triplet pattern — switch to RockBlocks view to edit it"
        className="aspect-square w-full min-w-0 cursor-not-allowed rounded-sm border border-dashed border-white/10 bg-white/[0.02]"
      />
    );
  }

  const mark = cell.on && cell.accent === "accent" ? ">" : cell.on && cell.accent === "ghost" ? "( )" : null;

  return (
    <button
      type="button"
      onPointerDown={() => {
        longPressFired.current = false;
        if (!isMobile || !cell.on) return;
        longPressTimer.current = window.setTimeout(() => {
          longPressFired.current = true;
          onCycleAccent();
        }, LONG_PRESS_MS);
      }}
      onPointerUp={clearLongPress}
      onPointerLeave={clearLongPress}
      onPointerCancel={clearLongPress}
      onClick={(e) => {
        if (isMobile) {
          if (longPressFired.current) {
            longPressFired.current = false;
            return;
          }
          onToggle();
          return;
        }
        if ((e.ctrlKey || e.metaKey || e.altKey) && cell.on) {
          onCycleAccent();
          return;
        }
        onToggle();
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        if (cell.on) onCycleAccent();
      }}
      title={
        cell.on
          ? `${isMobile ? "Tap" : "Click"} to clear this hit — ${
              isMobile ? "long-press" : "right-click, or Ctrl/Option-click,"
            } to cycle accent/ghost/normal${cell.accent ? ` (currently ${cell.accent})` : ""}`
          : "Click to add a hit here"
      }
      className={[
        "relative block aspect-square w-full min-w-0 rounded-sm border transition",
        cell.on
          ? `${colorClass} border-transparent ${cell.accent === "ghost" ? "opacity-40" : ""} hover:brightness-90`
          : "border-white/10 bg-white/5 hover:bg-white/10",
        playing ? "ring-2 ring-yellow-400 ring-offset-1 ring-offset-slate-900" : "",
      ].join(" ")}
    >
      {mark && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center text-[9px] font-black leading-none text-slate-900"
        >
          {mark}
        </span>
      )}
    </button>
  );
}

export function ClassicLineRow({
  instrument,
  blocks,
  measureLength,
  playheadStep,
  isMobile,
  onInstrumentChange,
  onToggleStep,
  onCycleStepAccent,
  onRemoveLine,
  canRemove,
}: {
  instrument: InstrumentId;
  blocks: (RhythmTile | null)[];
  measureLength: number;
  playheadStep: number | null;
  isMobile: boolean;
  onInstrumentChange: (id: InstrumentId) => void;
  onToggleStep: (beatIndex: number, stepIndex: number) => void;
  onCycleStepAccent: (beatIndex: number, stepIndex: number) => void;
  onRemoveLine: () => void;
  canRemove: boolean;
}) {
  const def = getInstrument(instrument);
  const beatCount = blocks.length;
  const totalSteps = beatCount * STEPS_PER_BEAT;

  const cells = blocks.flatMap((tile, beatIndex) => {
    const steps = tileToSteps(tile);
    const active = beatIndex < measureLength;
    return Array.from({ length: STEPS_PER_BEAT }, (_, stepIndex) => {
      const globalStep = beatIndex * STEPS_PER_BEAT + stepIndex;
      return (
        <div
          key={globalStep}
          className={[
            "min-w-0",
            globalStep > 0 && globalStep % 16 === 0
              ? "border-l-2 border-white/25 pl-1"
              : stepIndex === 0
                ? "border-l border-white/10 pl-0.5"
                : "",
            !active ? "opacity-30" : "",
          ].join(" ")}
        >
          <Step
            cell={steps ? steps[stepIndex] : null}
            colorClass={def.color}
            isMobile={isMobile}
            playing={playheadStep === globalStep}
            onToggle={() => onToggleStep(beatIndex, stepIndex)}
            onCycleAccent={() => onCycleStepAccent(beatIndex, stepIndex)}
          />
        </div>
      );
    });
  });

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-white/5 p-3 md:flex-row md:flex-wrap md:items-center">
      <div className="flex items-center gap-3">
        <span className={`h-3 w-3 shrink-0 rounded-full ${def.color}`} aria-hidden />
        <select
          value={instrument}
          onChange={(e) => onInstrumentChange(e.target.value as InstrumentId)}
          className="flex-1 rounded-md border border-white/10 bg-slate-800 px-2 py-1.5 text-sm text-white md:flex-none"
        >
          {INSTRUMENTS.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
        {isMobile && (
          <button
            type="button"
            onClick={onRemoveLine}
            disabled={!canRemove}
            title="Remove this line"
            className="shrink-0 rounded-md border border-white/10 px-2 py-1 text-xs text-white/60 transition hover:border-red-400 hover:text-red-400 disabled:opacity-20"
          >
            Remove
          </button>
        )}
      </div>

      <div
        className="grid min-w-0 flex-1 gap-1"
        style={{ gridTemplateColumns: `repeat(${totalSteps}, minmax(0, 1.75rem))` }}
      >
        {cells}
      </div>

      {!isMobile && (
        <button
          type="button"
          onClick={onRemoveLine}
          disabled={!canRemove}
          title="Remove this line"
          className="ml-auto shrink-0 rounded-md border border-white/10 px-2 py-1 text-xs text-white/60 transition hover:border-red-400 hover:text-red-400 disabled:opacity-20"
        >
          Remove
        </button>
      )}
    </div>
  );
}
