"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { SheetMusicView } from "@/components/SheetMusicView";
import { DrumTeacherView } from "@/components/DrumTeacherView";
import { TileVisual } from "@/components/TileVisual";
import { FartRecorder } from "@/components/FartRecorder";
import { RandomizeButton, VariationKind } from "@/components/RandomizeButton";
import { TextToBeatButton } from "@/components/TextToBeatButton";
import { WallButton } from "@/components/WallButton";
import { PresenceIndicator } from "@/components/PresenceIndicator";
import { cycleHitAccent, RhythmTile, toggleHitRest } from "@/lib/rhythm";
import { generateFillVariation, generateGrooveVariation, generateRandomBeat } from "@/lib/randomBeat";
import { InstrumentId } from "@/lib/instruments";
import { useIsMobile } from "@/lib/useIsMobile";
import {
  LineData,
  MAX_BEATS,
  StoredLine,
  computeMeasureLength,
  createLine,
  deserializeLines,
  measureLengthFromStoredLines,
  serializeLines,
} from "@/lib/song";
import { LineState, RockBloxPlayer, renderSongToBuffer } from "@/lib/audioEngine";
import { DEFAULT_KIT, DRUM_KITS } from "@/lib/drumKits";
import { useHistoryState } from "@/lib/useHistoryState";
import { BoardData, BoardSlotData, SLOT_LETTERS, SlotLetter } from "@/lib/board";
import { CustomSamples, arrayBufferToBase64 } from "@/lib/customSamples";
import { loadDraft, saveDraft } from "@/lib/draftStorage";
import { ClaimUrlBox } from "@/components/ClaimUrlBox";
import { SaveCopyButton } from "@/components/SaveCopyButton";

// Which slots have an actual beat in them, excluding `exclude` (typically
// the slot on screen) — what the Variation popover offers as "base this
// on." A plain function so callers control exactly when it runs (an event
// handler, or a useState initializer) rather than it reading a ref at
// render time.
function computeVariationSources(
  slots: Record<SlotLetter, BoardSlotData | null> | null,
  exclude: SlotLetter
): { slot: SlotLetter; label: string }[] {
  if (!slots) return [];
  return SLOT_LETTERS.filter((slot) => {
    if (slot === exclude) return false;
    const data = slots[slot];
    return !!data && measureLengthFromStoredLines(data.lines) > 0;
  }).map((slot) => ({ slot, label: `Slot ${slot}` }));
}

