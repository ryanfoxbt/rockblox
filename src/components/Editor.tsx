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
import { TileVisual } from "@/components/TileVisual";
import { RhythmTile } from "@/lib/rhythm";
import { InstrumentId } from "@/lib/instruments";
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

  async function handleDownload() {
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
    a.download = "rockblox-beat.mp3";
    a.click();
    URL.revokeObjectURL(url);
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
            Rock<span className="text-yellow-400">Blox</span>
          </h1>
          <p className="text-sm text-white/50">
            Drag rhythmic values into up to {MAX_BEATS} beat blocks per line to build a drum groove.
          </p>
        </div>
        <SaveShare bpm={bpm} lines={lines} initialSlug={initialSlug} />
      </header>

      <DndContext
        id="rockblox-dnd"
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <main className="flex flex-1 flex-col gap-4 p-4 md:flex-row md:gap-6 md:p-6">
          <aside className="w-full shrink-0 rounded-xl bg-white/5 p-4 md:h-[calc(100vh-8rem)] md:w-72">
            <TilePalette />
          </aside>

          <section className="flex flex-1 flex-col gap-4">
            <Transport
              bpm={bpm}
              onBpmChange={setBpm}
              isPlaying={isPlaying}
              onTogglePlay={togglePlay}
              disabled={measureLength < 1}
              measureLength={measureLength}
              onDownload={handleDownload}
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
                  onInstrumentChange={(inst) => changeInstrument(line.id, inst)}
                  onClearBlock={(i) => clearBlock(line.id, i)}
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
    </div>
  );
}
