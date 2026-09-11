"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Bassline } from "@/lib/bassline";
import type { CustomSamples } from "@/lib/customSamples";
import { InstrumentId } from "@/lib/instruments";
import { LineState, renderSongToBuffer } from "@/lib/audioEngine";
import { computeFractalBeat } from "@/lib/fractalArt";
import { drawLayer, fillBackground, type FractalBackground } from "@/lib/fractalRender";
import { NotationLayout, VF, renderNotationPage } from "@/lib/notation";
import type { LineData } from "@/lib/song";
import { measureSplit } from "@/lib/song";
import {
  aspectSize,
  easeInOut,
  pickLoopCount,
  pickRecordingFormat,
  pickRevealSeconds,
  type VideoAspect,
} from "@/lib/videoExport";

// Same 2x2 beat-block mark as the favicon (icon.tsx/apple-icon.tsx) — the
// product's own step-sequencer UI reduced to its simplest form — drawn
// directly on canvas rather than loaded as an image, so the recording never
// has to wait on an asset fetch or worry about it not being decoded yet.
function drawLogo(ctx: CanvasRenderingContext2D, x: number, y: number, unit: number) {
  const gap = unit * 0.22;
  const r = unit * 0.18;
  function block(bx: number, by: number, color: string) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(bx, by, unit, unit, r);
    ctx.fill();
  }
  block(x, y, "#facc15");
  block(x + unit + gap, y, "#e2e8f0");
  block(x, y + unit + gap, "#e2e8f0");
  block(x + unit + gap, y + unit + gap, "#facc15");
}

function drawWordmark(ctx: CanvasRenderingContext2D, x: number, y: number, fontPx: number) {
  ctx.textBaseline = "middle";
  ctx.font = `700 ${fontPx}px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = "#ffffff";
  ctx.fillText("Rock", x, y);
  const rockWidth = ctx.measureText("Rock").width;
  ctx.fillStyle = "#facc15";
  ctx.fillText("Blocks", x + rockWidth, y);
  const blocksWidth = ctx.measureText("Blocks").width;
  ctx.font = `600 ${fontPx * 0.62}px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fillText(".app", x + rockWidth + blocksWidth, y);
}

interface LayoutRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface FrameLayout {
  fractal: LayoutRect; // square
  sheet: LayoutRect; // the band the sheet music is centered within
  logoX: number;
  logoY: number;
  logoUnit: number;
  wordmarkX: number;
  wordmarkFontPx: number;
}

// Proportions are relative to the canvas width so both aspects share one
// visual language (thick fractal square up top, a paper-white sheet-music
// band, a small logo lockup) at sizes tuned by eye per shape rather than a
// single formula stretched two different ways.
function computeLayout(aspect: VideoAspect, width: number, height: number): FrameLayout {
  const margin = Math.round(width * 0.07);
  const logoUnit = Math.round(width * 0.028);
  const logoRowH = logoUnit * 2 + logoUnit * 0.22;

  if (aspect === "vertical") {
    const fractalSize = width - margin * 2;
    const fractalY = margin;
    const sheetH = Math.round(width * 0.34);
    const sheetY = fractalY + fractalSize + Math.round(width * 0.08);
    const logoY = height - margin - logoRowH;
    return {
      fractal: { x: margin, y: fractalY, w: fractalSize, h: fractalSize },
      sheet: { x: margin, y: sheetY, w: fractalSize, h: sheetH },
      logoX: margin,
      logoY,
      logoUnit,
      wordmarkX: margin + logoUnit * 2 + logoUnit * 0.22 + width * 0.03,
      wordmarkFontPx: Math.round(width * 0.034),
    };
  }

  // Square: less vertical room to work with, so the sheet band and logo
  // row are proportionally shorter and everything sits closer together.
  const sheetH = Math.round(width * 0.24);
  const gap = Math.round(width * 0.045);
  const fractalSize = Math.round(height - margin * 2 - sheetH - gap - logoRowH - gap);
  const fractalY = margin;
  const sheetY = fractalY + fractalSize + gap;
  const logoY = sheetY + sheetH + gap;
  return {
    fractal: { x: margin, y: fractalY, w: fractalSize, h: fractalSize },
    sheet: { x: margin, y: sheetY, w: fractalSize, h: sheetH },
    logoX: margin,
    logoY,
    logoUnit,
    wordmarkX: margin + logoUnit * 2 + logoUnit * 0.22 + width * 0.03,
    wordmarkFontPx: Math.round(width * 0.032),
  };
}

