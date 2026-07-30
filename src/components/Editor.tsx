"use client";

import { useEffect, useRef, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { TilePalette } from "@/components/TilePalette";
import { LineRow } from "@/components/LineRow";
import { Transport } from "@/components/Transport";
import { SaveShare } from "@/components/SaveShare";
import { SheetMusicView } from "@/components/SheetMusicView";
import { TileVisual } from "@/components/TileVisual";
import { RhythmTile, toggleHitRest } from "@/lib/rhythm";
import { InstrumentId } from "@/lib/instruments";
import { useIsMobile } from "@/lib/useIsMobile";
import {
  LineData,
  MAX_BEATS,
  StoredLine,
  computeMeasureLength,
  createLine,
  deserializeLines,
} from "@/lib/song";
import { LineState, RockBloxPlayer, renderSongToBuffer } from "@/lib/audioEngine";

export function Editor({
  initialBpm,
  initialLines,
  initialSlug,
}: {
  initialBpm?: number;
  initialLines?: StoredLine[];
  initialSlug?: string;
}) {
  const [lines, setLines] = useState<LineData[]>(() =>
    initialLines && initialLines.length > 0 ? deserializeLines(initialLines) : [createLine(0)]
  );
  const [bpm, setBpm] = useState(initialBpm ?? 100);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playheadBeat, setPlayheadBeat] = useState<number | null>(null);
  const [activeTile, setActiveTile] = useState<RhythmTile | null>(null);
  const [showSheet, setShowSheet] = useState(false);
  const [armedTile, setArmedTile] = useState<RhythmTile | null>(null);

  const isMobile = useIsMobile();
  const playerRef = useRef<RockBloxPlayer | null>(null);
  const rafRef = useRef<number | null>(null);

  const measureLength = computeMeasureLength(lines);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  useEffect(() => {
    if (!playerRef.current) return;
    const lineStates: LineState[] = lines.map((l) => ({ instrument: l.instrument, blocks: l.blocks }));
    playerRef.current.updateSong(lineStates, bpm, measureLength);
  }, [lines, bpm, measureLength]);

  useEffect(() => {
    if (!isPlaying) return;
    const tick = () => {
      const info = playerRef.current?.getPlayheadInfo();
      setPlayheadBeat(info ? info.beat : null);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying]);

  async function togglePlay() {
    if (!playerRef.current) playerRef.current = new RockBloxPlayer();
    const lineStates: LineState[] = lines.map((l) => ({ instrument: l.instrument, blocks: l.blocks }));
    playerRef.current.updateSong(lineStates, bpm, measureLength);

    if (playerRef.current.isPlaying()) {
      playerRef.current.stop();
      setIsPlaying(false);
    } else {
      await playerRef.current.play();
      setIsPlaying(true);
    }
  }

  async function handleDownloadMp3() {
    if (measureLength < 1) return;
    const lineStates: LineState[] = lines.map((l) => ({ instrument: l.instrument, blocks: l.blocks }));
    const loopSeconds = (60 / bpm) * measureLength;
    const loops = Math.max(4, Math.ceil(12 / loopSeconds));

    const buffer = await renderSongToBuffer(lineStates, bpm, measureLength, loops);
    const { encodeAudioBufferToMp3 } = await import("@/lib/mp3Encoder");
    const blob = encodeAudioBufferToMp3(buffer);

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "rockblocks-beat.mp3";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleDownloadMidi() {
    if (measureLength < 1) return;
    const lineStates: LineState[] = lines.map((l) => ({ instrument: l.instrument, blocks: l.blocks }));
    const { encodeSongToMidi } = await import("@/lib/midiEncoder");
    const blob = encodeSongToMidi(lineStates, bpm, measureLength);

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "rockblocks-beat.mid";
    a.click();
    URL.revokeObjectURL(url);
  }

  function placeTile(tile: RhythmTile, lineId: string, index: number, source?: string) {
    if (source === `${lineId}:${index}`) return;

    setLines((prev) => {
      let next = prev;
      if (source) {
        const [srcLineId, srcIndexStr] = source.split(":");
        const srcIndex = Number(srcIndexStr);
        next = next.map((line) =>
          line.id === srcLineId
            ? { ...line, blocks: line.blocks.map((b, i) => (i === srcIndex ? null : b)) }
            : line
        );
      }
      return next.map((line) =>
        line.id === lineId
          ? { ...line, blocks: line.blocks.map((b, i) => (i === index ? tile : b)) }
          : line
      );
    });
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveTile((event.active.data.current?.tile as RhythmTile) ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveTile(null);
    const { active, over } = event;
    if (!over) return;
    const tile = active.data.current?.tile as RhythmTile | undefined;
    if (!tile) return;
    const source = active.data.current?.source as string | undefined;
    const [lineId, indexStr] = String(over.id).split(":");
    const index = Number(indexStr);
    placeTile(tile, lineId, index, source);
  }

  function handleArmTile(tile: RhythmTile) {
    setArmedTile((prev) => (prev?.id === tile.id ? null : tile));
  }

  function handleBlockTap(lineId: string, index: number) {
    if (armedTile) placeTile(armedTile, lineId, index);
  }

  function handleToggleHit(lineId: string, index: number, hitIndex: number) {
    if (armedTile) {
      placeTile(armedTile, lineId, index);
      return;
    }
    setLines((prev) =>
      prev.map((line) =>
        line.id === lineId
          ? {
              ...line,
              blocks: line.blocks.map((b, i) => (i === index && b ? toggleHitRest(b, hitIndex) : b)),
            }
          : line
      )
    );
  }

  function addLine() {
    setLines((prev) => [...prev, createLine(prev.length)]);
  }

  function removeLine(id: string) {
    setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.id !== id) : prev));
  }

  function changeInstrument(id: string, instrument: InstrumentId) {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, instrument } : l)));
  }

  function clearBlock(id: string, index: number) {
    setLines((prev) =>
      prev.map((l) =>
        l.id === id ? { ...l, blocks: l.blocks.map((b, i) => (i === index ? null : b)) } : l
      )
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 px-6 py-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight">
            Rock<span className="text-yellow-400">Blocks</span>
          </h1>
          <p className="text-sm text-white/50">
            {isMobile
              ? `Tap a tile, then tap up to ${MAX_BEATS} beat blocks per line to build a drum groove. Tap a hit again to rest it.`
              : `Drag rhythmic values into up to ${MAX_BEATS} beat blocks per line to build a drum groove. Click a hit to rest it.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSheet(true)}
            disabled={measureLength < 1}
            title="View sheet music"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/15 bg-white/5 text-white/70 transition hover:border-yellow-400 hover:text-yellow-400 disabled:opacity-30"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <line x1="3" y1="7" x2="21" y2="7" />
              <line x1="3" y1="11" x2="21" y2="11" />
              <line x1="3" y1="15" x2="21" y2="15" />
              <circle cx="9" cy="17.5" r="2" fill="currentColor" stroke="none" />
              <line x1="11" y1="17.5" x2="11" y2="9" />
            </svg>
          </button>
          <SaveShare bpm={bpm} lines={lines} initialSlug={initialSlug} />
        </div>
      </header>

      {showSheet && (
        <SheetMusicView
          lines={lines}
          bpm={bpm}
          measureLength={measureLength}
          isPlaying={isPlaying}
          playheadBeat={isPlaying ? playheadBeat : null}
          onTogglePlay={togglePlay}
          onClose={() => setShowSheet(false)}
        />
      )}

      <DndContext
        id="rockblox-dnd"
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <main className="flex flex-1 flex-col gap-4 p-4 pb-24 md:flex-row md:gap-6 md:p-6">
          <aside className="max-h-[45vh] w-full shrink-0 overflow-hidden rounded-xl bg-white/5 p-4 md:h-[calc(100vh-8rem)] md:max-h-none md:w-72">
            <TilePalette isMobile={isMobile} armedTile={armedTile} onArmTile={handleArmTile} />
          </aside>

          <section className="flex flex-1 flex-col gap-4">
            <Transport
              bpm={bpm}
              onBpmChange={setBpm}
              isPlaying={isPlaying}
              onTogglePlay={togglePlay}
              disabled={measureLength < 1}
              measureLength={measureLength}
              onDownloadMp3={handleDownloadMp3}
              onDownloadMidi={handleDownloadMidi}
            />

            <div className="flex flex-col gap-3">
              {lines.map((line) => (
                <LineRow
                  key={line.id}
                  lineId={line.id}
                  instrument={line.instrument}
                  blocks={line.blocks}
                  measureLength={measureLength}
                  playheadBeat={isPlaying ? playheadBeat : null}
                  isMobile={isMobile}
                  onInstrumentChange={(inst) => changeInstrument(line.id, inst)}
                  onClearBlock={(i) => clearBlock(line.id, i)}
                  onBlockTap={(i) => handleBlockTap(line.id, i)}
                  onToggleHit={(i, hitIndex) => handleToggleHit(line.id, i, hitIndex)}
                  onRemoveLine={() => removeLine(line.id)}
                  canRemove={lines.length > 1}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={addLine}
              className="self-start rounded-md border border-dashed border-white/20 px-4 py-2 text-sm text-white/70 transition hover:border-yellow-400 hover:text-yellow-400"
            >
              + Add drum piece
            </button>
          </section>
        </main>

        <DragOverlay>
          {activeTile ? (
            <div className="w-24 rounded-md border border-yellow-400 bg-slate-800 p-1.5">
              <TileVisual tile={activeTile} height={28} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {isMobile && armedTile && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t border-white/10 bg-slate-900/95 px-4 py-3 backdrop-blur">
          <div className="flex min-w-0 items-center gap-2 text-sm">
            <span className="shrink-0 text-white/50">Placing:</span>
            <span className="truncate font-medium text-yellow-400">{armedTile.label}</span>
          </div>
          <button
            type="button"
            onClick={() => setArmedTile(null)}
            className="shrink-0 rounded-md border border-white/15 px-3 py-1.5 text-sm text-white/70"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
