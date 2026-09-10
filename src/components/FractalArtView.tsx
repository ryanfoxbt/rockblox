"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { computeFractalBeat, type FractalLayer } from "@/lib/fractalArt";
import { getInstrument } from "@/lib/instruments";
import type { LineData } from "@/lib/song";

function hexToRgb(hex: string): [number, number, number] {
  const v = parseInt(hex.replace("#", ""), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function drawLayer(ctx: CanvasRenderingContext2D, size: number, dpr: number, layer: FractalLayer) {
  const pad = size * 0.1;
  const w = layer.bounds.maxX - layer.bounds.minX || 1e-6;
  const h = layer.bounds.maxY - layer.bounds.minY || 1e-6;
  const scale = Math.min((size - 2 * pad) / w, (size - 2 * pad) / h);
  const offX = size / 2 - ((layer.bounds.minX + layer.bounds.maxX) / 2) * scale;
  const offY = size / 2 - ((layer.bounds.minY + layer.bounds.maxY) / 2) * scale;

  const [r, g, b] = hexToRgb(layer.hex);
  ctx.fillStyle = `rgba(${r},${g},${b},1)`;
  ctx.globalAlpha = layer.alpha;
  const dot = 1.15 * dpr;
  for (let i = 0; i < layer.pointCount; i++) {
    const px = layer.points[i * 2] * scale + offX;
    const py = layer.points[i * 2 + 1] * scale + offY;
    ctx.fillRect(px * dpr, py * dpr, dot, dot);
  }
  ctx.globalAlpha = 1;
}

// Full-screen "convert this beat to fractal art" view — deterministic and
// read-only, so it works the same whether it's opened from a fresh
// scratchpad beat, a saved song, a Drum School lesson, or a read-only
// shared board. See src/lib/fractalArt.ts for the actual beat-to-attractor
// math; this component only draws its output to a canvas and explains it.
export function FractalArtView({
  lines,
  bpm,
  measureLength,
  onClose,
}: {
  lines: LineData[];
  bpm: number;
  measureLength: number;
  onClose: () => void;
}) {
  const [infoOpen, setInfoOpen] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const beat = useMemo(() => computeFractalBeat(lines, measureLength, bpm), [lines, measureLength, bpm]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    const frame = frameRef.current;
    const canvas = canvasRef.current;
    if (!frame || !canvas) return;

    let lastSize = 0;
    function draw(size: number) {
      if (!canvas) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = "lighter";
      for (const layer of beat.layers) drawLayer(ctx, size, dpr, layer);
    }

    const observer = new ResizeObserver((entries) => {
      const size = entries[0]?.contentRect.width || frame.clientWidth || 380;
      if (Math.abs(size - lastSize) < 1) return;
      lastSize = size;
      draw(size);
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, [beat]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white">
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-6 py-4">
        <h2 className="text-lg font-bold">
          Rock<span className="text-yellow-400">Blocks</span> Fractal Art
        </h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setInfoOpen((v) => !v)}
            title="How this works"
            aria-pressed={infoOpen}
            className={[
              "flex h-9 w-9 items-center justify-center rounded-full border text-sm font-bold transition",
              infoOpen
                ? "border-yellow-400 bg-yellow-400/10 text-yellow-400"
                : "border-white/15 text-white/70 hover:border-yellow-400 hover:text-yellow-400",
            ].join(" ")}
          >
            i
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Close (Esc)"
            className="rounded-md border border-white/15 px-3 py-1.5 text-sm text-white/70 transition hover:border-red-400 hover:text-red-400"
          >
            ✕ Close
          </button>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 overflow-y-auto p-6">
        {infoOpen && (
          <div className="flex flex-col gap-2 rounded-lg border border-white/10 bg-white/5 p-4 text-sm leading-relaxed text-white/70">
            <p>
              Every instrument that plays in this beat seeds its own strange attractor — a shape drawn by iterating a
              simple formula thousands of times. The same beat always draws the same image, and no two rhythms draw
              the same one.
            </p>
            <p>
              Each layer is colored the same as its line in the editor. A part that plays a lot fills its layer in
              with many soft points; a part that plays just once or twice draws a few bold points in open space
              instead — sparse stays sparse. An instrument that never plays in this beat draws nothing at all.
            </p>
            <p className="text-white/50">
              Change the beat, come back, and the art changes with it — kit and volume don&rsquo;t affect it, only
              what&rsquo;s actually placed in the grid and the tempo it plays at.
            </p>
          </div>
        )}

        <div ref={frameRef} className="mx-auto aspect-square w-full max-w-md overflow-hidden rounded-xl bg-black">
          <canvas ref={canvasRef} className="h-full w-full" />
        </div>

        {beat.layers.length === 0 && (
          <p className="text-center text-sm text-white/40">
            Nothing&rsquo;s placed yet — build a beat in the grid, then come back to see its art.
          </p>
        )}

        {beat.layers.length > 0 && (
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-2">
            {beat.layers.map((layer) => (
              <div key={layer.instrument} className="flex items-center gap-2 text-xs text-white/60">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: layer.hex }} />
                {getInstrument(layer.instrument).name}
              </div>
            ))}
            {beat.silentInstruments.map((id) => (
              <div key={id} className="flex items-center gap-2 text-xs text-white/25">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full border border-white/20" />
                {getInstrument(id).name} <span className="italic">silent</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
