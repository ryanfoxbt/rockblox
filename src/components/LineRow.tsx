"use client";

import { INSTRUMENTS, InstrumentId, getInstrument } from "@/lib/instruments";
import { RhythmTile } from "@/lib/rhythm";
import { Block } from "./Block";

export function LineRow({
  lineId,
  instrument,
  blocks,
  measureLength,
  playheadBeat,
  onInstrumentChange,
  onClearBlock,
  onRemoveLine,
  canRemove,
}: {
  lineId: string;
  instrument: InstrumentId;
  blocks: (RhythmTile | null)[];
  measureLength: number;
  playheadBeat: number | null;
  onInstrumentChange: (id: InstrumentId) => void;
  onClearBlock: (index: number) => void;
  onRemoveLine: () => void;
  canRemove: boolean;
}) {
  const def = getInstrument(instrument);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl bg-white/5 p-3">
      <span className={`h-3 w-3 shrink-0 rounded-full ${def.color}`} aria-hidden />
      <select
        value={instrument}
        onChange={(e) => onInstrumentChange(e.target.value as InstrumentId)}
        className="shrink-0 rounded-md border border-white/10 bg-slate-800 px-2 py-1.5 text-sm text-white"
      >
        {INSTRUMENTS.map((i) => (
          <option key={i.id} value={i.id}>
            {i.name}
          </option>
        ))}
      </select>
      <div className="flex gap-2 overflow-x-auto">
        {blocks.map((tile, i) => (
          <Block
            key={i}
            id={`${lineId}:${i}`}
            tile={tile}
            active={i < measureLength}
            playing={playheadBeat === i}
            onClear={() => onClearBlock(i)}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={onRemoveLine}
        disabled={!canRemove}
        title="Remove this RockBlox line"
        className="ml-auto shrink-0 rounded-md border border-white/10 px-2 py-1 text-xs text-white/60 transition hover:border-red-400 hover:text-red-400 disabled:opacity-20"
      >
        Remove
      </button>
    </div>
  );
}
