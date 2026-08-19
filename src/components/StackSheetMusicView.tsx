"use client";

import { useEffect, useRef, useState } from "react";
import { NotationLine, STACK_STAVE_SPACING, StackNotationLayout, VF, renderStackNotation } from "@/lib/notation";
import { SlotLetter } from "@/lib/board";

export interface StackSheetStep {
  slot: SlotLetter;
  lines: NotationLine[];
  measureLength: number;
}

export function StackSheetMusicView({
  steps,
  bpm,
  isPlaying,
  progress,
  onTogglePlay,
  onClose,
}: {
  steps: StackSheetStep[];
  bpm: number;
  isPlaying: boolean;
  progress: { elapsed: number; total: number } | null;
  onTogglePlay: () => void;
  onClose: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const notationRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef<StackNotationLayout | null>(null);
  const [ready, setReady] = useState(false);
  // A long stack doesn't fit one screen's worth of staves at any readable
  // size, and scrolling to follow playback (the previous approach) left the
  // white "paper" background unable to keep up with how tall the fully
  // rendered notation actually was — the notation would render past the
  // paper's own box straight onto the page's dark background. Paginating
  // instead — showing only as many staves as actually fit, and swapping the
  // page as playback crosses into the next one — sidesteps both problems
  // and works the same way on mobile, where scrolling a fullscreen view is
  // even less pleasant.
  const [pageStart, setPageStart] = useState(0);
  const [pageSize, setPageSize] = useState(1);
  const [drawWidth, setDrawWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    el?.requestFullscreen?.().catch(() => {});

    function onFullscreenChange() {
      if (document.fullscreenElement !== el) onClose();
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      if (document.fullscreenElement === el) {
        document.exitFullscreen().catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // Measures the paper box itself (not the notation canvas, which is sized
  // *from* this measurement) so page size reacts to the actual available
  // area — window resizes, orientation changes, fullscreen settling, etc.
  useEffect(() => {
    const target = paperRef.current;
    if (!target) return;
    const observer = new ResizeObserver((entries) => {
      // contentRect is already the box *inside* this element's own padding
      // (Tailwind's p-4), i.e. exactly the space notation can draw into —
      // no separate padding subtraction needed.
      const rect = entries[0]?.contentRect;
      const width = Math.max(200, rect?.width || target.clientWidth);
      const height = Math.max(1, rect?.height || target.clientHeight);
      const nextPageSize = Math.max(1, Math.floor(height / STACK_STAVE_SPACING));
      setDrawWidth((prev) => (Math.abs(prev - width) < 1 ? prev : width));
      setPageSize((prev) => {
        if (prev === nextPageSize) return prev;
        // Keep whichever step was currently playing (or the first step of
        // the old page, if idle) visible on the page it lands on now.
        setPageStart((prevStart) => Math.floor(prevStart / nextPageSize) * nextPageSize);
        return nextPageSize;
      });
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let vfModule: VF | null = null;

    async function draw() {
      if (drawWidth <= 0) return;
      if (!vfModule) vfModule = await import("vexflow");
      // See SheetMusicView for why this await matters: without it, vexflow's
      // Bravura glyph font can still be mid-decode when the SVG <text> nodes
      // for noteheads land, rendering as garbled/missing glyphs.
      await document.fonts.ready;
      const target = notationRef.current;
      if (cancelled || !target) return;
      const page = steps.slice(pageStart, pageStart + pageSize);
      layoutRef.current = renderStackNotation(vfModule, target, page, drawWidth);
      updateHighlight();
      setReady(true);
    }

    draw();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps, pageStart, pageSize, drawWidth]);

  const pageCount = Math.max(1, Math.ceil(steps.length / pageSize));
  const pageIndex = Math.floor(pageStart / pageSize);

  function goToPage(index: number) {
    setPageStart(Math.min(Math.max(0, index), pageCount - 1) * pageSize);
  }

  // Maps overall playback progress (seconds elapsed into the whole song) to
  // a step index + beat within that step, same order StackPlayer schedules
  // in — then turns the page if that step isn't on the currently-shown one,
  // and highlights that step's beat span within its (now-current) stave.
  function updateHighlight() {
    const layout = layoutRef.current;
    const el = highlightRef.current;
    if (!el) return;
    if (!isPlaying || !progress || !layout || layout.steps.length === 0) {
      el.style.opacity = "0";
      return;
    }

    const beatSeconds = 60 / bpm;
    let remaining = progress.elapsed;
    let stepIndex = 0;
    let beat = 0;
    for (let i = 0; i < steps.length; i++) {
      const stepDuration = beatSeconds * steps[i].measureLength;
      if (remaining < stepDuration || i === steps.length - 1) {
        stepIndex = i;
        beat = Math.min(steps[i].measureLength - 1, Math.max(0, Math.floor(remaining / beatSeconds)));
        break;
      }
      remaining -= stepDuration;
    }

    const targetPageStart = Math.floor(stepIndex / pageSize) * pageSize;
    if (targetPageStart !== pageStart) {
      el.style.opacity = "0";
      setPageStart(targetPageStart);
      return;
    }

    const stepLayout = layout.steps[stepIndex - pageStart];
    if (!stepLayout) {
      el.style.opacity = "0";
      return;
    }
    const x0 = stepLayout.beatBoundariesX[beat] ?? 0;
    const x1 = stepLayout.beatBoundariesX[beat + 1] ?? x0 + 20;
    el.style.opacity = "1";
    el.style.left = `${x0 - 4}px`;
    el.style.width = `${Math.max(x1 - x0 + 4, 8)}px`;
    el.style.top = `${stepLayout.staveTopY}px`;
    el.style.height = `${stepLayout.staveBottomY - stepLayout.staveTopY}px`;
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(updateHighlight, [isPlaying, progress]);

  return (
    <div ref={containerRef} className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white">
      <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <h2 className="text-lg font-bold">
          Stack <span className="text-yellow-400">Sheet Music</span>
        </h2>
        <button
          type="button"
          onClick={onClose}
          title="Close (Esc)"
          className="rounded-md border border-white/15 px-3 py-1.5 text-sm text-white/70 transition hover:border-red-400 hover:text-red-400"
        >
          ✕ Close
        </button>
      </header>

      <div className="flex items-center gap-4 border-b border-white/10 px-6 py-3">
        <button
          type="button"
          onClick={onTogglePlay}
          className="rounded-full bg-yellow-400 px-6 py-2 font-bold text-slate-900 transition hover:bg-yellow-300"
        >
          {isPlaying ? "■ Stop" : "▶ Play"}
        </button>
        <span className="text-sm text-white/50">{bpm} BPM · {steps.length} step{steps.length === 1 ? "" : "s"}</span>

        {pageCount > 1 && (
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => goToPage(pageIndex - 1)}
              disabled={isPlaying || pageIndex <= 0}
              title="Previous page"
              className="rounded-md border border-white/15 px-2.5 py-1 text-sm text-white/70 transition hover:border-yellow-400 hover:text-yellow-400 disabled:opacity-30"
            >
              ◀
            </button>
            <span className="text-sm text-white/50">
              Page {pageIndex + 1} / {pageCount}
            </span>
            <button
              type="button"
              onClick={() => goToPage(pageIndex + 1)}
              disabled={isPlaying || pageIndex >= pageCount - 1}
              title="Next page"
              className="rounded-md border border-white/15 px-2.5 py-1 text-sm text-white/70 transition hover:border-yellow-400 hover:text-yellow-400 disabled:opacity-30"
            >
              ▶
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col overflow-hidden p-6">
        <div
          ref={paperRef}
          className="relative h-full w-full overflow-hidden rounded-lg bg-white p-4 shadow-xl"
        >
          <div className="relative w-full" style={{ visibility: ready ? "visible" : "hidden" }}>
            <div ref={notationRef} className="w-full" />
            <div
              ref={highlightRef}
              className="pointer-events-none absolute rounded bg-yellow-400/40 opacity-0 transition-opacity"
            />
          </div>
          {!ready && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">
              Loading notation…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
