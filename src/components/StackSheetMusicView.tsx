"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  NotationLayout,
  NotationLine,
  PAPER_PADDING,
  VF,
  expandStackRows,
  keepBeatVisible,
  placeBeatHighlight,
  renderNotationPage,
} from "@/lib/notation";
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const notationRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef<NotationLayout | null>(null);
  const [ready, setReady] = useState(false);
  // The size the current bar was actually drawn at. A bar busier than the
  // screen is wide gets drawn at the width its notes need, and the paper
  // grows to match so it scrolls cleanly instead of spilling off the edge.
  const [paper, setPaper] = useState({ width: 0, height: 0 });

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

    async function draw(availWidth: number) {
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
      // renderNotationPage takes `availWidth` as an offer and reports the
      // width it actually used — wider, when this bar's notes need more room
      // than the screen has. The paper follows that, and the box scrolls.
      const layout = renderNotationPage(
        vfModule,
        target,
        steps[bar.stepIndex].lines,
        bar.startBeat,
        bar.numBeats,
        availWidth
      );
      layoutRef.current = layout;
      setPaper({ width: layout.width, height: layout.height });
      // A freshly turned-to page always starts at its own left edge, even if
      // the previous (wider) bar had been scrolled along.
      if (scrollRef.current) scrollRef.current.scrollLeft = 0;
      updateHighlight();
      setReady(true);
    }

    // Measure the scroll viewport, not the notation container — the latter
    // grows with a wide bar, which would feed back into the width math.
    const target = scrollRef.current;
    if (!target) return;

    // A ResizeObserver rather than a one-off measurement: requestFullscreen
    // resizes the viewport asynchronously, and there's no single event that
    // reliably fires once the geometry has actually settled. See SheetMusicView.
    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect.width || target.clientWidth || 800;
      // What's left for the notation once the paper's own padding is taken
      // off — that's the width the music actually has to work with.
      const width = Math.max(box - PAPER_PADDING * 2, 200);
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
      placeBeatHighlight(el, null, null);
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
      placeBeatHighlight(el, null, null);
      return;
    }

    if (barIndex !== safePage) {
      placeBeatHighlight(el, null, null);
      goToPage(barIndex);
      return;
    }

    placeBeatHighlight(el, layout, beat - bars[barIndex].startBeat);
    keepBeatVisible(scrollRef.current, el);
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(updateHighlight, [isPlaying, progress, safePage]);

  return (
    <div ref={containerRef} className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white">
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-6 sm:py-4">
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

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-white/10 px-4 py-3 sm:px-6">
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

      {/* min-w-0 is load-bearing: without it this flex item won't shrink below
          the width of its (deliberately over-wide) paper child, so instead of
          scrolling, the whole scroll box grows past the screen and the right
          side of a busy 7/4 bar is unreachable on a phone. */}
      <div ref={scrollRef} className="flex min-w-0 flex-1 items-center overflow-auto p-4 sm:p-6">
        <div
          className="relative w-full shrink-0 rounded-lg bg-white p-4 shadow-xl"
          style={{
            minWidth: paper.width ? paper.width + PAPER_PADDING * 2 : undefined,
            minHeight: paper.height ? paper.height + PAPER_PADDING * 2 : undefined,
          }}
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
