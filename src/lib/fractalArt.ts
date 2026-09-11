import type { InstrumentId } from "./instruments";
import { INSTRUMENTS } from "./instruments";
import type { RhythmTile } from "./rhythm";

// Turns any RockBlocks beat into deterministic generative art: the same
// beat always renders the same image, and no two rhythms render the same
// one. One layer per instrument that actually plays, each a de Jong
// strange attractor — x' = sin(a·y) - cos(b·x), y' = sin(c·x) - cos(d·y) —
// seeded by hashing that instrument's per-block hit pattern with the
// beat's tempo and length. Layers are colored with the instrument's own
// swatch (INSTRUMENTS[].hex, the same one used everywhere else in the app)
// and composited with additive blending.
//
// Point count and per-point opacity both scale with that layer's hit
// density: a sparse part draws a few bold points in open space, a busy
// part fills the frame, and an instrument that never plays is skipped
// entirely — real negative space, not a faint trace. The one exception is
// numerical, not musical: a de Jong map sometimes settles into a small
// periodic orbit — a handful of positions revisited forever — for reasons
// specific to that a/b/c/d draw, not the beat. More iterations never fixes
// it (see occupiedCells below), so it would render as a scatter of dots
// and read as broken rather than sparse. That case (and only that case)
// gets a deterministic nudge to the next seed variant, capped at six
// tries — a genuinely sparse layer, which spreads across just as many
// cells as a dense one, is never touched by it.

export interface FractalLayer {
  instrument: InstrumentId;
  hex: string;
  pattern: number[];
  totalHits: number;
  density: number; // 0-1, totalHits relative to a generous per-block max
  params: { a: number; b: number; c: number; d: number };
  points: Float32Array; // x0,y0, x1,y1, ...
  pointCount: number;
  alpha: number;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  // What actually produced `params`, for a "show your work" view — the seed
  // string that got hashed (before any nudge) and how many seed variants it
  // took to clear MIN_OCCUPIED_CELLS (1 means the first draw was already
  // fine).
  seed: string;
  tries: number;
}

export interface FractalBeat {
  beats: number;
  bpm: number;
  layers: FractalLayer[]; // only instruments with at least one hit
  silentInstruments: InstrumentId[]; // present in the beat but never hit
}

// Generous ceiling on hits a single block's tile can hold (straight tiles
// top out at 4 sixteenths; triplet tiles can reach 6) — used only to
// normalize density into 0-1, so an unusually dense block never pushes it
// past 1.
const MAX_HITS_PER_BLOCK = 6;

const MIN_POINTS = 3000;
const MAX_POINTS = 55000;
const MIN_ALPHA = 0.04;
const MAX_ALPHA = 0.09;
const MAX_SEED_TRIES = 6;

// How "filled in" an attractor is, independent of how many points were
// computed: bin points into a coarse grid and count occupied cells. A
// genuine curve/chaotic attractor spreads across a large, roughly stable
// fraction of cells even at a few thousand points; a periodic orbit visits
// only as many distinct positions as its period, however many iterations
// you run — more points never fixes it, only different a/b/c/d do. Tested
// against 500 random parameter draws: attractors below this threshold stay
// that way at 50,000 points, and attractors above it are already rich at
// 3,000.
const OCCUPANCY_GRID = 24;
const MIN_OCCUPIED_CELLS = 40;

function occupiedCells(points: Float32Array, n: number, bounds: { minX: number; maxX: number; minY: number; maxY: number }): number {
  const w = bounds.maxX - bounds.minX || 1e-6;
  const h = bounds.maxY - bounds.minY || 1e-6;
  const grid = new Uint8Array(OCCUPANCY_GRID * OCCUPANCY_GRID);
  let occupied = 0;
  for (let i = 0; i < n; i++) {
    const gx = Math.min(OCCUPANCY_GRID - 1, Math.max(0, ((points[i * 2] - bounds.minX) / w) * OCCUPANCY_GRID | 0));
    const gy = Math.min(OCCUPANCY_GRID - 1, Math.max(0, ((points[i * 2 + 1] - bounds.minY) / h) * OCCUPANCY_GRID | 0));
    const idx = gy * OCCUPANCY_GRID + gx;
    if (!grid[idx]) {
      grid[idx] = 1;
      occupied++;
    }
  }
  return occupied;
}

