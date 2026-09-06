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
  const blockButtons = blocks.flatMap((tile, i) => {
    const block = (
      <Block
        key={`b${i}`}
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
    );
    // Hairline after beat 4 once the grid runs past a single 4/4 bar, so the
    // starter measure keeps its shape. Desktop only — the wrapping mobile
    // grid already breaks the row there.
    if (i === 3 && beatCount > 4 && !isMobile) {
      return [
        block,
        <span
          key="bar-div"
          aria-hidden
          className="mx-2.5 h-16 w-0.5 shrink-0 self-center rounded bg-white/30"
        />,
      ];
    }
    return [block];
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
            title="Remove this RockBlocks line"
            className="shrink-0 rounded-md border border-white/10 px-2 py-1 text-xs text-white/60 transition hover:border-red-400 hover:text-red-400 disabled:opacity-20"
          >
            Remove
          </button>
        )}
      </div>

      <div
        className={[
          "grid gap-2 md:flex md:flex-1 md:flex-nowrap md:gap-2 md:overflow-x-auto",
          beatCount <= 3 ? "grid-cols-3" : "grid-cols-4",
        ].join(" ")}
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