// Which bar (page) of the pattern is "now", by the same beat-splitting rule
// SheetMusicView pages by (measureSplit) — an 8-beat pattern is two 4/4
// bars, 3-7 beats stay one bar.
function pageForBeat(bars: number[], beat: number): { page: number; startBeat: number; numBeats: number; localBeat: number } {
  let acc = 0;
  for (let page = 0; page < bars.length; page++) {
    if (beat < acc + bars[page] || page === bars.length - 1) {
      return { page, startBeat: acc, numBeats: bars[page], localBeat: beat - acc };
    }
    acc += bars[page];
  }
  return { page: 0, startBeat: 0, numBeats: bars[0] ?? 0, localBeat: 0 };
}

// A rasterized (SVG→Image) snapshot of one page's sheet music, reused across
// frames until the playhead turns to a different page — re-rendering
// VexFlow every animation frame would be needless work for something that
// only actually changes once or twice per loop.
interface SheetRaster {
  page: number;
  img: HTMLImageElement;
  layout: NotationLayout;
}

const HIGHLIGHT_FILL = "rgba(250,204,21,0.45)";

// Everything the animation loop needs that can change from one render to the
// next, read fresh every frame via paramsRef.current rather than closed
// over — so the loop (started once, see the mount effect below) never needs
// restarting just because e.g. the background toggle changed.
interface DrawParams {
  background: FractalBackground;
  bars: number[];
  layers: ReturnType<typeof computeFractalBeat>["layers"];
  bpm: number;
  layout: FrameLayout;
  loopSeconds: number;
  measureLength: number;
  revealSeconds: number;
  totalSeconds: number;
  lines: LineData[];
}

