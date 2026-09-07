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
  isMobile,
  movingBlock,
  onInstrumentChange,
  onClearBlock,
  onBlockTap,
  onToggleHit,
  onCycleAccent,
  onRemoveLine,
  onPickUp,
  canRemove,
}: {
  lineId: string;
  instrument: InstrumentId;
  blocks: (RhythmTile | null)[];
  measureLength: number;
  playheadBeat: number | null;
  isMobile: boolean;
  movingBlock: { lineId: string; index: number } | null;
  onInstrumentChange: (id: InstrumentId) => void;
  onClearBlock: (index: number) => void;
  onBlockTap: (index: number) => void;
  onToggleHit: (index: number, hitIndex: number) => void;
  onCycleAccent: (index: number, hitIndex: number) => void;
  onRemoveLine: () => void;
  onPickUp: (index: number) => void;
  canRemove: boolean;
}) {
  const def = getInstrument(instrument);

  const beatCount = blocks.length;
  // Each beat is a grid cell that shrinks to fit (down from a 4rem / 64px
  // cap) so 8 blocks stay on one row at any width instead of scrolling. The
  // cell after beat 4 carries the "end of bar 1" hairline once the grid runs
  // past a single 4/4 bar.
  const blockButtons = blocks.map((tile, i) => (
    <div
      key={`c${i}`}
      className={
        i === 3 && beatCount > 4
          ? "min-w-0 border-r-2 border-white/25"
          : "min-w-0"
      }
    >
      <Block
        id={`${lineId}:${i}`}
        tile={tile}
        active={i < measureLength}
        playing={playheadBeat === i}
        isMobile={isMobile}
        picked={movingBlock?.lineId === lineId && movingBlock?.index === i}
        movePending={movingBlock !== null}
        onClear={() => onClearBlock(i)}
        onTap={() => onBlockTap(i)}
        onToggleHit={(hitIndex) => onToggleHit(i, hitIndex)}
        onCycleAccent={(hitIndex) => onCycleAccent(i, hitIndex)}
        onPickUp={() => onPickUp(i)}
      />
    </div>
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
        {isMobile && (
          <button
            type="button"
            onClick={onRemoveLine}
            disabled={!canRemove}
            title="Remove this RockBlocks line"
            className="shrink-0 rounded-md border border-white/10 px-2 py-1 text-xs text-white/60 transition hover:border-red-400 hover:text-red-400 disabled:opacity-20"
          >
            Remove
          </button>
        )}
      </div>

      <div
        className="grid min-w-0 flex-1 gap-1.5"
        style={{ gridTemplateColumns: `repeat(${beatCount}, minmax(0, 4rem))` }}
      >
        {blockButtons}
      </div>

      {!isMobile && (
        <button
          type="button"
          onClick={onRemoveLine}
          disabled={!canRemove}
          title="Remove this RockBlocks line"
          className="ml-auto shrink-0 rounded-md border border-white/10 px-2 py-1 text-xs text-white/60 transition hover:border-red-400 hover:text-red-400 disabled:opacity-20"
        >
          Remove
        </button>
      )}
    </div>
  );
}
