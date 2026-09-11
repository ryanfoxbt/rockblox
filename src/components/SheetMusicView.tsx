"use client";

import { useEffect, useRef, useState } from "react";
import { LineData, measureSplit, timeSignatureLabel } from "@/lib/song";
import {
  NotationLayout,
  PAPER_PADDING,
  keepBeatVisible,
  placeBeatHighlight,
  renderNotationPage,
  VF,
} from "@/lib/notation";

export function SheetMusicView({
  lines,
  bpm,
  onBpmChange,
  measureLength,
  isPlaying,
  playheadBeat,
  onTogglePlay,
  onClose,
}: {
  lines: LineData[];
  bpm: number;
  onBpmChange: (bpm: number) => void;
  measureLength: number;
  isPlaying: boolean;
  playheadBeat: number | null;
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
  // grows to match so it scrolls cleanly instead of spilling past the
  // barline — see drawSystem in lib/notation.
  const [paper, setPaper] = useState({ width: 0, height: 0 });

  // An 8-beat pattern is written as two 4/4 measures, shown one per page
  // (3-7 beats stay a single page). Playback turns the page automatically;
  // the ◀/▶ buttons do it by hand while stopped.
  const bars = measureSplit(measureLength);
  const pageCount = bars.length;
  const [page, setPage] = useState(0);
  const safePage = Math.min(page, pageCount - 1);
  const pageStartBeat = bars.slice(0, safePage).reduce((a, b) => a + b, 0);
  const pageBeats = bars[safePage];
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
      if (!vfModule) vfModule = await import("vexflow");
      // vexflow's own entry module kicks off loading its music-glyph font
      // (Bravura, embedded as a base64 FontFace) the moment it's imported,
      // but never awaits that load itself — so the glyphs it draws as SVG
      // <text> can still land before the font has finished decoding, which
      // renders as garbled/missing noteheads. document.fonts.ready resolves
      // once every font that's currently loading (including this one) has
      // settled, and resolves immediately on later draws once it's cached.
      await document.fonts.ready;
      const target = notationRef.current;
      if (cancelled || !target) return;
      const layout = renderNotationPage(vfModule, target, lines, pageStartBeat, pageBeats, width);
      layoutRef.current = layout;
      setPaper({ width: layout.width, height: layout.height });
      // A freshly turned-to page always starts at its own left edge, even if
      // the previous (wider) bar had been scrolled along.
      if (scrollRef.current) scrollRef.current.scrollLeft = 0;
      updateHighlight();
      setReady(true);
    }

    // Measure the scroll viewport, not the notation container — the latter
    // grows with a wide bar, which would feed straight back into the width
    // the next draw is offered.
    const target = scrollRef.current;
    if (!target) return;

    // Measuring clientWidth right when vexflow's dynamic import resolves is
    // a race: requestFullscreen (above) resizes the viewport asynchronously,
    // and if that transition is still in flight, this reads the pre-
    // fullscreen width and draws a squished/overlapping layout — with no
    // "resize" or "fullscreenchange" event afterward reliably firing to fix
    // it, since some browsers dispatch fullscreenchange a frame or two
    // before the geometry actually settles. A ResizeObserver sidesteps the
    // guessing: it reports the container's real box size whenever it
    // changes, for whatever reason, so it also naturally covers window
    // resizes and provides the very first measurement (no separate initial
    // draw() call needed).
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
  }, [lines, measureLength, pageStartBeat, pageBeats]);

  function updateHighlight() {
    const layout = layoutRef.current;
    const el = highlightRef.current;
    if (!el) return;
    if (!isPlaying || playheadBeat === null || !layout) {
      placeBeatHighlight(el, null, null);
      return;
    }
    // Which page (measure) the global playhead beat lands on, and where it
    // sits within that measure's own beat numbering.
    let acc = 0;
    let beatPage = pageCount - 1;
    for (let i = 0; i < pageCount; i++) {
      if (playheadBeat < acc + bars[i]) {
        beatPage = i;
        break;
      }
      acc += bars[i];
    }
    if (beatPage !== safePage) {
      placeBeatHighlight(el, null, null);
      goToPage(beatPage);
      return;
    }
    placeBeatHighlight(el, layout, playheadBeat - acc);
    keepBeatVisible(scrollRef.current, el);
  }

  // updateHighlight also reads bars/pageCount/goToPage, but those only change
  // with measureLength (which re-renders the whole view anyway) — the beat,
  // play state, and current page are what should re-run the highlight.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(updateHighlight, [isPlaying, playheadBeat, safePage]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white"
    >
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-6 sm:py-4">
        <h2 className="text-lg font-bold">
          Rock<span className="text-yellow-400">Blocks</span> Sheet Music
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
        <div className="flex items-center gap-2">
          <label htmlFor="sheet-tempo" className="text-sm text-white/60">
            Tempo
          </label>
          <input
            id="sheet-tempo"
            type="range"
            min={40}
            max={220}
            value={bpm}
            onChange={(e) => onBpmChange(Number(e.target.value))}
            className="w-24 accent-yellow-400 sm:w-40"
          />
          <span className="w-16 text-sm text-white/80">{bpm} BPM</span>
        </div>
        <span className="text-sm text-white/50">
          {pageCount > 1 ? `${pageBeats}/4` : timeSignatureLabel(measureLength)}
        </span>
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

      {/* min-w-0 is load-bearing: without it this flex item refuses to shrink
          below the width of its (deliberately over-wide) paper child, so a
          busy bar grows the whole box past the screen instead of scrolling,
          and its right-hand beats become unreachable on a phone. */}
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
