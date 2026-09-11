"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Bassline } from "@/lib/bassline";
import type { CustomSamples } from "@/lib/customSamples";
import { InstrumentId } from "@/lib/instruments";
import { LineState, RENDER_SAMPLE_RATE, renderSongToBuffer } from "@/lib/audioEngine";
import { computeFractalBeat } from "@/lib/fractalArt";
import { drawLayer, fillBackground, renderFrame, type FractalBackground } from "@/lib/fractalRender";
import { NotationLayout, VF, renderNotationMeasureToCanvas } from "@/lib/notation";
import type { LineData } from "@/lib/song";
import { measureSplit } from "@/lib/song";
import {
  aspectSize,
  easeInOut,
  introSecondsFor,
  loopsForDuration,
  pickRecordingFormat,
  MAX_CLIP_SECONDS,
  MIN_CLIP_SECONDS,
  DEFAULT_CLIP_SECONDS,
  type VideoAspect,
} from "@/lib/videoExport";

// A handful of named looks for the fractal square, on top of the existing
// dark/light background choice — picked for being cheap to composite (a
// handful of extra drawImage/gradient calls per frame, not a per-point
// cost) so they don't threaten the real-time capture budget. "vivid" is the
// one exception that touches point-drawing itself (bigger dots) — see
// dotScaleForStyle.
export type FractalStyle = "classic" | "bloom" | "vignette" | "vivid" | "prism";

// How much bigger than normal each point draws — only "vivid" asks for
// bolder marks; every other style keeps the same fine dots the static
// Fractal Art view uses, drawn via the exact same drawLayer everything else
// here already shares.
function dotScaleForStyle(style: FractalStyle): number {
  return style === "vivid" ? 2.1 : 1;
}

// Same 2x2 beat-block mark as the favicon (icon.tsx/apple-icon.tsx) — the
// product's own step-sequencer UI reduced to its simplest form — drawn
// directly on canvas rather than loaded as an image, so the recording never
// has to wait on an asset fetch or worry about it not being decoded yet.
// Colors are tuned for sitting on the sheet-music paper's own white
// background (see FrameLayout) rather than the frame's dark chrome — the
// squares that read as "off"/paper-colored against dark need to become
// something with actual contrast against white instead.
function drawLogo(ctx: CanvasRenderingContext2D, x: number, y: number, unit: number) {
  const gap = unit * 0.22;
  const r = unit * 0.18;
  function block(bx: number, by: number, color: string) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(bx, by, unit, unit, r);
    ctx.fill();
  }
  block(x, y, "#eab308");
  block(x + unit + gap, y, "#1e293b");
  block(x, y + unit + gap, "#1e293b");
  block(x + unit + gap, y + unit + gap, "#eab308");
}

function drawWordmark(ctx: CanvasRenderingContext2D, x: number, y: number, fontPx: number) {
  ctx.textBaseline = "middle";
  ctx.font = `700 ${fontPx}px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = "#0f172a";
  ctx.fillText("Rock", x, y);
  const rockWidth = ctx.measureText("Rock").width;
  ctx.fillStyle = "#b45309";
  ctx.fillText("Blocks", x + rockWidth, y);
  const blocksWidth = ctx.measureText("Blocks").width;
  ctx.font = `600 ${fontPx * 0.62}px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = "rgba(15,23,42,0.45)";
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
  // The paper-white sheet-music card. The logo lives inside its own bottom-
  // left corner (see logoX/logoY below) rather than in a separate row below
  // it — that used to leave a tall stretch of empty dark background between
  // the card and the logo for no reason.
  sheet: LayoutRect;
  // Where the notation itself may be drawn within `sheet` — top-anchored,
  // leaving reserved room below for the logo corner.
  notationArea: LayoutRect;
  logoX: number;
  logoY: number;
  logoUnit: number;
  wordmarkX: number;
  wordmarkFontPx: number;
}