function hashSeed(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  h ^= h >>> 16;
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return function () {
    t |= 0;
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function paramsFromSeed(seedBase: string): { a: number; b: number; c: number; d: number } {
  const rand = mulberry32(hashSeed(seedBase));
  return { a: rand() * 6 - 3, b: rand() * 6 - 3, c: rand() * 6 - 3, d: rand() * 6 - 3 };
}

function computePoints(
  p: { a: number; b: number; c: number; d: number },
  n: number,
  burnIn: number
): { points: Float32Array; bounds: { minX: number; maxX: number; minY: number; maxY: number } } {
  let x = 0.1;
  let y = 0.1;
  for (let i = 0; i < burnIn; i++) {
    const bx = Math.sin(p.a * y) - Math.cos(p.b * x);
    const by = Math.sin(p.c * x) - Math.cos(p.d * y);
    x = bx;
    y = by;
  }
  const points = new Float32Array(n * 2);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    const nx = Math.sin(p.a * y) - Math.cos(p.b * x);
    const ny = Math.sin(p.c * x) - Math.cos(p.d * y);
    x = nx;
    y = ny;
    points[i * 2] = x;
    points[i * 2 + 1] = y;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { points, bounds: { minX, maxX, minY, maxY } };
}

// Total "note" hits per block for one instrument, summed across every line
// using it — mirrors countHitsForInstrument in MathLessonWorkspace.tsx, the
// app's other place that counts real placed hits rather than beat blocks.
export function patternForInstrument(
  lines: { instrument: InstrumentId; blocks: (RhythmTile | null)[] }[],
  instrument: InstrumentId,
  beats: number
): number[] {
  const pattern = new Array(beats).fill(0) as number[];
  for (const line of lines) {
    if (line.instrument !== instrument) continue;
    for (let i = 0; i < beats && i < line.blocks.length; i++) {
      const tile = line.blocks[i];
      if (!tile) continue;
      pattern[i] += tile.hits.filter((h) => h.type === "note").length;
    }
  }
  return pattern;
}

function renderLayer(instrument: InstrumentId, hex: string, pattern: number[], beats: number, bpm: number): FractalLayer {
  const totalHits = pattern.reduce((s, v) => s + v, 0);
  const density = Math.min(1, totalHits / (beats * MAX_HITS_PER_BLOCK));
  const pointCount = Math.round(MIN_POINTS + density * (MAX_POINTS - MIN_POINTS));
  const alpha = MAX_ALPHA - density * (MAX_ALPHA - MIN_ALPHA);

  const seedBase = `${instrument}:${pattern.join(",")}:${bpm}:${beats}`;
  let params = paramsFromSeed(seedBase);
  let result = computePoints(params, pointCount, 120);
  let tries = 1;
  while (tries < MAX_SEED_TRIES && occupiedCells(result.points, pointCount, result.bounds) < MIN_OCCUPIED_CELLS) {
    params = paramsFromSeed(`${seedBase}:alt${tries}`);
    result = computePoints(params, pointCount, 120);
    tries++;
  }

  return {
    instrument,
    hex,
    pattern,
    totalHits,
    density,
    params,
    points: result.points,
    pointCount,
    alpha,
    bounds: result.bounds,
    seed: seedBase,
    tries,
  };
}

// The full deterministic conversion: a beat's lines (already-decoded tiles,
// same shape as Editor.tsx's live `lines` state) into one attractor layer
// per instrument that has at least one hit within the first `beats` blocks
// (the beat's actual length/time signature — pass computeMeasureLength's
// result, not the grid's visible width). Silent instruments are reported
// separately so a caller can show them as explicitly absent rather than
// just missing.
export function computeFractalBeat(
  lines: { instrument: InstrumentId; blocks: (RhythmTile | null)[] }[],
  beats: number,
  bpm: number
): FractalBeat {
  const present = INSTRUMENTS.filter((inst) => lines.some((l) => l.instrument === inst.id));
  const layers: FractalLayer[] = [];
  const silentInstruments: InstrumentId[] = [];

  for (const inst of present) {
    const pattern = patternForInstrument(lines, inst.id, beats);
    const totalHits = pattern.reduce((s, v) => s + v, 0);
    if (totalHits === 0) {
      silentInstruments.push(inst.id);
      continue;
    }
    layers.push(renderLayer(inst.id, inst.hex, pattern, beats, bpm));
  }

  return { beats, bpm, layers, silentInstruments };
}
