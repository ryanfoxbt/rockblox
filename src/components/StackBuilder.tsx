"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { DndContext, DragEndEvent, PointerSensor, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { BoardData, SLOT_LETTERS, SlotLetter } from "@/lib/board";
import { computeMeasureLength, deserializeLines } from "@/lib/song";
import { CustomSamples } from "@/lib/customSamples";
import { DEFAULT_KIT } from "@/lib/drumKits";
import { LineState } from "@/lib/audioEngine";
import { StackPlayer, StackSlotSource, StackStepSource } from "@/lib/stackPlayer";
import {
  MAX_STACK_SECONDS,
  StackStep,
  createStepId,
  formatDuration,
  stepDurationSeconds,
  totalStackSeconds,
} from "@/lib/stack";
import { useIsMobile } from "@/lib/useIsMobile";
import { StackPaletteBlock } from "./StackPaletteBlock";
import { StackStepChip } from "./StackStepChip";

interface SlotInfo {
  lineStates: LineState[];
  measureLength: number;
  kit: string;
  customSamples?: CustomSamples;
  empty: boolean;
  summary: string;
}

function AppendDropZone({ index, onTap }: { index: number; onTap: () => void }) {
  const { isOver, setNodeRef } = useDroppable({ id: `step:${index}` });
  return (
    <div
      ref={setNodeRef}
      onClick={onTap}
      title="Drop (or click/tap, when a beat is armed) to append it here"
      className={[
        "flex h-14 w-14 shrink-0 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed text-2xl transition",
        isOver ? "border-yellow-400 bg-yellow-400/10 text-yellow-400" : "border-white/15 text-white/20",
      ].join(" ")}
    >
      +
    </div>
  );
}