// Proportions are relative to the canvas width so both aspects share one
// visual language (a big fractal square, a paper-white sheet-music card
// with a small logo tucked in its own corner) at sizes tuned by eye per
// shape rather than a single formula stretched two different ways.
function computeLayout(aspect: VideoAspect, width: number, height: number): FrameLayout {
  const logoUnit = Math.round(width * 0.02);
  const logoRowH = logoUnit * 2 + logoUnit * 0.22;
  const logoPad = Math.round(width * 0.035);
  const notationPadX = Math.round(width * 0.045);
  const notationPadTop = Math.round(width * 0.05);
  const notationLogoGap = Math.round(width * 0.02);

  function withSheet(sheet: LayoutRect, fractal: LayoutRect): FrameLayout {
    const logoY = sheet.y + sheet.h - logoPad - logoRowH;
    return {
      fractal,
      sheet,
      notationArea: {
        x: sheet.x + notationPadX,
        y: sheet.y + notationPadTop,
        w: sheet.w - notationPadX * 2,
        h: logoY - notationLogoGap - (sheet.y + notationPadTop),
      },
      logoX: sheet.x + logoPad,
      logoY,
      logoUnit,
      wordmarkX: sheet.x + logoPad + logoUnit * 2 + logoUnit * 0.22 + width * 0.025,
      wordmarkFontPx: Math.round(width * 0.026),
    };
  }

  const margin = Math.round(width * 0.065);
  if (aspect === "vertical") {
    const fractalSize = width - margin * 2;
    const fractalY = margin;
    const gap = Math.round(width * 0.06);
    const sheetY = fractalY + fractalSize + gap;
    // The card now owns the logo row, reclaiming the dead space a separate
    // bottom row used to leave — it can afford to be noticeably taller than
    // it strictly needs for one bar of notation, since a little extra
    // breathing room (and platform caption/button safe-zone room, for 9:16
    // specifically) reads as intentional rather than empty.
    const sheetH = Math.round(width * 0.42);
    return withSheet(
      { x: margin, y: sheetY, w: fractalSize, h: sheetH },
      { x: margin, y: fractalY, w: fractalSize, h: fractalSize }
    );
  }

  // Square: less vertical room to work with — the fractal gets whatever's
  // left after a modest sheet card, rather than the reverse. That makes
  // fractalSize driven by the vertical budget, not the canvas width, so
  // it (and the sheet card, which shares its width) is narrower than the
  // canvas — x has to be its own centered offset rather than just the
  // outer margin, or both end up flush against the left edge with the
  // rest of the canvas's width sitting empty on the right.
  const gap = Math.round(width * 0.045);
  const sheetH = Math.round(width * 0.28);
  const fractalSize = Math.round(height - margin * 2 - sheetH - gap);
  const x = Math.round((width - fractalSize) / 2);
  const fractalY = margin;
  const sheetY = fractalY + fractalSize + gap;
  return withSheet(
    { x, y: sheetY, w: fractalSize, h: sheetH },
    { x, y: fractalY, w: fractalSize, h: fractalSize }
  );
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

// A rendered snapshot of one page's sheet music, reused across frames until
// the playhead turns to a different page — re-rendering VexFlow every
// animation frame would be needless work for something that only actually
// changes once or twice per clip. Drawn via VexFlow's Canvas backend rather
// than SVG specifically so it can be composited straight onto the main
// canvas with drawImage: an SVG rasterized through an <img> gets its own
// isolated rendering context that can't see VexFlow's Bravura music-glyph
// font (registered on `document` via the FontFace API, not embedded in the
// SVG markup), so every notehead/clef/time-signature glyph fell back to a
// generic font — all those glyphs live in the same Private-Use-Area
// Unicode block, so the result reads as a wall of garbled boxes. A canvas
// target has no such isolation — see renderNotationMeasureToCanvas.
interface SheetRaster {
  page: number;
  canvas: HTMLCanvasElement;
  layout: NotationLayout;
}

const HIGHLIGHT_FILL = "rgba(250,204,21,0.45)";

// Everything the animation loop needs that can change from one render to the
// next, read fresh every frame via paramsRef.current rather than closed
// over — so the loop (started once, see the mount effect below) never needs
// restarting just because e.g. the background toggle changed.
interface DrawParams {
  background: FractalBackground;
  style: FractalStyle;
  bars: number[];
  layers: ReturnType<typeof computeFractalBeat>["layers"];
  bpm: number;
  layout: FrameLayout;
  loopSeconds: number;
  measureLength: number;
  totalSeconds: number;
  introSeconds: number;
  lines: LineData[];
  showLogo: boolean;
}

// Records a clip (7-15s, user's choice) of this beat's fractal art coming
// alive as a continuous time-lapse — opening on a brief "sforzando" of the
// fully-formed piece (see introSecondsFor), then clearing and rebuilding it
// from nothing across the rest of the clip, finishing exactly as it ends —
// with its own audio looping underneath, a small RockBlocks.app logo, and
// the beat's own sheet music (playhead and all) baked into the frame. Built
// for dropping straight into an Instagram Reel or TikTok. Rendering happens
// by literally playing the clip in real time into a MediaRecorder
// (canvas.captureStream + an AudioContext's MediaStreamAudioDestinationNode)
// rather than compositing it offline, so recording a clip takes exactly as
// long as the clip itself.
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
  const [style, setStyle] = useState<FractalStyle>("classic");
  const [clipSeconds, setClipSeconds] = useState(DEFAULT_CLIP_SECONDS);
  // Shown by default (matches the app's own branding) — an opt-OUT, not an
  // opt-in, for anyone who'd rather post without it.
  const [showLogo, setShowLogo] = useState(true);
  const [phase, setPhase] = useState<"idle" | "recording" | "processing" | "done" | "unsupported" | "error">(
    format ? "idle" : "unsupported"
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState(0); // 0-1 during recording, and again during "processing"
  // Recording and the post-recording MP4 remux (see remuxVideo.ts) both
  // need every setting locked — swapping aspect/style/clip-length mid-take
  // would tear the in-flight recording, and there's nothing to re-remux
  // mid-fix either.
  const busy = phase === "recording" || phase === "processing";
  const [result, setResult] = useState<{ url: string; extension: string; sizeBytes: number } | null>(null);

  const beat = useMemo(() => computeFractalBeat(lines, measureLength, bpm), [lines, measureLength, bpm]);
  const bars = useMemo(() => measureSplit(measureLength), [measureLength]);

  const loopSeconds = (60 / bpm) * measureLength;
  // The clip's length is the user's own choice, not derived — audio is
  // rendered with enough whole loops to cover it (the last one simply cut
  // wherever the fixed clip length lands, same as under any social clip),
  // and the fractal's reveal is timed to that same exact length so it
  // finishes right as the clip ends.
  const totalSeconds = clipSeconds;
  const loops = loopsForDuration(loopSeconds, totalSeconds);
  const introSeconds = introSecondsFor(totalSeconds);

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
  // A fully-drawn snapshot of the current beat/background/style, rebuilt
  // once whenever any of those actually change (see the reset effect below)
  // rather than on every frame — the sforzando intro used to redraw every
  // point of every layer from scratch (up to 55,000 per layer) the instant
  // it started, which was slow enough on its own to feel like general
  // sluggishness — and, back when light mode composited per-point draws
  // with "multiply" instead of today's "source-over" (see fractalRender.ts),
  // 20-70x slower still, so real time had often already carried past the
  // whole intro window by the time that burst of drawing finished and the
  // flash it was supposed to show never actually got seen (or captured).
  // Entering the intro now just blits this cached image instead.
  const completeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  // The logo + wordmark, pre-drawn once per layout (aspect change) rather
  // than redrawn — a handful of fillText/measureText/roundRect calls —
  // every single animation frame; blitted with one drawImage instead.
  const logoCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const vfModuleRef = useRef<VF | null>(null);
  const revealSegmentRef = useRef(-1);
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
    style,
    bars,
    layers: beat.layers,
    bpm,
    layout,
    loopSeconds,
    measureLength,
    totalSeconds,
    introSeconds,
    lines,
    showLogo,
  });

  // Keeps paramsRef in sync with the latest render's reactive values. Runs
  // after every commit (no deps array) rather than during render, where
  // mutating a ref isn't allowed.
  useEffect(() => {
    paramsRef.current = {
      background,
      style,
      bars,
      layers: beat.layers,
      bpm,
      layout,
      loopSeconds,
      measureLength,
      totalSeconds,
      introSeconds,
      lines,
      showLogo,
    };
  });

  function resetReveal(bg: FractalBackground) {
    const canvas = revealCanvasRef.current;
    if (!canvas) return;
    const rctx = canvas.getContext("2d");
    if (!rctx) return;
    fillBackground(rctx, canvas.width, canvas.height, bg);
    rctx.globalCompositeOperation = bg === "dark" ? "lighter" : "source-over";
    drawnCountRef.current.clear();
  }

  // Rebuilds the cached "fully drawn" snapshot the sforzando intro blits
  // from — see completeCanvasRef above for why this is cached rather than
  // drawn fresh every time the intro segment starts.
  function rebuildCompleteSnapshot(bg: FractalBackground, sty: FractalStyle, layers: DrawParams["layers"]) {
    const revealCanvas = revealCanvasRef.current;
    if (!revealCanvas) return;
    if (!completeCanvasRef.current) completeCanvasRef.current = document.createElement("canvas");
    renderFrame(completeCanvasRef.current, revealCanvas.width, 1, bg, layers, dotScaleForStyle(sty));
  }

  // Rebuilds the cached logo+wordmark overlay — see logoCanvasRef above.
  function rebuildLogoCanvas(lay: FrameLayout, width: number, height: number) {
    if (!logoCanvasRef.current) logoCanvasRef.current = document.createElement("canvas");
    const lc = logoCanvasRef.current;
    lc.width = width;
    lc.height = height;
    const lctx = lc.getContext("2d");
    if (!lctx) return;
    lctx.clearRect(0, 0, width, height);
    drawLogo(lctx, lay.logoX, lay.logoY, lay.logoUnit);
    drawWordmark(lctx, lay.wordmarkX, lay.logoY + lay.logoUnit + lay.logoUnit * 0.11, lay.wordmarkFontPx);
  }

  // Re-renders one page of sheet music onto an offscreen canvas — async, so
  // tick() keeps showing whatever it already has until this resolves rather
  // than blocking a frame on it. Guarded by rasterizingPageRef so a page
  // that's already mid-render isn't kicked off again on every intervening
  // frame.
  async function rasterizePage(page: number, startBeat: number, numBeats: number) {
    if (rasterizingPageRef.current === page) return;
    rasterizingPageRef.current = page;
    try {
      if (!vfModuleRef.current) vfModuleRef.current = await import("vexflow");
      await document.fonts.ready;
      const area = paramsRef.current.layout.notationArea;
      const canvas = document.createElement("canvas");
      const notationLayout = renderNotationMeasureToCanvas(
        vfModuleRef.current,
        canvas,
        paramsRef.current.lines,
        startBeat,
        numBeats,
        Math.round(area.w)
      );
      sheetRasterRef.current = { page, canvas, layout: notationLayout };
    } catch {
      // Leaves sheetRasterRef showing the previous page (or nothing, on the
      // very first frame) rather than breaking the whole recording over a
      // rasterization hiccup — the fractal and audio still matter more than
      // the sheet-music overlay landing on the first try.
    } finally {
      rasterizingPageRef.current = null;
    }
  }

  // One animation frame: advances the fractal's time-lapse reveal, composites
  // the outer frame (dark chrome + fractal square + sheet-music card with
  // its playhead + corner logo), then schedules its own next call. This one
  // loop runs continuously from mount to unmount — see the mount effect
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

    // The fractal's reveal is a single continuous build spanning the whole
    // clip length, restarting fresh every `totalSeconds` — while idle this
    // just loops forever as a preview of what a take will look like; an
    // actual recording never lives to see a second cycle, since it stops
    // at exactly that same length (see below), landing right as the reveal
    // completes.
    //
    // Each cycle opens with a brief "sforzando": the piece already fully
    // formed, held for `introSeconds`, before clearing and building back up
    // from nothing over the rest of the cycle. Frame 0 of an actual
    // recording lands inside that opening window — see introSecondsFor —
    // so whichever early frame a platform picks as its thumbnail shows the
    // finished artwork rather than a blank canvas. Two segments per cycle
    // (intro, build), each entered exactly once, is what `segment` tracks;
    // `revealSegmentRef` remembers the last one actually drawn so a segment
    // already in progress isn't reset again on every intervening frame.
    const cycleIndex = Math.floor(elapsed / p.totalSeconds);
    const cycleElapsed = ((elapsed % p.totalSeconds) + p.totalSeconds) % p.totalSeconds;
    const inIntro = cycleElapsed < p.introSeconds;
    const segment = cycleIndex * 2 + (inIntro ? 0 : 1);
    if (segment !== revealSegmentRef.current) {
      revealSegmentRef.current = segment;
      resetReveal(p.background);
      if (inIntro) {
        // A plain blit of the cached snapshot (see completeCanvasRef)
        // instead of redrawing every point of every layer from scratch —
        // the whole reason this segment can transition into cleanly and
        // near-instantly rather than needing a moment (or, previously, more
        // than the entire intro window) to catch up.
        const snapshot = completeCanvasRef.current;
        if (snapshot) {
          revealCtx.globalCompositeOperation = "source-over";
          revealCtx.drawImage(snapshot, 0, 0);
          revealCtx.globalCompositeOperation = p.background === "dark" ? "lighter" : "source-over";
        }
        for (const layer of p.layers) drawnCountRef.current.set(layer.instrument, layer.pointCount);
      }
    }

    if (!inIntro) {
      const buildDuration = p.totalSeconds - p.introSeconds;
      const buildElapsed = cycleElapsed - p.introSeconds;
      const revealT = easeInOut(buildDuration > 0 ? buildElapsed / buildDuration : 1);
      const dotScale = dotScaleForStyle(p.style);
      for (const layer of p.layers) {
        const target = Math.floor(layer.pointCount * revealT);
        const already = drawnCountRef.current.get(layer.instrument) ?? 0;
        if (target > already) {
          drawLayer(revealCtx, revealCanvas.width, 1, layer, already, target, dotScale);
          drawnCountRef.current.set(layer.instrument, target);
        }
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
    // The sharp copy always goes down first, exactly as "classic" draws it —
    // revealCanvas is fully opaque (resetReveal fills it solid), so drawing
    // it a second time with plain source-over would completely overwrite
    // anything drawn before it, erasing rather than adding a halo. Bloom's
    // blurred copy goes on *after*, with a composite mode that only adds to
    // (dark: "lighter") or gently darkens (light: "multiply", reading as
    // ink softly bleeding outward rather than glowing, which flat ink never
    // does) what's already correctly there, instead of a mode that could
    // paint over it.
    cctx.drawImage(revealCanvas, f.x, f.y, f.w, f.h);
    if (p.style === "bloom") {
      cctx.save();
      cctx.filter = `blur(${Math.max(2, Math.round(f.w * 0.014))}px)`;
      if (p.background === "dark") {
        cctx.globalAlpha = 0.65;
        cctx.globalCompositeOperation = "lighter";
      } else {
        cctx.globalAlpha = 0.4;
        cctx.globalCompositeOperation = "multiply";
      }
      cctx.drawImage(revealCanvas, f.x, f.y, f.w, f.h);
      cctx.restore();
    }
    if (p.style === "vivid") {
      // The saturated, glowing end of the family — points are already
      // drawn bigger for this style (see dotScaleForStyle), and on top of
      // that a two-layer glow (a tight, bright inner pass and a wider,
      // softer outer one — a single blur reads flatter/blurrier rather than
      // "radiant") plus a saturation boost push the color itself toward
      // neon rather than just brightening it.
      cctx.save();
      cctx.filter = `blur(${Math.max(2, Math.round(f.w * 0.01))}px) saturate(190%)`;
      cctx.globalAlpha = p.background === "dark" ? 0.85 : 0.55;
      cctx.globalCompositeOperation = p.background === "dark" ? "lighter" : "multiply";
      cctx.drawImage(revealCanvas, f.x, f.y, f.w, f.h);
      cctx.filter = `blur(${Math.max(6, Math.round(f.w * 0.035))}px) saturate(190%)`;
      cctx.globalAlpha = p.background === "dark" ? 0.5 : 0.3;
      cctx.drawImage(revealCanvas, f.x, f.y, f.w, f.h);
      cctx.restore();
      // The saturation boost applies to the sharp copy underneath too, or
      // the glow reads more vivid than the lines it's supposedly coming
      // from.
      cctx.save();
      cctx.filter = "saturate(190%)";
      cctx.globalCompositeOperation = p.background === "dark" ? "lighter" : "multiply";
      cctx.globalAlpha = p.background === "dark" ? 0.5 : 0.35;
      cctx.drawImage(revealCanvas, f.x, f.y, f.w, f.h);
      cctx.restore();
    }
    if (p.style === "prism") {
      // A handful of copies, each nudged a few pixels apart and hue-shifted,
      // layered on with a non-erasing blend the same way bloom's glow is —
      // chromatic-aberration fringing around every edge, the "double
      // vision, everything's got a rainbow edge" effect the name is going
      // for. Ink doesn't literally refract color, so light mode reads it
      // instead as slightly-misregistered print plates — a different but
      // equally legible metaphor for the same shifted-copies technique.
      const shift = Math.max(2, Math.round(f.w * 0.009));
      const passes: { dx: number; dy: number; hue: number }[] = [
        { dx: -shift, dy: 0, hue: -40 },
        { dx: shift, dy: 0, hue: 40 },
        { dx: 0, dy: -shift, hue: 120 },
      ];
      cctx.save();
      cctx.globalCompositeOperation = p.background === "dark" ? "lighter" : "multiply";
      cctx.globalAlpha = p.background === "dark" ? 0.55 : 0.32;
      for (const pass of passes) {
        cctx.filter = `hue-rotate(${pass.hue}deg) saturate(200%)`;
        cctx.drawImage(revealCanvas, f.x + pass.dx, f.y + pass.dy, f.w, f.h);
      }
      cctx.restore();
    }
    if (p.style === "vignette") {
      // A soft radial darkening toward the edges reads as more "poster,"
      // less "raw plot" — subtle on light (ink already provides its own
      // contrast) and a bit stronger on dark (glow) where the frame's edges
      // otherwise fade into the outer chrome with nothing to separate them.
      const cx = f.x + f.w / 2;
      const cy = f.y + f.h / 2;
      const outer = f.w * 0.72;
      const vg = cctx.createRadialGradient(cx, cy, f.w * 0.32, cx, cy, outer);
      const edgeAlpha = p.background === "dark" ? 0.55 : 0.2;
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, `rgba(0,0,0,${edgeAlpha})`);
      cctx.fillStyle = vg;
      cctx.fillRect(f.x, f.y, f.w, f.h);
    }
    cctx.restore();
    cctx.strokeStyle = "rgba(255,255,255,0.12)";
    cctx.lineWidth = Math.max(1, canvas.width * 0.0018);
    cctx.stroke();

    // Sheet music: which bar is "now" — tracked off the *music's* own bar
    // length, completely independent of the (much longer) fractal reveal
    // cycle above; same elapsed clock, different modulus. Rasterize the
    // current page if it's not already cached, then draw the cached
    // snapshot plus a live playhead highlight over it.
    const beatSeconds = 60 / p.bpm;
    const audioWithinLoop = ((elapsed % p.loopSeconds) + p.loopSeconds) % p.loopSeconds;
    const currentBeat = Math.min(p.measureLength - 1, Math.max(0, Math.floor(audioWithinLoop / beatSeconds)));
    const { page, startBeat, numBeats, localBeat } = pageForBeat(p.bars, currentBeat);

    const s = p.layout.sheet;
    cctx.fillStyle = "#ffffff";
    cctx.beginPath();
    cctx.roundRect(s.x, s.y, s.w, s.h, s.w * 0.025);
    cctx.fill();

    const raster = sheetRasterRef.current;
    if (!raster || raster.page !== page) {
      void rasterizePage(page, startBeat, numBeats);
    }
    if (raster) {
      const area = p.layout.notationArea;
      const drawScale = Math.min(area.w / raster.layout.width, area.h / raster.layout.height, 1);
      const drawW = raster.layout.width * drawScale;
      const drawH = raster.layout.height * drawScale;
      const drawX = area.x + (area.w - drawW) / 2;
      const drawY = area.y;
      cctx.drawImage(raster.canvas, drawX, drawY, drawW, drawH);

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

    if (p.showLogo && logoCanvasRef.current) cctx.drawImage(logoCanvasRef.current, 0, 0);

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

  // (Re)sizes the two canvases, rebuilds both caches (see completeCanvasRef
  // and logoCanvasRef), and starts a fresh reveal cycle whenever anything
  // that changes what should actually be on screen changes: aspect ratio
  // and clip length affect layout/timing directly; background, style, and
  // the beat itself all affect what the cached snapshot needs to show.
  // bpm/measureLength don't affect any of that and flow into the already-
  // running loop purely through paramsRef instead of resetting anything.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = size.width;
    canvas.height = size.height;
    if (!revealCanvasRef.current) revealCanvasRef.current = document.createElement("canvas");
    revealCanvasRef.current.width = layout.fractal.w;
    revealCanvasRef.current.height = layout.fractal.h;
    resetReveal(background);
    rebuildCompleteSnapshot(background, style, beat.layers);
    rebuildLogoCanvas(layout, size.width, size.height);
    revealSegmentRef.current = -1;
    sheetRasterRef.current = null;
    startTimeRef.current = performance.now() / 1000;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aspect, background, clipSeconds, style, beat]);

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
    if (!format || busy) return;
    setErrorMessage(null);
    setResult(null);

    try {
      const lineStates: LineState[] = lines.map((l) => ({ instrument: l.instrument, blocks: l.blocks, volume: l.volume }));
      const buffer = await renderSongToBuffer(lineStates, bpm, measureLength, loops, kit, customSamples, bassline, "full");

      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      // Pinned to the exact rate `buffer` was rendered at (see
      // RENDER_SAMPLE_RATE) rather than left to default to the device's own
      // output rate (often 48000Hz) — a mismatch here still plays back fine
      // live, but piping it through MediaStreamAudioDestinationNode into
      // MediaRecorder's AAC encoder at a mismatched rate is what produces
      // audio that decodes fast and glitchy once a platform re-transcodes
      // the upload (TikTok, notably).
      const audioCtx = new AC({ sampleRate: RENDER_SAMPLE_RATE });
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
      recorder.onerror = (e) => {
        // MediaRecorder failing mid-take otherwise fails silently — this
        // was previously the most likely cause of "the video doesn't seem
        // to be rendering correctly": no error surfaced, so a broken take
        // still landed in the normal "done" state with whatever partial
        // data had been collected instead of a clear failure.
        recordingRef.current = false;
        stoppingRef.current = false;
        videoStream.getVideoTracks().forEach((t) => t.stop());
        // Calling stop() on a source that's already ended (naturally,
        // or from a prior stop()) shouldn't throw per spec, but if some
        // implementation disagrees, an uncaught throw here would abort
        // the rest of this handler — including the setPhase call below
        // that gets the UI out of "recording" — leaving it stuck with
        // no visible error rather than just skipping a no-op cleanup step.
        try {
          source.stop();
        } catch {
          // Already stopped — nothing left to do.
        }
        audioCtxRef.current?.close().catch(() => {});
        audioCtxRef.current = null;
        setPhase("error");
        // The runtime delivers a MediaRecorderErrorEvent (.error is a
        // DOMException) here, but TS's DOM lib still types this handler's
        // event as a plain ErrorEvent — and DOMException isn't an Error
        // subclass, so check for `.message` directly rather than
        // `instanceof Error`, which would silently never match.
        const message = typeof e.error?.message === "string" ? e.error.message : undefined;
        setErrorMessage(message ? `Recording failed: ${message}` : "Recording failed partway through.");
      };
      recorder.onstop = async () => {
        videoStream.getVideoTracks().forEach((t) => t.stop());
        // Calling stop() on a source that's already ended (naturally,
        // or from a prior stop()) shouldn't throw per spec, but if some
        // implementation disagrees, an uncaught throw here would abort
        // the rest of this handler — including the setPhase call below
        // that gets the UI out of "recording" — leaving it stuck with
        // no visible error rather than just skipping a no-op cleanup step.
        try {
          source.stop();
        } catch {
          // Already stopped — nothing left to do.
        }
        audioCtxRef.current?.close().catch(() => {});
        audioCtxRef.current = null;
        // Hand the loop back to idle preview, from a fresh cycle rather
        // than whatever the recording's last frame happened to look like.
        recordingRef.current = false;
        stoppingRef.current = false;
        revealSegmentRef.current = -1;
        sheetRasterRef.current = null;
        resetReveal(paramsRef.current.background);
        startTimeRef.current = performance.now() / 1000;

        const blob = new Blob(chunks, { type: format.mimeType });
        // A properly-encoded clip at these bitrates should land well north
        // of ~40KB per second of clip length even in the least favorable
        // case (a mostly-static frame, minimal audio) — a file far under
        // that is the signature of a MediaRecorder session that produced
        // almost no real frame data (seen in testing when a tab loses
        // foreground focus mid-recording, which throttles/suppresses
        // canvas.captureStream — captureStream's frames tie into actual
        // browser compositing, not just script execution, so this can
        // happen even while tick() itself keeps running normally). Catching
        // it here means the user gets a clear "try again" instead of a
        // silently-broken "done" state with an unplayable download.
        const minBytes = 40_000 * paramsRef.current.totalSeconds;
        if (blob.size < minBytes) {
          setPhase("error");
          setErrorMessage(
            "The recording came out empty or too short — this usually happens if the browser tab lost focus " +
              "while recording. Keep this tab visible and in the foreground for the whole clip, then try again."
          );
          return;
        }

        // MP4 out of MediaRecorder is always a fragmented MP4 whose leading
        // moov carries no duration (true in every Chromium/WebKit build,
        // independent of the timeslice above) — harmless to a lenient local
        // player, but it's what makes TikTok's own re-encode truncate the
        // audio to a couple of seconds or play it back sped up. Fix the
        // container (stream copy, not a re-encode — the actual audio/video
        // bitstream is untouched) before this ever reaches the user. See
        // remuxVideo.ts. Skipped for webm, which doesn't have this problem.
        let finalBlob = blob;
        if (format.extension === "mp4") {
          setPhase("processing");
          setProgress(0);
          const { fixMp4Duration } = await import("@/lib/remuxVideo");
          finalBlob = await fixMp4Duration(blob, (fraction) => setProgress(fraction));
        }

        const url = URL.createObjectURL(finalBlob);
        setResult({ url, extension: format.extension, sizeBytes: finalBlob.size });
        setPhase("done");
      };
      recorderRef.current = recorder;

      // Fresh take: reset every piece of per-cycle state so the recording
      // always opens on an empty canvas at reveal 0, in lockstep with the
      // audio's own first sample. tick() is already running (see the mount
      // effect) and picks all of this up on its very next scheduled frame.
      revealSegmentRef.current = -1;
      sheetRasterRef.current = null;
      resetReveal(background);
      startTimeRef.current = audioCtx.currentTime;
      recordingRef.current = true;
      stoppingRef.current = false;
      setPhase("recording");
      setProgress(0);

      // A timeslice (rather than the argument-less recorder.start(), which
      // only ever flushes once — at stop()) is what makes this reliable:
      // without one, a session that stops (or errors) before that single
      // flush has actually fired hands back zero data and looks, from the
      // UI's perspective, exactly like a normal completed recording. With
      // one, most of the clip is already safely captured in earlier chunks
      // by the time stop() is called. (This was briefly suspected of
      // causing the fast/glitchy TikTok audio itself — it isn't: Chromium
      // produces a fragmented MP4 with no duration in its leading moov
      // either way, timeslice or not. See remuxVideo.ts for the real fix.)
      recorder.start(250);
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
                disabled={busy}
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
                disabled={busy}
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
                disabled={busy}
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
                disabled={busy}
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

            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setStyle("classic")}
                className={[
                  "rounded-full border px-3 py-1 text-xs font-medium transition disabled:opacity-40",
                  style === "classic"
                    ? "border-yellow-400 bg-yellow-400/20 text-yellow-300"
                    : "border-white/15 bg-white/5 text-white/70 hover:border-yellow-400 hover:text-yellow-400",
                ].join(" ")}
              >
                Classic
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setStyle("bloom")}
                title="A soft blurred halo behind the artwork"
                className={[
                  "rounded-full border px-3 py-1 text-xs font-medium transition disabled:opacity-40",
                  style === "bloom"
                    ? "border-yellow-400 bg-yellow-400/20 text-yellow-300"
                    : "border-white/15 bg-white/5 text-white/70 hover:border-yellow-400 hover:text-yellow-400",
                ].join(" ")}
              >
                Bloom
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setStyle("vignette")}
                title="Darkened edges for a more poster-like look"
                className={[
                  "rounded-full border px-3 py-1 text-xs font-medium transition disabled:opacity-40",
                  style === "vignette"
                    ? "border-yellow-400 bg-yellow-400/20 text-yellow-300"
                    : "border-white/15 bg-white/5 text-white/70 hover:border-yellow-400 hover:text-yellow-400",
                ].join(" ")}
              >
                Vignette
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setStyle("vivid")}
                title="Bigger, glowing, more saturated — a vibrant, neon-leaning look"
                className={[
                  "rounded-full border px-3 py-1 text-xs font-medium transition disabled:opacity-40",
                  style === "vivid"
                    ? "border-yellow-400 bg-yellow-400/20 text-yellow-300"
                    : "border-white/15 bg-white/5 text-white/70 hover:border-yellow-400 hover:text-yellow-400",
                ].join(" ")}
              >
                Vivid
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setStyle("prism")}
                title="Rainbow-fringed, trippy chromatic-shift copies"
                className={[
                  "rounded-full border px-3 py-1 text-xs font-medium transition disabled:opacity-40",
                  style === "prism"
                    ? "border-yellow-400 bg-yellow-400/20 text-yellow-300"
                    : "border-white/15 bg-white/5 text-white/70 hover:border-yellow-400 hover:text-yellow-400",
                ].join(" ")}
              >
                Prism
              </button>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="clip-length" className="text-xs text-white/60">
                Clip length
              </label>
              <input
                id="clip-length"
                type="range"
                min={MIN_CLIP_SECONDS}
                max={MAX_CLIP_SECONDS}
                step={1}
                value={clipSeconds}
                disabled={busy}
                onChange={(e) => setClipSeconds(Number(e.target.value))}
                className="w-32 accent-yellow-400 disabled:opacity-40"
              />
              <span className="w-8 text-xs text-white/80">{clipSeconds}s</span>
            </div>

            <label className="flex items-center gap-2 text-xs text-white/60">
              <input
                type="checkbox"
                checked={showLogo}
                disabled={busy}
                onChange={(e) => setShowLogo(e.target.checked)}
                className="accent-yellow-400 disabled:opacity-40"
              />
              Show RockBlocks logo
            </label>

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
              Time-lapse over {clipSeconds}s · ~{loops} audio loop{loops === 1 ? "" : "s"} · {format?.extension.toUpperCase()}
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
            ) : phase === "processing" ? (
              <div className="flex w-full flex-col items-center gap-2">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full bg-yellow-400 transition-[width]"
                    style={{ width: `${Math.round(progress * 100)}%` }}
                  />
                </div>
                <p className="text-sm text-white/60">Preparing for TikTok/Reels upload…</p>
              </div>
            ) : (
              <button
                type="button"
                disabled={beat.layers.length === 0}
                onClick={startRecording}
                className="rounded-full bg-yellow-400 px-6 py-2 font-bold text-slate-900 transition hover:bg-yellow-300 disabled:opacity-30"
              >
                ● Record {clipSeconds}s clip
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
    </div>
  );
}
