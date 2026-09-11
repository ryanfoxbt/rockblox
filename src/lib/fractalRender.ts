import type { FractalLayer } from "./fractalArt";

export type FractalBackground = "dark" | "light";

export function hexToRgb(hex: string): [number, number, number] {
  const v = parseInt(hex.replace("#", ""), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

// Draws one layer's points (or, for a progressive "coming alive" reveal, the
// `[from, to)` slice of them — the rest were already drawn on a previous
// frame and are left alone rather than redrawn) into whatever's already on
// the canvas. Both callers rely on that: FractalArtView draws every point in
// one pass every time (from=0), the video exporter draws only each frame's
// newly-revealed points onto a canvas it never clears mid-reveal — additive
// ("lighter") and multiply blending are both order-independent, so drawing
// the same points split across many calls looks identical to one big call.
export function drawLayer(
  ctx: CanvasRenderingContext2D,
  size: number,
  dpr: number,
  layer: FractalLayer,
  from = 0,
  to: number = layer.pointCount
) {
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
  for (let i = from; i < to; i++) {
    const px = layer.points[i * 2] * scale + offX;
    const py = layer.points[i * 2 + 1] * scale + offY;
    ctx.fillRect(px * dpr, py * dpr, dot, dot);
  }
  ctx.globalAlpha = 1;
}

// Fills the background only — split out from renderFrame so the video
// exporter's incremental reveal can lay this down once per loop restart
// without also having to redraw (and thus re-specify point ranges for)
// every layer at the same time.
export function fillBackground(ctx: CanvasRenderingContext2D, width: number, height: number, background: FractalBackground) {
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = background === "dark" ? "#000" : "#fff";
  ctx.fillRect(0, 0, width, height);
}

// Draws one full frame (background fill + every layer, completely) for a
// given presentation. "lighter" (additive) only shows up against black —
// every added point pushes toward white, so on a white canvas it's already
// maxed out and invisible. Light needs the opposite: "multiply", which
// starts a point at its own true color on blank white and darkens further
// wherever points overlap — ink layering instead of a glow.
export function renderFrame(
  canvas: HTMLCanvasElement,
  size: number,
  dpr: number,
  background: FractalBackground,
  layers: FractalLayer[]
) {
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  fillBackground(ctx, canvas.width, canvas.height, background);
  ctx.globalCompositeOperation = background === "dark" ? "lighter" : "multiply";
  for (const layer of layers) drawLayer(ctx, size, dpr, layer);
}
