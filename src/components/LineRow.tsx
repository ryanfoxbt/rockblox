"use client";

import { INSTRUMENTS, InstrumentId, getInstrument } from "@/lib/instruments";
import { RhythmTile } from "@/lib/rhythm";
import { Block } from "./Block";
import { VolumeKnob } from "./VolumeKnob";

export function LineRow({
  lineId,
  instrument,
  blocks,
  volume,
  measureLength,
  playheadBeat,
  isMobile,
  onInstrumentChange,
  onVolumeChange,
  onClearBlock,
  onBlockTap,
  onToggleHit,
  onRemoveLine,
  canRemove,
}: {
  lineId: string;
  instrument: InstrumentId;
  blocks: (RhythmTile | null)[];
  volume: number;
  measureLength: number;
  playheadBeat: number | null;
  isMobile: boolean;
  onInstrumentChange: (id: InstrumentId) => void;
  onVolumeChange: (volume: number) => void;
  onClearBlock: (index: number) => void;
  onBlockTap: (index: number) => void;
  onToggleHit: (index: number, hitIndex: number) => void;
  onRemoveLine: () => void;
  canRemove: boolean;
}) {
  const def = getInstrument(instrument);

  const blockButtons = blocks.map((tile, i) => (
    <Block
      key={i}
      id={`${lineId}:${i}`}
      tile={tile}
      active={i < measureLength}
      playing={playheadBeat === i}
      isMobile={isMobile}
      onClear={() => onClearBlock(i)}
      onTap={() => onBlockTap(i)}
      onToggleHit={(hitIndex) => onToggleHit(i, hitIndex)}
    />
  ));

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
        <VolumeKnob value={volume} onChange={onVolumeChange} />
        <button
          type="button"
          onClick={onRemoveLine}
          disabled={!canRemove}
          title="Remove this RockBlocks line"
          className="shrink-0 rounded-md border border-white/10 px-2 py-1 text-xs text-white/60 transition hover:border-red-400 hover:text-red-400 disabled:opacity-20 md:hidden"
        >
          Remove
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2 sm:grid-cols-7 md:flex md:flex-1 md:flex-nowrap md:gap-2 md:overflow-x-auto">
        {blockButtons}
      </div>

      <button
        type="button"
        onClick={onRemoveLine}
        disabled={!canRemove}
        title="Remove this RockBlocks line"
        className="hidden shrink-0 rounded-md border border-white/10 px-2 py-1 text-xs text-white/60 transition hover:border-red-400 hover:text-red-400 disabled:opacity-20 md:ml-auto md:block"
      >
        Remove
      </button>
    </div>
  );
}
