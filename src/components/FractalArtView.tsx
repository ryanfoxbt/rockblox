"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { computeFractalBeat } from "@/lib/fractalArt";
import { type FractalBackground, renderFrame } from "@/lib/fractalRender";
import { getInstrument } from "@/lib/instruments";
import type { Bassline } from "@/lib/bassline";
import type { CustomSamples } from "@/lib/customSamples";
import type { LineData } from "@/lib/song";
import { useIsMobile } from "@/lib/useIsMobile";
import { FractalVideoExportView } from "@/components/FractalVideoExportView";

type Background = FractalBackground;

function downloadCanvas(canvas: HTMLCanvasElement, format: "png" | "jpeg") {
  const url = format === "png" ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", 0.92);
  const a = document.createElement("a");
  a.href = url;
  a.download = `rockblocks-fractal-art.${format === "png" ? "png" : "jpg"}`;
  a.click();
}

// Full-screen "convert this beat to fractal art" view — deterministic and
// read-only, so it works the same whether it's opened from a fresh
// scratchpad beat, a saved song, a Drum School lesson, or a read-only
// shared board. See src/lib/fractalArt.ts for the actual beat-to-attractor
// math; this component only draws its output to canvas and explains it.
export function FractalArtView({
  lines,
  bpm,
  measureLength,
  kit,
  customSamples,
  bassline,
  onClose,
}: {
  lines: LineData[];
  bpm: number;
  measureLength: number;
  // Only needed to hand off to the video exporter below, which renders the
  // actual audio the beat plays with — this view's own art never depends on
  // any of these (see the info panel: "kit and volume don't affect it").
  kit: string;
  customSamples: CustomSamples;
  bassline: Bassline | null;
  onClose: () => void;
}) {
  const [infoOpen, setInfoOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [videoExportOpen, setVideoExportOpen] = useState(false);
  const [background, setBackground] = useState<Background>("dark");
  const isMobile = useIsMobile();
  const frameRef = useRef<HTMLDivElement>(null);
  const darkCanvasRef = useRef<HTMLCanvasElement>(null);
  const lightCanvasRef = useRef<HTMLCanvasElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const beat = useMemo(() => computeFractalBeat(lines, measureLength, bpm), [lines, measureLength, bpm]);

  useEffect(() => {
    // Skipped while the video exporter is open on top of this view — its own
    // Escape handler (registered on the capture phase) closes only itself
    // and stops this one from also firing, but that guard lives on its side;
    // this one still shouldn't act on a key it now belongs to.
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !videoExportOpen) onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, videoExportOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [menuOpen]);

  // Only the background actually on screen gets rendered eagerly — each
  // presentation redraws every one of a layer's points (up to 55,000, times
  // however many instruments are active) from scratch, so rendering *both*
  // on every mount and every resize tick (a smooth window drag can fire the
  // observer many times a second) was real, easily-felt cost paid for a
  // Dark/Light toggle most sessions never touch. The inactive canvas is left
  // stale — renderedRef tracks what each one last drew — and only catches up
  // when the user actually switches to it (see the toggle buttons' onClick),
  // at which point it's cached until the beat or size changes again.
  const renderedRef = useRef<{ dark: number | null; light: number | null }>({ dark: null, light: null });

  function renderBackground(bg: Background, size: number) {
    const canvas = bg === "dark" ? darkCanvasRef.current : lightCanvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    renderFrame(canvas, size, dpr, bg, beat.layers);
    renderedRef.current[bg] = size;
  }

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    renderedRef.current = { dark: null, light: null };

    let lastSize = frame.clientWidth || 380;
    renderBackground(background, lastSize);
    const observer = new ResizeObserver((entries) => {
      const size = entries[0]?.contentRect.width || frame.clientWidth || 380;
      if (Math.abs(size - lastSize) < 1) return;
      lastSize = size;
      renderBackground(background, size);
    });
    observer.observe(frame);
    return () => observer.disconnect();
    // background is deliberately excluded: switching it is handled by the
    // toggle buttons themselves (render-if-stale), not by this effect —
    // re-running this on every toggle would defeat the whole point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beat]);

  function switchBackground(bg: Background) {
    const frame = frameRef.current;
    const size = frame?.clientWidth || 380;
    if (renderedRef.current[bg] !== size) renderBackground(bg, size);
    setBackground(bg);
  }

  const activeCanvasRef = background === "dark" ? darkCanvasRef : lightCanvasRef;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-6 py-4">
        <h2 className="text-lg font-bold">
          {!isMobile && (
            <>
              Rock<span className="text-yellow-400">Blocks</span>{" "}
            </>
          )}
          Fractal Art
        </h2>
        <div className="ml-auto flex items-center gap-2">
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              title="Background & download"
              className="flex h-9 w-9 items-center justify-center rounded-md border border-white/15 bg-white/5 text-white/70 transition hover:border-yellow-400 hover:text-yellow-400"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                <circle cx="5" cy="12" r="1.8" />
                <circle cx="12" cy="12" r="1.8" />
                <circle cx="19" cy="12" r="1.8" />
              </svg>
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full z-10 mt-1 w-48 overflow-hidden rounded-md border border-white/10 bg-slate-800 py-1 shadow-lg">
                <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-white/35">
                  Background
                </p>
                <button
                  type="button"
                  onClick={() => switchBackground("dark")}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-white/80 transition hover:bg-white/10 hover:text-yellow-400"
                >
                  <span className="w-3 text-yellow-400">{background === "dark" ? "✓" : ""}</span>
                  Dark (glow)
                </button>
                <button
                  type="button"
                  onClick={() => switchBackground("light")}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-white/80 transition hover:bg-white/10 hover:text-yellow-400"
                >
                  <span className="w-3 text-yellow-400">{background === "light" ? "✓" : ""}</span>
                  Light (ink)
                </button>
                <div className="my-1 border-t border-white/10" />
                <p className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-white/35">
                  Download
                </p>
                <button
                  type="button"
                  disabled={beat.layers.length === 0}
                  onClick={() => {
                    if (activeCanvasRef.current) downloadCanvas(activeCanvasRef.current, "png");
                    setMenuOpen(false);
                  }}
                  className="block w-full px-3 py-2 text-left text-sm text-white/80 transition hover:bg-white/10 hover:text-yellow-400 disabled:opacity-30"
                >
                  PNG image
                </button>
                <button
                  type="button"
                  disabled={beat.layers.length === 0}
                  onClick={() => {
                    if (activeCanvasRef.current) downloadCanvas(activeCanvasRef.current, "jpeg");
                    setMenuOpen(false);
                  }}
                  className="block w-full px-3 py-2 text-left text-sm text-white/80 transition hover:bg-white/10 hover:text-yellow-400 disabled:opacity-30"
                >
                  JPEG image
                </button>
                <div className="my-1 border-t border-white/10" />
                <button
                  type="button"
                  disabled={beat.layers.length === 0}
                  onClick={() => {
                    setVideoExportOpen(true);
                    setMenuOpen(false);
                  }}
                  className="block w-full px-3 py-2 text-left text-sm text-white/80 transition hover:bg-white/10 hover:text-yellow-400 disabled:opacity-30"
                >
                  🎬 Share video (Reels/TikTok)
                </button>
              </div>
            )}
          </div>
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
            ✕
          </button>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 overflow-y-auto p-6">
        {infoOpen && (
          <div className="flex flex-col gap-4 rounded-lg border border-white/10 bg-white/5 p-4 text-sm leading-relaxed text-white/70">
            <div className="flex flex-col gap-2">
              <p>
                Every instrument that plays in this beat seeds its own strange attractor — a shape drawn by
                iterating a simple formula thousands of times. The same beat always draws the same image, and no
                two rhythms draw the same one.
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

            <div className="flex flex-col gap-2 border-t border-white/10 pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-white/40">The math, in full</p>
              <p>
                Every layer iterates this map, starting from (0.1, 0.1) — 120 throwaway iterations first so the
                point has settled onto the attractor, then one plotted point per iteration after that:
              </p>
              <pre className="overflow-x-auto rounded-md bg-slate-950 px-3 py-2 font-mono text-xs text-yellow-300">
                x&prime; = sin(a·y) − cos(b·x){"\n"}y&prime; = sin(c·x) − cos(d·y)
              </pre>
              <p className="text-white/50">
                <code className="font-mono text-white/70">a b c d</code>{" "}
                come from hashing a seed string — the instrument, its hit pattern, the beat&rsquo;s tempo, and its
                length — into four numbers between −3 and 3. Same seed in, same four numbers out, every time.
              </p>
            </div>

            {beat.layers.length > 0 && (
              <div className="flex flex-col gap-3">
                {beat.layers.map((layer) => (
                  <div key={layer.instrument} className="rounded-md border border-white/10 p-3">
                    <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: layer.hex }}>
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: layer.hex }} />
                      {getInstrument(layer.instrument).name}
                    </div>
                    <dl className="mt-2 grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-1 font-mono text-xs text-white/60">
                      <dt className="text-white/35">hits/block</dt>
                      <dd className="break-all">
                        [{layer.pattern.join(", ")}] · {layer.totalHits} hit{layer.totalHits === 1 ? "" : "s"}
                      </dd>
                      <dt className="text-white/35">density</dt>
                      <dd>
                        {Math.round(layer.density * 100)}% → {layer.pointCount.toLocaleString()} pts @{" "}
                        {(layer.alpha * 100).toFixed(1)}% opacity
                      </dd>
                      <dt className="text-white/35">seed</dt>
                      <dd className="break-all">&ldquo;{layer.seed}&rdquo;</dd>
                      <dt className="text-white/35">a b c d</dt>
                      <dd>
                        {layer.params.a.toFixed(3)}  {layer.params.b.toFixed(3)}  {layer.params.c.toFixed(3)}{" "}
                        {layer.params.d.toFixed(3)}
                      </dd>
                    </dl>
                    {layer.tries > 1 && (
                      <p className="mt-2 text-xs text-amber-400/80">
                        The first {layer.tries - 1 === 1 ? "seed" : `${layer.tries - 1} seeds`}{" "}
                        landed on a repeating loop instead of a real attractor — an unlucky a/b/c/d draw, not
                        anything about this instrument&rsquo;s part — so this used deterministic variant
                        &ldquo;:alt
                        {layer.tries - 1}&rdquo; of the seed instead.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div
          ref={frameRef}
          className="relative mx-auto aspect-square w-full max-w-md overflow-hidden rounded-xl border border-white/10 bg-slate-950"
        >
          <canvas ref={darkCanvasRef} className="absolute inset-0 h-full w-full" hidden={background !== "dark"} />
          <canvas ref={lightCanvasRef} className="absolute inset-0 h-full w-full" hidden={background !== "light"} />
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

      {videoExportOpen && (
        <FractalVideoExportView
          lines={lines}
          bpm={bpm}
          measureLength={measureLength}
          kit={kit}
          customSamples={customSamples}
          bassline={bassline}
          initialBackground={background}
          onClose={() => setVideoExportOpen(false)}
        />
      )}
    </div>
  );
}