export function StackBuilder({ board }: { board: BoardData }) {
  const isMobile = useIsMobile();

  const slotInfo = useMemo(() => {
    const info = {} as Record<SlotLetter, SlotInfo>;
    for (const letter of SLOT_LETTERS) {
      const data = board.slots[letter];
      if (!data || data.lines.length === 0) {
        info[letter] = { lineStates: [], measureLength: 0, kit: DEFAULT_KIT, empty: true, summary: "Empty" };
        continue;
      }
      const lineData = deserializeLines(data.lines);
      const measureLength = computeMeasureLength(lineData);
      const lineStates: LineState[] = lineData.map((l) => ({ instrument: l.instrument, blocks: l.blocks, volume: l.volume }));
      const kit = data.kit ?? DEFAULT_KIT;
      info[letter] = {
        lineStates,
        measureLength,
        kit,
        customSamples: data.customSamples,
        empty: measureLength < 1,
        summary: measureLength < 1 ? "Empty" : `${kit} · ${measureLength} beat${measureLength === 1 ? "" : "s"}`,
      };
    }
    return info;
  }, [board]);

  const measureLengths = useMemo(() => {
    const m = {} as Record<SlotLetter, number>;
    for (const letter of SLOT_LETTERS) m[letter] = slotInfo[letter].measureLength;
    return m;
  }, [slotInfo]);

  const [steps, setSteps] = useState<StackStep[]>(() => board.stack?.steps ?? []);
  const [bpm, setBpm] = useState<number>(() => board.stack?.bpm ?? 100);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [capError, setCapError] = useState<string | null>(null);
  const [samplesLoading, setSamplesLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState<{ elapsed: number; total: number } | null>(null);
  const [rendering, setRendering] = useState(false);
  const [armedSlot, setArmedSlot] = useState<SlotLetter | null>(null);
  const [movingFrom, setMovingFrom] = useState<{ index: number; step: StackStep } | null>(null);

  const playerRef = useRef<StackPlayer | null>(null);
  const lastSavedRef = useRef<string | null>(null);
  const capErrorTimerRef = useRef<number | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const totalSeconds = totalStackSeconds(steps, measureLengths, bpm);
  const hasAnyBeats = SLOT_LETTERS.some((l) => !slotInfo[l].empty);

  useEffect(() => {
    const player = new StackPlayer();
    playerRef.current = player;
    const sources: StackSlotSource[] = SLOT_LETTERS.filter((l) => !slotInfo[l].empty).map((l) => ({
      slot: l,
      kit: slotInfo[l].kit,
      customSamples: slotInfo[l].customSamples,
    }));
    player.loadSlots(sources).then(() => setSamplesLoading(false));
    return () => player.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autosave, same debounced-PUT-on-change pattern as the main editor's board autosave.
  useEffect(() => {
    const payload = JSON.stringify({ bpm, steps });
    if (lastSavedRef.current === null) {
      lastSavedRef.current = payload;
      return;
    }
    if (lastSavedRef.current === payload) return;

    setSaveStatus("saving");
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`/api/boards/${board.slug}/stack`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: payload,
        });
        if (res.ok) {
          lastSavedRef.current = payload;
        } else {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          if (data?.error) flashCapError(data.error);
        }
        setSaveStatus(res.ok ? "saved" : "error");
      } catch {
        setSaveStatus("error");
      }
    }, 800);
    return () => clearTimeout(handle);
  }, [bpm, steps, board.slug]);

  useEffect(() => {
    if (!isPlaying) return;
    let raf: number;
    const tick = () => {
      const p = playerRef.current?.getProgress();
      if (!p) {
        setIsPlaying(false);
        setProgress(null);
        return;
      }
      setProgress(p);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && (movingFrom || armedSlot)) {
        setMovingFrom(null);
        setArmedSlot(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [movingFrom, armedSlot]);

  function flashCapError(message: string) {
    setCapError(message);
    if (capErrorTimerRef.current !== null) window.clearTimeout(capErrorTimerRef.current);
    capErrorTimerRef.current = window.setTimeout(() => setCapError(null), 2500);
  }

  function insertStep(slot: SlotLetter, targetIndex: number, sourceIndex?: number) {
    if (slotInfo[slot].empty) return;
    setSteps((prev) => {
      const next = [...prev];
      let insertAt = targetIndex;
      if (sourceIndex !== undefined) {
        next.splice(sourceIndex, 1);
        if (sourceIndex < insertAt) insertAt -= 1;
      }
      const id = sourceIndex !== undefined ? prev[sourceIndex].id : createStepId();
      next.splice(insertAt, 0, { id, slot });

      if (sourceIndex === undefined) {
        const total = totalStackSeconds(next, measureLengths, bpm);
        if (total > MAX_STACK_SECONDS) {
          flashCapError(`That would push the song past ${formatDuration(MAX_STACK_SECONDS)} — try a shorter beat or remove one first.`);
          return prev;
        }
      }
      return next;
    });
  }

  function removeStep(index: number) {
    setSteps((prev) => prev.filter((_, i) => i !== index));
    setMovingFrom((prev) => (prev && prev.index === index ? null : prev));
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over) return;
    const slot = active.data.current?.slot as SlotLetter | undefined;
    if (!slot) return;
    const source = active.data.current?.source as number | undefined;
    const [kind, indexStr] = String(over.id).split(":");
    if (kind !== "step") return;
    insertStep(slot, Number(indexStr), source);
  }

  function handleArmSlot(slot: SlotLetter) {
    if (slotInfo[slot].empty) return;
    setMovingFrom(null);
    setArmedSlot((prev) => (prev === slot ? null : slot));
  }

  function handlePickUp(index: number) {
    setArmedSlot(null);
    setMovingFrom((prev) => (prev && prev.index === index ? null : { index, step: steps[index] }));
  }

  function handleChipTap(index: number) {
    if (movingFrom) {
      if (movingFrom.index === index) {
        setMovingFrom(null);
        return;
      }
      insertStep(movingFrom.step.slot, index, movingFrom.index);
      setMovingFrom(null);
      return;
    }
    if (armedSlot) insertStep(armedSlot, index);
  }

  function buildStepSources(): StackStepSource[] {
    return steps.map((s) => ({ slot: s.slot, lines: slotInfo[s.slot].lineStates, measureLength: slotInfo[s.slot].measureLength }));
  }

  async function togglePlay() {
    if (!playerRef.current) return;
    if (playerRef.current.isPlaying()) {
      playerRef.current.stop();
      setIsPlaying(false);
      setProgress(null);
      return;
    }
    await playerRef.current.play(buildStepSources(), bpm);
    setIsPlaying(true);
  }

  async function handleDownloadMp3() {
    if (!playerRef.current || steps.length === 0) return;
    setRendering(true);
    try {
      const buffer = await playerRef.current.renderToBuffer(buildStepSources(), bpm);
      const { encodeAudioBufferToMp3 } = await import("@/lib/mp3Encoder");
      const blob = encodeAudioBufferToMp3(buffer);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${board.displayName}-stack.mp3`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setRendering(false);
    }
  }

  const playDisabled = samplesLoading || steps.length === 0;

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 pb-24 text-white">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 px-6 py-4">
        <div>
          <Link href={`/${board.displayName}`} className="text-xs text-white/40 underline decoration-dotted hover:text-yellow-400">
            ← Back to /{board.displayName}
          </Link>
          <h1 className="mt-1 text-2xl font-black tracking-tight">
            🧱 Stack <span className="text-yellow-400">Builder</span>
          </h1>
          <p className="mt-1 max-w-lg text-sm text-white/50">
            {isMobile
              ? "Tap a beat below, then tap a spot on the timeline to add it. Repeat a beat by adding it again."
              : "Drag a beat onto the timeline to add it — drag it in again to repeat it. One tempo plays the whole song."}
          </p>
        </div>
        <span className="w-16 shrink-0 text-right text-xs text-white/40">
          {saveStatus === "saving" ? "Saving…" : saveStatus === "error" ? "Error" : saveStatus === "saved" ? "Saved" : ""}
        </span>
      </header>

      <DndContext id="stack-dnd" sensors={sensors} onDragEnd={handleDragEnd}>
        <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">
          <section className="flex flex-wrap items-center gap-4 rounded-xl bg-white/5 p-4">
            <button
              type="button"
              onClick={togglePlay}
              disabled={playDisabled}
              className="rounded-full bg-yellow-400 px-6 py-2 font-bold text-slate-900 transition hover:bg-yellow-300 disabled:opacity-30"
            >
              {isPlaying ? "■ Stop" : "▶ Play"}
            </button>

            <div className="flex items-center gap-2">
              <label htmlFor="stack-tempo" className="text-sm text-white/60">
                Tempo
              </label>
              <input
                id="stack-tempo"
                type="range"
                min={40}
                max={220}
                value={bpm}
                onChange={(e) => setBpm(Number(e.target.value))}
                className="w-40 accent-yellow-400"
              />
              <span className="w-16 text-sm text-white/80">{bpm} BPM</span>
            </div>

            <button
              type="button"
              onClick={handleDownloadMp3}
              disabled={playDisabled || rendering}
              className="rounded-md border border-white/15 bg-white/5 px-4 py-1.5 text-sm font-medium text-white/80 transition hover:border-yellow-400 hover:text-yellow-400 disabled:opacity-30"
            >
              {rendering ? "Rendering…" : "Download MP3"}
            </button>

            <span className="text-sm text-white/50">
              {samplesLoading
                ? "Loading drum sounds…"
                : `${formatDuration(progress?.elapsed ?? totalSeconds)} / ${formatDuration(MAX_STACK_SECONDS)}`}
            </span>
          </section>

          {capError && <p className="text-sm text-red-400">{capError}</p>}

          {!hasAnyBeats ? (
            <p className="text-sm text-white/50">
              Build at least one beat (A, B, C or D) on your <Link href={`/${board.displayName}`} className="text-yellow-400 underline decoration-dotted">page</Link> first, then come back to arrange them into a song.
            </p>
          ) : (
            <>
              <section>
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-white/60">Your beats</h2>
                <div className="flex flex-wrap gap-2">
                  {SLOT_LETTERS.map((letter) => (
                    <StackPaletteBlock
                      key={letter}
                      slot={letter}
                      summary={slotInfo[letter].summary}
                      disabled={slotInfo[letter].empty}
                      isMobile={isMobile}
                      isArmed={armedSlot === letter}
                      onArm={() => handleArmSlot(letter)}
                    />
                  ))}
                </div>
              </section>

              <section>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white/60">Song timeline</h2>
                <div className="flex flex-wrap items-center gap-3 rounded-xl bg-white/5 p-4">
                  {steps.length === 0 && (
                    <span className="text-sm text-white/40">
                      {isMobile ? "Tap a beat above, then tap the + to start your song." : "Drag a beat here to start your song."}
                    </span>
                  )}
                  {steps.map((step, index) => (
                    <StackStepChip
                      key={step.id}
                      index={index}
                      slot={step.slot}
                      label={formatDuration(stepDurationSeconds(measureLengths[step.slot], bpm))}
                      isMobile={isMobile}
                      picked={movingFrom?.index === index}
                      movePending={movingFrom !== null}
                      playing={false}
                      onTap={() => handleChipTap(index)}
                      onPickUp={() => handlePickUp(index)}
                      onRemove={() => removeStep(index)}
                    />
                  ))}
                  <AppendDropZone index={steps.length} onTap={() => handleChipTap(steps.length)} />
                </div>
              </section>
            </>
          )}
        </main>
      </DndContext>

      {isMobile && armedSlot && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t border-white/10 bg-slate-900/95 px-4 py-3 backdrop-blur">
          <div className="flex min-w-0 items-center gap-2 text-sm">
            <span className="shrink-0 text-white/50">Placing:</span>
            <span className="truncate font-medium text-yellow-400">Beat {armedSlot}</span>
          </div>
          <button type="button" onClick={() => setArmedSlot(null)} className="shrink-0 rounded-md border border-white/15 px-3 py-1.5 text-sm text-white/70">
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