export function Editor({
  initialBpm,
  initialLines,
  initialKit,
  initialCustomSamples,
  initialSlug,
  initialSlot,
  board,
  lessonNav,
}: {
  initialBpm?: number;
  initialLines?: StoredLine[];
  initialKit?: string;
  initialCustomSamples?: CustomSamples;
  initialSlug?: string;
  // Which slot to open on, e.g. from a `?slot=` URL param set when returning
  // from Stacks — falls back to the first non-empty slot when absent.
  initialSlot?: SlotLetter;
  board?: BoardData;
  // Drum School's prev/next lesson links, set only by /school/[slug] — null
  // for either end means there's nothing to link to (Lesson 1's "Previous",
  // the last lesson's "Next").
  lessonNav?: { prevHref: string | null; nextHref: string | null };
}) {
  // The homepage with nothing claimed yet: the only editor mode with no
  // board and no server-persisted pattern behind it, so it's the one case
  // where a refresh (e.g. to fix stuck headphone audio) would otherwise
  // silently wipe whatever's on screen — see draftStorage.ts.
  const isScratchpad = !board && !initialSlug;
  // A song's own links point at /songs/slug instead of the normal
  // /DisplayName — see BoardData.basePath.
  const basePath = board ? board.basePath ?? `/${board.displayName}` : "";

  const [activeSlot, setActiveSlot] = useState<SlotLetter>(
    () => initialSlot || (board && SLOT_LETTERS.find((l) => board.slots[l])) || "A"
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
  const [showDrumTeacher, setShowDrumTeacher] = useState(false);
  const [toolsMenuOpen, setToolsMenuOpen] = useState(false);
  const toolsMenuRef = useRef<HTMLDivElement>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  // Remembers the board the user was last on so the homepage (reached by
  // clicking the logo) can offer a way straight back to it — sessionStorage
  // rather than state because it needs to survive the full navigation to "/".
  const [lastBoardName] = useState<string | null>(() =>
    board ? null : typeof window !== "undefined" ? window.sessionStorage.getItem("rockblocks:lastBoard") : null
  );
  useEffect(() => {
    if (board && !board.readOnly) window.sessionStorage.setItem("rockblocks:lastBoard", board.displayName);
  }, [board]);
  const [armedTile, setArmedTile] = useState<RhythmTile | null>(null);
  const [movingFrom, setMovingFrom] = useState<{ lineId: string; index: number; tile: RhythmTile } | null>(null);
  const [kit, setKit] = useState<string>(() => {
    if (board) return board.slots[activeSlot]?.kit ?? DEFAULT_KIT;
    return initialKit ?? DEFAULT_KIT;
  });
  const [customSamples, setCustomSamples] = useState<CustomSamples>(() => {
    if (board) return board.slots[activeSlot]?.customSamples ?? {};
    return initialCustomSamples ?? {};
  });
  const [samplesLoading, setSamplesLoading] = useState(true);

  const isMobile = useIsMobile();
  const router = useRouter();
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
    playerRef.current.ready.then(() => {
      setSamplesLoading(false);
      if (Object.keys(customSamples).length > 0) playerRef.current?.loadCustomSamples(customSamples);
    });
    // Tears the player (and its AudioContext + loop timer) down when this
    // page goes away — otherwise navigating to Stacks (a
    // client-side route change that unmounts this component but not the
    // page) left the still-looping beat audible underneath the new page.
    return () => {
      playerRef.current?.destroy();
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyKit(newKit: string) {
    setKit(newKit);
    setSamplesLoading(true);
    if (!playerRef.current) playerRef.current = new RockBloxPlayer(newKit);
    playerRef.current.setKit(newKit).then(() => setSamplesLoading(false));
  }

  async function handleCustomSampleRecorded(instrument: InstrumentId, arrayBuffer: ArrayBuffer) {
    const base64 = arrayBufferToBase64(arrayBuffer);
    setCustomSamples((prev) => ({ ...prev, [instrument]: base64 }));
    if (!playerRef.current) playerRef.current = new RockBloxPlayer(kit);
    await playerRef.current.setCustomSample(instrument, arrayBuffer);
  }

  // Gates the draft-save effect below until the mount-time restore attempt
  // has actually committed. Without this, the save effect's first pass would
  // still see the pre-restore blank lines/bpm/etc (setState from the restore
  // effect hasn't flushed into a render yet within the same commit) and
  // write that blank state over the real draft, permanently losing it before
  // the restored values ever reach the screen.
  const [restoreAttempted, setRestoreAttempted] = useState(!isScratchpad);

  // Restore a scratchpad draft left over from before a refresh, deferred to
  // an effect (client-only, runs after the first paint) rather than read
  // during the initial render — localStorage doesn't exist on the server, so
  // reading it in a useState initializer would make the client's first
  // render disagree with the server-rendered HTML and trigger a hydration
  // error. The brief flash from blank to restored is the tradeoff.
  useEffect(() => {
    if (!isScratchpad) return;
    const draft = loadDraft();
    if (draft) {
      if (draft.lines.length > 0) resetLines(deserializeLines(draft.lines));
      // One-time rehydration from an external store (localStorage) on mount
      // — not derived from props/state, so there's no dependency to move
      // these into render or a plain event handler instead.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBpm(draft.bpm);
      setCustomSamples(draft.customSamples);
      playerRef.current?.clearCustomSamples();
      if (Object.keys(draft.customSamples).length > 0) playerRef.current?.loadCustomSamples(draft.customSamples);
      if (draft.kit !== kit) applyKit(draft.kit);
    }
    setRestoreAttempted(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!toolsMenuOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (toolsMenuRef.current && !toolsMenuRef.current.contains(e.target as Node)) setToolsMenuOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [toolsMenuOpen]);

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
    slotsRef.current[activeSlot] = { bpm, lines: serializeLines(lines), kit, customSamples };
    setVariationSources(computeVariationSources(slotsRef.current, slot));
    // Keep the URL in sync with the active slot (replace, not push, so
    // switching slots doesn't pile up back-button history) — this is what
    // lets the browser's actual back button, not just the in-app link,
    // return to the same slot after a trip to Stacks.
    router.replace(`${basePath}?slot=${slot}`, { scroll: false });

    const data = slotsRef.current[slot];
    const nextLines = data && data.lines.length > 0 ? deserializeLines(data.lines) : [createLine(0)];
    const nextBpm = data?.bpm ?? 100;
    const nextKit = data?.kit ?? DEFAULT_KIT;
    const nextCustomSamples = data?.customSamples ?? {};
    // Loading a slot's already-persisted data isn't an edit — set the
    // baseline now so the autosave effect below doesn't immediately re-save it.
    lastSavedRef.current = JSON.stringify({
      slot,
      bpm: nextBpm,
      lines: serializeLines(nextLines),
      kit: nextKit,
      customSamples: nextCustomSamples,
    });
    setActiveSlot(slot);
    setArmedTile(null);
    setMovingFrom(null);
    resetLines(nextLines);
    setBpm(nextBpm);
    setCustomSamples(nextCustomSamples);
    playerRef.current?.clearCustomSamples();
    if (Object.keys(nextCustomSamples).length > 0) playerRef.current?.loadCustomSamples(nextCustomSamples);
    if (nextKit !== kit) applyKit(nextKit);
  }

  // What Save a Copy sends: every slot as currently on screen, including
  // whatever's in the active slot right now (which hasn't been flushed into
  // slotsRef yet — that only happens on switchSlot/unmount) — see
  // SaveCopyButton, only ever rendered for a read-only board.
  function currentSlotsSnapshot(): Record<SlotLetter, BoardSlotData | null> {
    return {
      ...slotsRef.current,
      [activeSlot]: { bpm, lines: serializeLines(lines), kit, customSamples },
    };
  }

  // Autosave the active slot to this board's page whenever the pattern
  // changes, so a personalized URL always reflects what's on screen without
  // needing an explicit save action.
  useEffect(() => {
    if (!board || board.readOnly) return;
    const payload = JSON.stringify({ slot: activeSlot, bpm, lines: serializeLines(lines), kit, customSamples });
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
  }, [lines, bpm, kit, customSamples, activeSlot, board]);

  // The homepage scratchpad's equivalent of the autosave effect above, but
  // to localStorage instead of the server — see draftStorage.ts and
  // isScratchpad. Cleared once the beat is actually claimed (ClaimUrlBox).
  useEffect(() => {
    if (!isScratchpad || !restoreAttempted) return;
    saveDraft({ bpm, lines: serializeLines(lines), kit, customSamples });
  }, [isScratchpad, restoreAttempted, lines, bpm, kit, customSamples]);

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

    const buffer = await renderSongToBuffer(lineStates, bpm, measureLength, loops, kit, customSamples);
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

  function handleCycleAccent(lineId: string, index: number, hitIndex: number) {
    setLines((prev) =>
      prev.map((line) =>
        line.id === lineId
          ? {
              ...line,
              blocks: line.blocks.map((b, i) => (i === index && b ? cycleHitAccent(b, hitIndex) : b)),
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

  function randomizeBeat(complexity: number) {
    setLines(generateRandomBeat({ complexity }));
  }

  // Slots other than the one on screen that actually have a beat in
  // them — what the Variation popover offers as "base this on." Only ever
  // recomputed from a plain event handler (the initial useState here, and
  // switchSlot below), never read off slotsRef during render.
  const [variationSources, setVariationSources] = useState<{ slot: SlotLetter; label: string }[]>(() =>
    computeVariationSources(board?.slots ?? null, activeSlot)
  );

  function randomizeVariation(sourceSlot: string, kind: VariationKind, complexity: number) {
    const data = slotsRef.current[sourceSlot as SlotLetter];
    if (!data) return;
    const sourceLines = deserializeLines(data.lines);
    setLines(kind === "fill" ? generateFillVariation(sourceLines, complexity) : generateGrooveVariation(sourceLines, complexity));
  }

  function clearBlock(id: string, index: number) {
    setLines((prev) =>
      prev.map((l) =>
        l.id === id ? { ...l, blocks: l.blocks.map((b, i) => (i === index ? null : b)) } : l
      )
    );
  }

  // The page-name line is now the only copy-this-link affordance on a
  // claimed page — replaces the old separate Share button + its own
  // duplicate /link text, which just repeated what's already shown here.
  async function copyBoardLink() {
    if (!board) return;
    await navigator.clipboard.writeText(`${window.location.origin}/${board.displayName}`);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  const undoRedoButtons = (
    <>
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
    </>
  );

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      <header className="flex flex-col gap-3 border-b border-white/10 px-4 py-3 sm:px-6 sm:py-4">
        <div className="max-w-xl">
          <Link href="/" title="Home" className="inline-block">
            <h1 className="text-xl font-black tracking-tight transition hover:text-yellow-400 sm:text-2xl">
              Rock<span className="text-yellow-400">Blocks</span>
            </h1>
          </Link>
          <p className="hidden text-sm text-white/50 sm:block">
            {isMobile
              ? `Tap a tile, then tap up to ${MAX_BEATS} beat blocks per line to build a drum groove.`
              : `Drag rhythmic values into up to ${MAX_BEATS} beat blocks per line to build a drum groove, or click a tile then click a block to place it — handy on a trackpad.`}
          </p>
          {board ? (
            <div className="mt-1 flex flex-wrap items-center text-xs">
              {board.readOnly ? (
                <span className="text-white/40">
                  🎵 {board.subtitle} —{" "}
                  <span className="text-yellow-400">mess around all you want, nothing here saves</span>
                </span>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={copyBoardLink}
                    title="Copy this page's link"
                    className="text-left text-white/40 transition hover:text-yellow-400"
                  >
                    Your page: <span className="font-mono text-yellow-400">/{board.displayName}</span>
                    {linkCopied ? (
                      <span className="ml-2 text-yellow-400">Copied!</span>
                    ) : (
                      saveStatus !== "idle" && (
                        <span className="ml-2">
                          {saveStatus === "saving" ? "· Saving…" : saveStatus === "error" ? "· Error" : "· Saved"}
                        </span>
                      )
                    )}
                  </button>
                  <PresenceIndicator boardSlug={board.slug} />
                </>
              )}
            </div>
          ) : null}
          {lessonNav && (
            <div className="mt-2 flex items-center gap-2 text-xs">
              {lessonNav.prevHref ? (
                <Link
                  href={lessonNav.prevHref}
                  className="rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-white/70 transition hover:border-yellow-400 hover:text-yellow-400"
                >
                  ← Previous Lesson
                </Link>
              ) : (
                <span className="rounded-md border border-white/10 px-2.5 py-1 text-white/20">← Previous Lesson</span>
              )}
              {lessonNav.nextHref ? (
                <Link
                  href={lessonNav.nextHref}
                  className="rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-white/70 transition hover:border-yellow-400 hover:text-yellow-400"
                >
                  Next Lesson →
                </Link>
              ) : (
                <span className="rounded-md border border-white/10 px-2.5 py-1 text-white/20">Next Lesson →</span>
              )}
            </div>
          )}
          {!board && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <ClaimUrlBox bpm={bpm} lines={lines} kit={kit} customSamples={customSamples} />
              {lastBoardName && (
                <Link
                  href={`/${lastBoardName}`}
                  className="text-xs text-white/40 transition hover:text-yellow-400"
                >
                  ← Back to /{lastBoardName}
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Controls row: kept as one flex line (not wrapped from the header
            above) so the right-hand group stays pinned to the right even on
            narrow screens — a wrapped flex line with a single item collapses
            justify-between to the start, which used to strand this group on
            the left underneath the title instead. No overflow-x here: an
            overflow-x other than visible forces the paired overflow-y to
            auto too (a CSS quirk), which would clip the tools menu's
            dropdown since it's an absolutely-positioned descendant of this
            row — the row's few small icon buttons fit without scrolling
            anyway. */}
        <div className="flex flex-nowrap items-center justify-between gap-1.5">
          <div className="flex shrink-0 flex-nowrap items-center gap-1.5">
            {board && (
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
            )}
            {undoRedoButtons}
          </div>
          <div className="flex shrink-0 flex-nowrap items-center gap-1.5">
            <div className="relative" ref={toolsMenuRef}>
              <button
                type="button"
                onClick={() => setToolsMenuOpen((v) => !v)}
                title={
                  board
                    ? board.readOnly
                      ? "Stacks, Save a copy, Inspiration"
                      : "Stacks, TextyBeat, Wall, Inspiration"
                    : "TextyBeat, Inspiration"
                }
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/15 bg-white/5 text-white/70 transition hover:border-yellow-400 hover:text-yellow-400"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                  <circle cx="5" cy="12" r="1.8" />
                  <circle cx="12" cy="12" r="1.8" />
                  <circle cx="19" cy="12" r="1.8" />
                </svg>
              </button>
              {toolsMenuOpen && (
                // No auto-close on item click: each item's own modal is a
                // child of this same panel, so closing the panel the
                // instant an item is clicked would unmount that modal
                // before it ever got to render. It's fine left open here —
                // the modal that opens covers it completely (higher
                // z-index), and the outside-click handler above closes it
                // on the next unrelated click.
                <div className="absolute right-0 top-full z-10 mt-1 w-44 overflow-hidden rounded-md border border-white/10 bg-slate-800 shadow-lg">
                  {board && (
                    <>
                      <Link
                        href={`${basePath}/stack?from=${activeSlot}`}
                        title="Arrange your beats into a longer song"
                        className="block w-full px-3 py-2 text-left text-sm text-white/80 transition hover:bg-white/10 hover:text-yellow-400"
                      >
                        Stacks
                      </Link>
                      {!board.readOnly && (
                        <>
                          <TextToBeatButton board={board} variant="menuItem" />
                          <WallButton boardSlug={board.slug} />
                        </>
                      )}
                      {board.readOnly && (
                        <SaveCopyButton
                          variant="menuItem"
                          getSlots={currentSlotsSnapshot}
                          getStack={() => board.stack ?? null}
                        />
                      )}
                    </>
                  )}
                  {!board && <TextToBeatButton variant="menuItem" />}
                  <RandomizeButton
                    variant="menuItem"
                    variationSources={variationSources}
                    onGenerateNew={randomizeBeat}
                    onGenerateVariation={randomizeVariation}
                  />
                </div>
              )}
              {/* Song import is temporarily hidden from the UI — see SongImportButton.tsx; the
                  upload/transcribe/import API routes are untouched, just not linked to from here. */}
            </div>
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
            <button
              type="button"
              onClick={() => setShowDrumTeacher(true)}
              disabled={measureLength < 1}
              title="Watch how to play this on a real kit"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/15 bg-white/5 text-white/70 transition hover:border-yellow-400 hover:text-yellow-400 disabled:opacity-30"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <ellipse cx="12" cy="16" rx="8" ry="4" />
                <path d="M6 8 17 19" strokeLinecap="round" />
                <path d="M17 8 6 19" strokeLinecap="round" />
              </svg>
            </button>
          </div>
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

      {showDrumTeacher && (
        <DrumTeacherView
          lines={lines}
          kit={kit}
          customSamples={customSamples}
          measureLength={measureLength}
          onClose={() => setShowDrumTeacher(false)}
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
            >
              {kit === "Fart" && (
                <>
                  <FartRecorder onRecorded={handleCustomSampleRecorded} />
                  <a
                    href="https://albumsanonymous.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-white/40 transition hover:text-yellow-400"
                  >
                    Sponsored by Albums Anonymous
                  </a>
                </>
              )}
            </Transport>

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
                  onCycleAccent={(i, hitIndex) => handleCycleAccent(line.id, i, hitIndex)}
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
