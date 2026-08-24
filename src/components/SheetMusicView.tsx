"use client";

import { useEffect, useRef, useState } from "react";
import { LineData } from "@/lib/song";
import { NotationLayout, renderNotation, VF } from "@/lib/notation";

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
  const notationRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef<NotationLayout | null>(null);
  const [ready, setReady] = useState(false);

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
      layoutRef.current = renderNotation(vfModule, target, lines, measureLength, width);
      updateHighlight();
      setReady(true);
    }

    const target = notationRef.current;
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
  }, [lines, measureLength]);

  function updateHighlight() {
    const layout = layoutRef.current;
    const el = highlightRef.current;
    if (!el) return;
    if (!isPlaying || playheadBeat === null || !layout) {
      el.style.opacity = "0";
      return;
    }
    const x0 = layout.beatBoundariesX[playheadBeat] ?? 0;
    const x1 = layout.beatBoundariesX[playheadBeat + 1] ?? x0 + 20;
    el.style.opacity = "1";
    el.style.left = `${x0 - 4}px`;
    el.style.width = `${Math.max(x1 - x0 + 4, 8)}px`;
    el.style.top = `${layout.staveTopY}px`;
    el.style.height = `${layout.staveBottomY - layout.staveTopY}px`;
  }

  useEffect(updateHighlight, [isPlaying, playheadBeat]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white"
    >
      <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
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

      <div className="flex items-center gap-4 border-b border-white/10 px-6 py-3">
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
        <span className="text-sm text-white/50">{measureLength}/4</span>
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
