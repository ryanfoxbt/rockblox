"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BoardSlotData, ExtendedSlotLetter, SlotMap } from "@/lib/board";
import { computeMeasureLength, deserializeLines } from "@/lib/song";
import { getInstrument } from "@/lib/instruments";
import { DEFAULT_KIT } from "@/lib/drumKits";
import { LineState, RockBloxPlayer } from "@/lib/audioEngine";
import { TileVisual } from "@/components/TileVisual";
import { CopyBeatButton } from "@/components/CopyBeatButton";
import { SaveToLibraryButton } from "@/components/SaveToLibraryButton";

interface BoardResponse {
  slug: string;
  displayName: string;
  slots: Record<"A" | "B" | "C" | "D", BoardSlotData | null>;
}

function SlotRows({ data }: { data: BoardSlotData }) {
  const lines = deserializeLines(data.lines);
  const measureLength = computeMeasureLength(lines);
  return (
    <div className="flex flex-col gap-1">
      {lines.map((line) => (
        <div key={line.id} className="flex items-center gap-1">
          <span className="w-16 shrink-0 truncate text-[10px] text-white/40">
            {getInstrument(line.instrument).name}
          </span>
          <div className="flex gap-0.5">
            {line.blocks.slice(0, measureLength).map((tile, i) =>
              tile ? (
                <div key={i} className="w-8 shrink-0">
                  <TileVisual tile={tile} height={16} />
                </div>
              ) : (
                <div key={i} className="h-4 w-8 shrink-0 rounded-sm border border-white/10" />
              )
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// Compact, read-only look at a public board's beats: what a "spy" sees after
// clicking a star in Explore or a row in Spy. Play any slot, copy any slot
// into a saved song, or save the whole board.
export function BeatPreview({ slug }: { slug: string }) {
  // One combined result, tagged with the slug it's for, so a stale response
  // for a previous slug never renders and there's no synchronous reset.
  const [result, setResult] = useState<{ slug: string; board?: BoardResponse; error?: boolean } | null>(null);
  const [playingSlot, setPlayingSlot] = useState<ExtendedSlotLetter | null>(null);
  const playerRef = useRef<RockBloxPlayer | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/boards/${slug}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: BoardResponse) => !cancelled && setResult({ slug, board: d }))
      .catch(() => !cancelled && setResult({ slug, error: true }));
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const current = result && result.slug === slug ? result : null;

  useEffect(() => {
    return () => {
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, []);

  async function togglePlay(letter: ExtendedSlotLetter, data: BoardSlotData) {
    if (!playerRef.current) playerRef.current = new RockBloxPlayer(data.kit ?? DEFAULT_KIT);
    const player = playerRef.current;

    if (playingSlot === letter) {
      player.stop();
      setPlayingSlot(null);
      return;
    }
    const lines = deserializeLines(data.lines);
    const measureLength = computeMeasureLength(lines);
    if (measureLength < 1) return;
    const lineStates: LineState[] = lines.map((l) => ({ instrument: l.instrument, blocks: l.blocks, volume: l.volume }));
    await player.setKit(data.kit ?? DEFAULT_KIT);
    player.clearCustomSamples();
    if (data.customSamples && Object.keys(data.customSamples).length > 0) {
      player.loadCustomSamples(data.customSamples);
    }
    player.updateSong(lineStates, data.bpm, measureLength);
    await player.play();
    setPlayingSlot(letter);
  }

  if (current?.error) return <p className="p-4 text-sm text-red-400">Couldn&apos;t load that page.</p>;
  if (!current?.board) return <p className="p-4 text-sm text-white/40">Loading…</p>;

  const board = current.board;
  const slotMap: SlotMap = board.slots;
  const filled = (["A", "B", "C", "D"] as const).filter((l) => {
    const s = board.slots[l];
    return !!s && s.lines.length > 0;
  });

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-lg font-bold">
          <span className="font-mono text-yellow-400">/{board.displayName}</span>
        </h3>
        <Link
          href={`/${board.displayName}`}
          className="shrink-0 text-xs text-white/40 transition hover:text-yellow-400"
        >
          Open full page ↗
        </Link>
      </div>

      {filled.length === 0 ? (
        <p className="text-sm text-white/40">This page has no beats yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {filled.map((letter) => {
            const data = board.slots[letter]!;
            return (
              <div key={letter} className="rounded-md border border-white/10 p-2">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-white/70">
                    Beat {letter} · {data.bpm} BPM
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => togglePlay(letter, data)}
                      className="shrink-0 rounded-md border border-white/15 px-2 py-1 text-xs text-white/70 transition hover:border-yellow-400 hover:text-yellow-400"
                    >
                      {playingSlot === letter ? "■ Stop" : "▶ Play"}
                    </button>
                    <CopyBeatButton slot={data} label={`${board.displayName} ${letter}`} />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <SlotRows data={data} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-white/10 pt-3">
        <SaveToLibraryButton getSlots={() => slotMap} />
      </div>
    </div>
  );
}
