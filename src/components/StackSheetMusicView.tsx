"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { NotationLayout, NotationLine, VF, expandStackRows, renderNotationPage } from "@/lib/notation";
import { ExtendedSlotLetter } from "@/lib/board";

export interface StackSheetStep {
  slot: ExtendedSlotLetter;
  lines: NotationLine[];
  measureLength: number;
}

// The whole arrangement written out one measure per screen, exactly like the
// editor's Sheet Music view: an 8-beat step becomes two 4/4 pages, a 3-7
// beat step stays a single bar in its own time signature. Playback turns the
// page; ◀/▶ do it by hand while stopped. (The earlier version stacked several
// staves per page and tried to shrink wide bars to fit — that read badly on a
// portrait phone; this mirrors the single-measure model that already works.)
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
  const notationRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef<NotationLayout | null>(null);
  const [ready, setReady] = useState(false);

  // Every bar across the arrangement, in play order — one entry per page.
  const bars = useMemo(() => expandStackRows(steps), [steps]);
  const pageCount = Math.max(1, bars.length);
  const [page, setPage] = useState(0);
  const safePage = Math.min(page, pageCount - 1);
  const bar = bars[safePage];
  function goToPage(n: number) {
    setPage(Math.min(Math.max(0, n), pageCount - 1));
  }

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

  useEffect(() => {
    let cancelled = false;
    let vfModule: VF | null = null;
    let lastWidth = -1;

    async function draw(width: number) {
      if (!bar) {
        setReady(true);
        return;
      }
      if (!vfModule) vfModule = await import("vexflow");
      // See SheetMusicView for why this await matters: vexflow's Bravura glyph
      // font can still be mid-decode when the SVG <text> noteheads land.
      await document.fonts.ready;
      const target = notationRef.current;
      if (cancelled || !target) return;
      layoutRef.current = renderNotationPage(
        vfModule,
        target,
        steps[bar.stepIndex].lines,
        bar.startBeat,
        bar.numBeats,
        width
      );
      updateHighlight();
      setReady(true);
    }

    const target = notationRef.current;
    if (!target) return;

    // A ResizeObserver rather than a one-off measurement: requestFullscreen
    // resizes the viewport asynchronously, and there's no single event that
    // reliably fires once the geometry has actually settled. See SheetMusicView.
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width || target.clientWidth || 800;
      if (Math.abs(width - lastWidth) < 1) return;
      lastWidth = width;
      draw(width);
    });
    observer.observe(target);

    return () => {
      cancelled = true;
      observer.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps, bars, safePage]);

  // Maps overall playback progress (seconds into the whole song) to a step +
  // beat, the same order StackPlayer schedules in, then turns to the page
  // (bar) that beat lands on and highlights its span within that stave.
  function updateHighlight() {
    const layout = layoutRef.current;
    const el = highlightRef.current;
    if (!el) return;
    if (!isPlaying || !progress || !layout || !bar) {
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

    let barIndex = bars.findIndex(
      (b) => b.stepIndex === stepIndex && beat >= b.startBeat && beat < b.startBeat + b.numBeats
    );
    if (barIndex < 0) barIndex = bars.findIndex((b) => b.stepIndex === stepIndex);
    if (barIndex < 0) {
      el.style.opacity = "0";
      return;
    }

    if (barIndex !== safePage) {
      el.style.opacity = "0";
      goToPage(barIndex);
      return;
    }

    const localBeat = beat - bars[barIndex].startBeat;
    const x0 = layout.beatBoundariesX[localBeat] ?? 0;
    const x1 = layout.beatBoundariesX[localBeat + 1] ?? x0 + 20;
    el.style.opacity = "1";
    el.style.left = `${x0 - 4}px`;
    el.style.width = `${Math.max(x1 - x0 + 4, 8)}px`;
    el.style.top = `${layout.staveTopY}px`;
    el.style.height = `${layout.staveBottomY - layout.staveTopY}px`;
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(updateHighlight, [isPlaying, progress, safePage]);

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

      <div className="flex flex-wrap items-center gap-4 border-b border-white/10 px-6 py-3">
        <button
          type="button"
          onClick={onTogglePlay}
          className="rounded-full bg-yellow-400 px-6 py-2 font-bold text-slate-900 transition hover:bg-yellow-300"
        >
          {isPlaying ? "■ Stop" : "▶ Play"}
        </button>
        <span className="text-sm text-white/50">
          {bpm} BPM · {steps.length} step{steps.length === 1 ? "" : "s"}
        </span>
        {bar && (
          <span className="text-sm text-white/50">
            Slot {steps[bar.stepIndex].slot} · {bar.numBeats}/4
          </span>
        )}

        {pageCount > 1 && (
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => goToPage(safePage - 1)}
              disabled={isPlaying || safePage <= 0}
              title="Previous measure"
              className="rounded-md border border-white/15 px-2.5 py-1 text-sm text-white/70 transition hover:border-yellow-400 hover:text-yellow-400 disabled:opacity-30"
            >
              ◀
            </button>
            <span className="text-sm text-white/50">
              Measure {safePage + 1} / {pageCount}
            </span>
            <button
              type="button"
              onClick={() => goToPage(safePage + 1)}
              disabled={isPlaying || safePage >= pageCount - 1}
              title="Next measure"
              className="rounded-md border border-white/15 px-2.5 py-1 text-sm text-white/70 transition hover:border-yellow-400 hover:text-yellow-400 disabled:opacity-30"
            >
              ▶
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-1 items-center overflow-auto p-6">
        <div className="relative min-h-[280px] w-full rounded-lg bg-white p-4 shadow-xl">
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
