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
  serializeLines,
} from "@/lib/song";
import { LineState, RockBloxPlayer, renderSongToBuffer } from "@/lib/audioEngine";
import { DEFAULT_KIT, DRUM_KITS } from "@/lib/drumKits";
import { useHistoryState } from "@/lib/useHistoryState";
import { BoardData, BoardSlotData, SLOT_LETTERS, SlotLetter } from "@/lib/board";
import { ClaimUrlBox } from "@/components/ClaimUrlBox";

export function Editor({
  initialBpm,
  initialLines,
  initialKit,
  initialSlug,
  board,
}: {
  initialBpm?: number;
  initialLines?: StoredLine[];
  initialKit?: string;
  initialSlug?: string;
  board?: BoardData;
}) {
  const [activeSlot, setActiveSlot] = useState<SlotLetter>(
    () => (board && SLOT_LETTERS.find((l) => board.slots[l])) || "A"
  );
  // Tracks the last payload known to be persisted for this slot, so the
  // autosave effect only fires on real edits — not on mount, not when
  // switching slots to data that's already saved, and not on React Strict
  // Mode's dev-only double-invoke of effects on mount.
  const lastSavedRef = useRef<string | null>(null);
  // Client-side copy of every slot's content, seeded from the server-fetched
  // `board` prop but kept current as the user edits — `board` itself is a
  // one-time snapshot from page load, so without this, switching to a slot
  // edited earlier in the same session (then switching away and back) would
  // show stale, pre-edit data instead of what's actually on screen.
  const slotsRef = useRef<Record<SlotLetter, BoardSlotData | null>>(
    board?.slots ?? { A: null, B: null, C: null, D: null }
  );
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const [lines, setLines, { undo, redo, reset: resetLines, canUndo, canRedo }] = useHistoryState<LineData[]>(() => {
    if (board) {
      const data = board.slots[activeSlot];
      return data && data.lines.length > 0 ? deserializeLines(data.lines) : [createLine(0)];
    }
    return initialLines && initialLines.length > 0 ? deserializeLines(initialLines) : [createLine(0)];
  });
  const [bpm, setBpm] = useState(() => {
    if (board) return board.slots[activeSlot]?.bpm ?? 100;
    return initialBpm ?? 100;
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [playheadBeat, setPlayheadBeat] = useState<number | null>(null);
  const [activeTile, setActiveTile] = useState<RhythmTile | null>(null);
  const [showSheet, setShowSheet] = useState(false);
  const [armedTile, setArmedTile] = useState<RhythmTile | null>(null);
  const [movingFrom, setMovingFrom] = useState<{ lineId: string; index: number; tile: RhythmTile } | null>(null);
  const [kit, setKit] = useState<string>(() => {
    if (board) return board.slots[activeSlot]?.kit ?? DEFAULT_KIT;
    return initialKit ?? DEFAULT_KIT;
  });
  const [samplesLoading, setSamplesLoading] = useState(true);

  const isMobile = useIsMobile();
  const playerRef = useRef<RockBloxPlayer | null>(null);
  const rafRef = useRef<number | null>(null);

  const measureLength = computeMeasureLength(lines);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  useEffect(() => {
    if (!playerRef.current) return;
    const lineStates: LineState[] = lines.map((l) => ({ instrument: l.instrument, blocks: l.blocks, volume: l.volume }));
    playerRef.current.updateSong(lineStates, bpm, measureLength);
  }, [lines, bpm, measureLength]);

  // Start fetching and decoding the drum samples as soon as the page mounts,
  // so they're already in memory by the time the user hits Play.
  useEffect(() => {
    if (!playerRef.current) playerRef.current = new RockBloxPlayer(kit);
    playerRef.current.ready.then(() => setSamplesLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyKit(newKit: string) {
    setKit(newKit);
    setSamplesLoading(true);
    if (!playerRef.current) playerRef.current = new RockBloxPlayer(newKit);
    playerRef.current.setKit(newKit).then(() => setSamplesLoading(false));
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName)) return;
      if (e.key === "Escape" && (movingFrom || armedTile)) {
        setMovingFrom(null);
        setArmedTile(null);
        return;
      }
      const mod = e.ctrlKey || e.metaKey;
      if (!mod || e.key.toLowerCase() !== "z") return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo, movingFrom, armedTile]);

  function switchSlot(slot: SlotLetter) {
    if (!board || slot === activeSlot) return;
    // Snapshot the outgoing slot's current state into our client-side copy
    // before leaving it, so switching back later reflects this session's
    // edits rather than the stale data the server sent on page load.
    slotsRef.current[activeSlot] = { bpm, lines: serializeLines(lines), kit };

    const data = slotsRef.current[slot];
    const nextLines = data && data.lines.length > 0 ? deserializeLines(data.lines) : [createLine(0)];
    const nextBpm = data?.bpm ?? 100;
    const nextKit = data?.kit ?? DEFAULT_KIT;
    // Loading a slot's already-persisted data isn't an edit — set the
    // baseline now so the autosave effect below doesn't immediately re-save it.
    lastSavedRef.current = JSON.stringify({ slot, bpm: nextBpm, lines: serializeLines(nextLines), kit: nextKit });
    setActiveSlot(slot);
    setArmedTile(null);
    setMovingFrom(null);
    resetLines(nextLines);
    setBpm(nextBpm);
    if (nextKit !== kit) applyKit(nextKit);
  }

  // Autosave the active slot to this board's page whenever the pattern
  // changes, so a personalized URL always reflects what's on screen without
  // needing an explicit save action.
  useEffect(() => {
    if (!board) return;
    const payload = JSON.stringify({ slot: activeSlot, bpm, lines: serializeLines(lines), kit });
    if (lastSavedRef.current === null) {
      lastSavedRef.current = payload;
      return;
    }
    if (lastSavedRef.current === payload) return;

    setSaveStatus("saving");
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`/api/boards/${board.slug}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: payload,
        });
        if (res.ok) lastSavedRef.current = payload;
        setSaveStatus(res.ok ? "saved" : "error");
      } catch {
        setSaveStatus("error");
      }
    }, 800);
    return () => clearTimeout(handle);
  }, [lines, bpm, kit, activeSlot, board]);

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
    if (!playerRef.current) playerRef.current = new RockBloxPlayer(kit);
    const lineStates: LineState[] = lines.map((l) => ({ instrument: l.instrument, blocks: l.blocks, volume: l.volume }));
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
    const lineStates: LineState[] = lines.map((l) => ({ instrument: l.instrument, blocks: l.blocks, volume: l.volume }));
    const loopSeconds = (60 / bpm) * measureLength;
    const loops = Math.max(4, Math.ceil(12 / loopSeconds));

    const buffer = await renderSongToBuffer(lineStates, bpm, measureLength, loops, kit);
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
    const lineStates: LineState[] = lines.map((l) => ({ instrument: l.instrument, blocks: l.blocks, volume: l.volume }));
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
    setMovingFrom(null);
    setArmedTile((prev) => (prev?.id === tile.id ? null : tile));
  }

  function handlePickUp(lineId: string, index: number, tile: RhythmTile) {
    setArmedTile(null);
    setMovingFrom((prev) =>
      prev && prev.lineId === lineId && prev.index === index ? null : { lineId, index, tile }
    );
  }

  function handleBlockTap(lineId: string, index: number) {
    if (movingFrom) {
      if (movingFrom.lineId === lineId && movingFrom.index === index) {
        setMovingFrom(null);
        return;
      }
      placeTile(movingFrom.tile, lineId, index, `${movingFrom.lineId}:${movingFrom.index}`);
      setMovingFrom(null);
      return;
    }
    if (armedTile) placeTile(armedTile, lineId, index);
  }

  function handleToggleHit(lineId: string, index: number, hitIndex: number) {
    if (movingFrom) {
      if (movingFrom.lineId === lineId && movingFrom.index === index) {
        setMovingFrom(null);
        return;
      }
      placeTile(movingFrom.tile, lineId, index, `${movingFrom.lineId}:${movingFrom.index}`);
      setMovingFrom(null);
      return;
    }
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
              : `Drag rhythmic values into up to ${MAX_BEATS} beat blocks per line to build a drum groove, or click a tile then click a block to place it — handy on a trackpad. Click a hit to rest it, or click a block's grip handle to pick it up and move it elsewhere.`}
          </p>
          {board ? (
            <p className="mt-1 text-xs text-white/40">
              Your page: <span className="font-mono text-yellow-400">/{board.displayName}</span>
            </p>
          ) : (
            <div className="mt-2">
              <ClaimUrlBox bpm={bpm} lines={lines} kit={kit} />
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {board && (
            <div className="flex items-center gap-2">
              <div className="flex overflow-hidden rounded-md border border-white/15">
                {SLOT_LETTERS.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => switchSlot(slot)}
                    title={`Beat ${slot}`}
                    className={[
                      "flex h-9 w-9 items-center justify-center text-sm font-semibold transition",
                      slot === activeSlot
                        ? "bg-yellow-400 text-slate-900"
                        : "bg-white/5 text-white/60 hover:bg-white/10",
                    ].join(" ")}
                  >
                    {slot}
                  </button>
                ))}
              </div>
              <span className="w-12 shrink-0 text-xs text-white/40">
                {saveStatus === "saving"
                  ? "Saving…"
                  : saveStatus === "error"
                    ? "Error"
                    : saveStatus === "saved"
                      ? "Saved"
                      : ""}
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={undo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/15 bg-white/5 text-white/70 transition hover:border-yellow-400 hover:text-yellow-400 disabled:opacity-30"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path d="M9 8 4 12l5 4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 12h11a5 5 0 0 1 0 10h-1" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={!canRedo}
            title="Redo (Ctrl+Shift+Z)"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/15 bg-white/5 text-white/70 transition hover:border-yellow-400 hover:text-yellow-400 disabled:opacity-30"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path d="m15 8 5 4-5 4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M20 12H9a5 5 0 0 0 0 10h1" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
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
          <SaveShare
            bpm={bpm}
            lines={lines}
            kit={kit}
            initialSlug={initialSlug}
            boardPath={board ? `/${board.displayName}` : undefined}
          />
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
              samplesLoading={samplesLoading}
              kit={kit}
              kits={DRUM_KITS}
              onKitChange={applyKit}
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
                  movingBlock={movingFrom}
                  onInstrumentChange={(inst) => changeInstrument(line.id, inst)}
                  onClearBlock={(i) => clearBlock(line.id, i)}
                  onBlockTap={(i) => handleBlockTap(line.id, i)}
                  onToggleHit={(i, hitIndex) => handleToggleHit(line.id, i, hitIndex)}
                  onRemoveLine={() => removeLine(line.id)}
                  onPickUp={(i) => {
                    const t = line.blocks[i];
                    if (t) handlePickUp(line.id, i, t);
                  }}
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