// Records a short (~7-10s, capped at 15s), vertically- or square-cropped
// video of this beat's fractal art coming alive in sync with its own audio
// looping a few times, with a small logo and the beat's own sheet music
// (playhead and all) baked into the frame — built for dropping straight
// into an Instagram Reel or TikTok. Rendering happens by literally playing
// the clip in real time into a MediaRecorder (canvas.captureStream + an
// AudioContext's MediaStreamAudioDestinationNode) rather than compositing it
// offline, so recording a clip takes exactly as long as the clip itself.
export function FractalVideoExportView({
  lines,
  bpm,
  measureLength,
  kit,
  customSamples,
  bassline,
  initialBackground,
  onClose,
}: {
  lines: LineData[];
  bpm: number;
  measureLength: number;
  kit: string;
  customSamples: CustomSamples;
  bassline: Bassline | null;
  initialBackground: FractalBackground;
  onClose: () => void;
}) {
  // Checked once — MediaRecorder codec support doesn't change mid-session —
  // and used both to size the initial `phase` (no separate effect+setState
  // needed to flag an unsupported browser) and later when actually recording.
  const [format] = useState(() => pickRecordingFormat());

  const [aspect, setAspect] = useState<VideoAspect>("vertical");
  const [background, setBackground] = useState<FractalBackground>(initialBackground);
  const [phase, setPhase] = useState<"idle" | "recording" | "done" | "unsupported" | "error">(
    format ? "idle" : "unsupported"
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState(0); // 0-1 during recording
  const [result, setResult] = useState<{ url: string; extension: string; sizeBytes: number } | null>(null);

  const beat = useMemo(() => computeFractalBeat(lines, measureLength, bpm), [lines, measureLength, bpm]);
  const bars = useMemo(() => measureSplit(measureLength), [measureLength]);

  const loopSeconds = (60 / bpm) * measureLength;
  const loops = pickLoopCount(loopSeconds);
  const totalSeconds = loops * loopSeconds;
  const revealSeconds = pickRevealSeconds(loopSeconds);

  const size = aspectSize(aspect);
  const layout = useMemo(() => computeLayout(aspect, size.width, size.height), [aspect, size.width, size.height]);

  // Every piece of mutable state the animation loop and recording pipeline
  // touch. Each is its own directly-useRef'd binding — not grouped into a
  // wrapper object — because this project's stricter (React-Compiler-era)
  // hook lint disallows mutating anything reachable from a plain render-
  // scoped local across multiple effects/handlers, even when that local's
  // fields are themselves ordinary refs; only a value that itself came
  // straight from useRef is exempt.
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const revealCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sheetHiddenRef = useRef<HTMLDivElement>(null);
  const vfModuleRef = useRef<VF | null>(null);
  const loopIndexRef = useRef(-1);
  const drawnCountRef = useRef<Map<InstrumentId, number>>(new Map());
  const sheetRasterRef = useRef<SheetRaster | null>(null);
  const rasterizingPageRef = useRef<number | null>(null);
  const startTimeRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const recordingRef = useRef(false);
  const stoppingRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const paramsRef = useRef<DrawParams>({
    background,
    bars,
    layers: beat.layers,
    bpm,
    layout,
    loopSeconds,
    measureLength,
    revealSeconds,
    totalSeconds,
    lines,
  });

  // Keeps paramsRef in sync with the latest render's reactive values. Runs
  // after every commit (no deps array) rather than during render, where
  // mutating a ref isn't allowed.
  useEffect(() => {
    paramsRef.current = {
      background,
      bars,
      layers: beat.layers,
      bpm,
      layout,
      loopSeconds,
      measureLength,
      revealSeconds,
      totalSeconds,
      lines,
    };
  });

  function resetReveal(bg: FractalBackground) {
    const canvas = revealCanvasRef.current;
    if (!canvas) return;
    const rctx = canvas.getContext("2d");
    if (!rctx) return;
    fillBackground(rctx, canvas.width, canvas.height, bg);
    rctx.globalCompositeOperation = bg === "dark" ? "lighter" : "multiply";
    drawnCountRef.current.clear();
  }

  // Re-renders one page of sheet music to an offscreen SVG, serializes it,
  // and loads it as an Image — async, so tick() keeps showing whatever it
  // already has until this resolves rather than blocking a frame on it.
  // Guarded by rasterizingPageRef so a page that's already mid-render isn't
  // kicked off again on every intervening frame.
  async function rasterizePage(page: number, startBeat: number, numBeats: number, destW: number) {
    const hidden = sheetHiddenRef.current;
    if (!hidden || rasterizingPageRef.current === page) return;
    rasterizingPageRef.current = page;
    try {
      if (!vfModuleRef.current) vfModuleRef.current = await import("vexflow");
      await document.fonts.ready;
      const notationLayout = renderNotationPage(vfModuleRef.current, hidden, paramsRef.current.lines, startBeat, numBeats, destW);
      const svg = hidden.querySelector("svg");
      if (!svg) return;
      const serialized = new XMLSerializer().serializeToString(svg);
      const blob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("sheet music image failed to decode"));
        img.src = url;
      });
      URL.revokeObjectURL(url);
      sheetRasterRef.current = { page, img, layout: notationLayout };
    } catch {
      // Leaves sheetRasterRef showing the previous page (or nothing, on the
      // very first frame) rather than breaking the whole recording over a
      // rasterization hiccup — the fractal and audio still matter more than
      // the sheet-music overlay landing on the first try.
    } finally {
      rasterizingPageRef.current = null;
    }
  }

  // One animation frame: advances the fractal's incremental reveal,
  // composites the outer frame (dark chrome + fractal square + sheet-music
  // paper with its playhead + logo), then schedules its own next call. This
  // one loop runs continuously from mount to unmount — see the mount effect
  // below — silently on the wall clock while idle, switched by
  // startRecording onto the recording AudioContext's own clock (and back,
  // once MediaRecorder's onstop fires) rather than ever being torn down and
  // restarted, which is what lets it stay a plain function: nothing here
  // needs to be a stable hook-produced identity, because the one place it's
  // referenced recursively is its own ordinary (non-hook) function body.
  function tick(nowSeconds: number) {
    const p = paramsRef.current;
    const canvas = canvasRef.current;
    const revealCanvas = revealCanvasRef.current;
    if (!canvas || !revealCanvas) return;
    const cctx = canvas.getContext("2d");
    const revealCtx = revealCanvas.getContext("2d");
    if (!cctx || !revealCtx) return;

    const elapsed = nowSeconds - startTimeRef.current;
    const withinLoop = ((elapsed % p.loopSeconds) + p.loopSeconds) % p.loopSeconds;
    const loopIndex = Math.floor(elapsed / p.loopSeconds);

    if (loopIndex !== loopIndexRef.current) {
      loopIndexRef.current = loopIndex;
      resetReveal(p.background);
    }

    const revealT = easeInOut(withinLoop / p.revealSeconds);
    for (const layer of p.layers) {
      const target = Math.floor(layer.pointCount * revealT);
      const already = drawnCountRef.current.get(layer.instrument) ?? 0;
      if (target > already) {
        drawLayer(revealCtx, revealCanvas.width, 1, layer, already, target);
        drawnCountRef.current.set(layer.instrument, target);
      }
    }

    // Outer frame: the app's own dark chrome, regardless of the fractal's
    // own background choice — a white "light" fractal reads as a paper card
    // floating on it, the same visual language sheet music already uses
    // throughout the rest of the app.
    cctx.globalCompositeOperation = "source-over";
    cctx.fillStyle = "#0b1220";
    cctx.fillRect(0, 0, canvas.width, canvas.height);

    const f = p.layout.fractal;
    cctx.save();
    cctx.beginPath();
    cctx.roundRect(f.x, f.y, f.w, f.h, f.w * 0.03);
    cctx.clip();
    cctx.drawImage(revealCanvas, f.x, f.y, f.w, f.h);
    cctx.restore();
    cctx.strokeStyle = "rgba(255,255,255,0.12)";
    cctx.lineWidth = Math.max(1, canvas.width * 0.0018);
    cctx.stroke();

    // Sheet music: which bar is "now" within this loop, rasterize it if
    // it's not already cached, and draw the cached snapshot plus a live
    // playhead highlight over it.
    const beatSeconds = 60 / p.bpm;
    const currentBeat = Math.min(p.measureLength - 1, Math.max(0, Math.floor(withinLoop / beatSeconds)));
    const { page, startBeat, numBeats, localBeat } = pageForBeat(p.bars, currentBeat);

    const s = p.layout.sheet;
    cctx.fillStyle = "#ffffff";
    cctx.beginPath();
    cctx.roundRect(s.x, s.y, s.w, s.h, s.w * 0.025);
    cctx.fill();

    const raster = sheetRasterRef.current;
    if (!raster || raster.page !== page) {
      void rasterizePage(page, startBeat, numBeats, Math.round(s.w * 0.92));
    }
    if (raster) {
      const padX = s.w * 0.04;
      const padY = s.h * 0.08;
      const availW = s.w - padX * 2;
      const availH = s.h - padY * 2;
      const drawScale = Math.min(availW / raster.layout.width, availH / raster.layout.height, 1);
      const drawW = raster.layout.width * drawScale;
      const drawH = raster.layout.height * drawScale;
      const drawX = s.x + (s.w - drawW) / 2;
      const drawY = s.y + (s.h - drawH) / 2;
      cctx.drawImage(raster.img, drawX, drawY, drawW, drawH);

      if (raster.page === page) {
        const span = raster.layout.beatSpans[localBeat];
        if (span) {
          cctx.fillStyle = HIGHLIGHT_FILL;
          const hx = drawX + (span.x0 - 5) * drawScale;
          const hw = Math.max(span.x1 - span.x0 + 5, 10) * drawScale;
          const hy = drawY + raster.layout.staveTopY * drawScale;
          const hh = (raster.layout.staveBottomY - raster.layout.staveTopY) * drawScale;
          cctx.beginPath();
          cctx.roundRect(hx, hy, hw, hh, Math.min(6, hw / 4));
          cctx.fill();
        }
      }
    }

    drawLogo(cctx, p.layout.logoX, p.layout.logoY, p.layout.logoUnit);
    drawWordmark(cctx, p.layout.wordmarkX, p.layout.logoY + p.layout.logoUnit + p.layout.logoUnit * 0.11, p.layout.wordmarkFontPx);

    if (recordingRef.current) {
      if (elapsed >= p.totalSeconds && !stoppingRef.current) {
        stoppingRef.current = true;
        recorderRef.current?.stop();
      } else if (!stoppingRef.current) {
        setProgress(Math.min(1, elapsed / p.totalSeconds));
      }
    }

    rafRef.current = requestAnimationFrame(() =>
      tick(recordingRef.current ? (audioCtxRef.current?.currentTime ?? nowSeconds) : performance.now() / 1000)
    );
  }

  // Escape closes only this view (the export panel sitting on top of
  // FractalArtView), not the fractal-art view underneath it — FractalArtView
  // skips its own Escape handling while this is open (see its videoExportOpen
  // guard), so there's no fight over the same keystroke.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // (Re)sizes the two canvases and starts a fresh reveal cycle whenever the
  // aspect ratio or background changes — both need a clean buffer at the
  // new size/fill rather than whatever the previous look left behind. Other
  // reactive values (beat, bpm, measureLength) don't affect canvas
  // dimensions, so they flow into the already-running loop purely through
  // paramsRef instead of resetting anything here.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = size.width;
    canvas.height = size.height;
    if (!revealCanvasRef.current) revealCanvasRef.current = document.createElement("canvas");
    revealCanvasRef.current.width = layout.fractal.w;
    revealCanvasRef.current.height = layout.fractal.h;
    resetReveal(background);
    loopIndexRef.current = -1;
    sheetRasterRef.current = null;
    startTimeRef.current = performance.now() / 1000;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aspect, background]);

  // Starts the one continuous animation loop on mount and tears it down on
  // unmount — see tick() above for why it never needs restarting in between.
  useEffect(() => {
    startTimeRef.current = performance.now() / 1000;
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      audioCtxRef.current?.close().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // result's object URL is the one piece of cleanup that genuinely depends
  // on component state rather than just the ever-present refs above: revoke
  // whatever the previous recording's URL was whenever a new one replaces
  // it, and on unmount.
  useEffect(() => {
    return () => {
      if (result) URL.revokeObjectURL(result.url);
    };
  }, [result]);

  async function startRecording() {
    if (!format || phase === "recording") return;
    setErrorMessage(null);
    setResult(null);

    try {
      const lineStates: LineState[] = lines.map((l) => ({ instrument: l.instrument, blocks: l.blocks, volume: l.volume }));
      const buffer = await renderSongToBuffer(lineStates, bpm, measureLength, loops, kit, customSamples, bassline, "full");

      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AC();
      audioCtxRef.current = audioCtx;
      const streamDest = audioCtx.createMediaStreamDestination();
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(audioCtx.destination);
      source.connect(streamDest);

      const canvas = canvasRef.current!;
      const videoStream = canvas.captureStream(30);
      const combined = new MediaStream([...videoStream.getVideoTracks(), ...streamDest.stream.getAudioTracks()]);

      const recorder = new MediaRecorder(combined, {
        mimeType: format.mimeType,
        videoBitsPerSecond: 6_000_000,
        audioBitsPerSecond: 128_000,
      });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        source.stop();
        audioCtxRef.current?.close().catch(() => {});
        audioCtxRef.current = null;
        // Hand the loop back to idle preview, from a fresh cycle rather
        // than whatever the recording's last frame happened to look like.
        recordingRef.current = false;
        stoppingRef.current = false;
        loopIndexRef.current = -1;
        sheetRasterRef.current = null;
        resetReveal(paramsRef.current.background);
        startTimeRef.current = performance.now() / 1000;

        const blob = new Blob(chunks, { type: format.mimeType });
        const url = URL.createObjectURL(blob);
        setResult({ url, extension: format.extension, sizeBytes: blob.size });
        setPhase("done");
      };
      recorderRef.current = recorder;

      // Fresh take: reset every piece of per-cycle state so the recording
      // always opens on an empty canvas at reveal 0, in lockstep with the
      // audio's own first sample. tick() is already running (see the mount
      // effect) and picks all of this up on its very next scheduled frame.
      loopIndexRef.current = -1;
      sheetRasterRef.current = null;
      resetReveal(background);
      startTimeRef.current = audioCtx.currentTime;
      recordingRef.current = true;
      stoppingRef.current = false;
      setPhase("recording");
      setProgress(0);

      recorder.start();
      source.start(audioCtx.currentTime);
    } catch (err) {
      recordingRef.current = false;
      setPhase("error");
      setErrorMessage(err instanceof Error ? err.message : "Recording failed.");
    }
  }

  function download() {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result.url;
    a.download = `rockblocks-fractal-art.${result.extension}`;
    a.click();
  }

  const previewCssSize = aspect === "vertical" ? { width: 234, height: 416 } : { width: 320, height: 320 };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-slate-950 text-white">
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-6 sm:py-4">
        <h2 className="text-lg font-bold">
          Share <span className="text-yellow-400">Video</span>
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

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center gap-5 overflow-y-auto p-6">
        {phase === "unsupported" ? (
          <p className="rounded-lg border border-red-400/30 bg-red-400/10 p-4 text-center text-sm text-red-200">
            This browser can&rsquo;t record video (no MediaRecorder support). Try the latest Chrome, Edge, or Safari.
          </p>
        ) : (
          <>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={phase === "recording"}
                onClick={() => setAspect("vertical")}
                className={[
                  "rounded-full border px-4 py-1.5 text-sm font-medium transition disabled:opacity-40",
                  aspect === "vertical"
                    ? "border-yellow-400 bg-yellow-400/20 text-yellow-300"
                    : "border-white/15 bg-white/5 text-white/70 hover:border-yellow-400 hover:text-yellow-400",
                ].join(" ")}
              >
                9:16 Reels/TikTok
              </button>
              <button
                type="button"
                disabled={phase === "recording"}
                onClick={() => setAspect("square")}
                className={[
                  "rounded-full border px-4 py-1.5 text-sm font-medium transition disabled:opacity-40",
                  aspect === "square"
                    ? "border-yellow-400 bg-yellow-400/20 text-yellow-300"
                    : "border-white/15 bg-white/5 text-white/70 hover:border-yellow-400 hover:text-yellow-400",
                ].join(" ")}
              >
                1:1 Square
              </button>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                disabled={phase === "recording"}
                onClick={() => setBackground("dark")}
                className={[
                  "rounded-full border px-3 py-1 text-xs font-medium transition disabled:opacity-40",
                  background === "dark"
                    ? "border-yellow-400 bg-yellow-400/20 text-yellow-300"
                    : "border-white/15 bg-white/5 text-white/70 hover:border-yellow-400 hover:text-yellow-400",
                ].join(" ")}
              >
                Dark (glow)
              </button>
              <button
                type="button"
                disabled={phase === "recording"}
                onClick={() => setBackground("light")}
                className={[
                  "rounded-full border px-3 py-1 text-xs font-medium transition disabled:opacity-40",
                  background === "light"
                    ? "border-yellow-400 bg-yellow-400/20 text-yellow-300"
                    : "border-white/15 bg-white/5 text-white/70 hover:border-yellow-400 hover:text-yellow-400",
                ].join(" ")}
              >
                Light (ink)
              </button>
            </div>

            <div
              // shrink-0 is load-bearing: without it, once the "done" result
              // panel below (video preview + buttons) makes this scrollable
              // area's content taller than the viewport, flexbox's default
              // min-height:auto on a column flex item lets it shrink below
              // its own explicit height — collapsing the live canvas to a
              // sliver instead of leaving it full-size and letting the
              // (already overflow-y-auto) area scroll for the rest.
              className="shrink-0 overflow-hidden rounded-xl border border-white/10 shadow-xl"
              style={{ width: previewCssSize.width, height: previewCssSize.height }}
            >
              <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
            </div>

            <p className="text-center text-xs text-white/40">
              {loops} loop{loops === 1 ? "" : "s"} · {totalSeconds.toFixed(1)}s clip · {format?.extension.toUpperCase()}
            </p>

            {phase === "recording" ? (
              <div className="flex w-full flex-col items-center gap-2">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full bg-yellow-400 transition-[width]"
                    style={{ width: `${Math.round(progress * 100)}%` }}
                  />
                </div>
                <p className="text-sm text-white/60">
                  Recording… {(progress * totalSeconds).toFixed(1)}s / {totalSeconds.toFixed(1)}s
                </p>
              </div>
            ) : (
              <button
                type="button"
                disabled={beat.layers.length === 0}
                onClick={startRecording}
                className="rounded-full bg-yellow-400 px-6 py-2 font-bold text-slate-900 transition hover:bg-yellow-300 disabled:opacity-30"
              >
                ● Record {totalSeconds.toFixed(0)}s clip
              </button>
            )}

            {phase === "error" && (
              <p className="text-center text-sm text-red-300">{errorMessage ?? "Something went wrong."}</p>
            )}

            {phase === "done" && result && (
              <div className="flex w-full flex-col items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-4">
                <video src={result.url} controls loop className="max-h-64 w-auto rounded-md" />
                <p className="text-xs text-white/40">{(result.sizeBytes / 1024 / 1024).toFixed(1)} MB</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={download}
                    className="rounded-full bg-yellow-400 px-5 py-1.5 text-sm font-bold text-slate-900 transition hover:bg-yellow-300"
                  >
                    ⬇ Download
                  </button>
                  <button
                    type="button"
                    onClick={startRecording}
                    className="rounded-full border border-white/15 px-5 py-1.5 text-sm text-white/70 transition hover:border-yellow-400 hover:text-yellow-400"
                  >
                    Record again
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Off-screen VexFlow target — connected to the document (VexFlow's
          SVG text-measurement needs that) but positioned well outside the
          viewport rather than display:none, which some layout-dependent
          measurement calls treat as zero-size. */}
      <div ref={sheetHiddenRef} style={{ position: "fixed", left: -99999, top: 0, width: 900 }} />
    </div>
  );
}
