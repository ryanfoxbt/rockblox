"use client";

import { useEffect, useRef } from "react";
import { LineData } from "@/lib/song";
import { NotationLayout, renderNotation } from "@/lib/notation";

export function SheetMusicView({
  lines,
  bpm,
  measureLength,
  isPlaying,
  playheadBeat,
  onTogglePlay,
  onClose,
}: {
  lines: LineData[];
  bpm: number;
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

    async function draw() {
      const VF = await import("vexflow");
      const target = notationRef.current;
      if (cancelled || !target) return;
      const width = target.clientWidth || 800;
      layoutRef.current = renderNotation(VF, target, lines, measureLength, width);
      updateHighlight();
    }

    draw();
    window.addEventListener("resize", draw);
    return () => {
      cancelled = true;
      window.removeEventListener("resize", draw);
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
        <span className="text-sm text-white/50">
          {bpm} BPM · {measureLength}/4
        </span>
      </div>

      <div className="flex flex-1 items-center overflow-auto p-6">
        <div className="w-full rounded-lg bg-white p-4 shadow-xl">
          <div className="relative w-full">
            <div ref={notationRef} className="w-full" />
            <div
              ref={highlightRef}
              className="pointer-events-none absolute rounded bg-yellow-400/40 opacity-0 transition-opacity"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
