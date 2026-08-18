// Generates a RockBlocks beat for a fixed, simple kit — bass drum, snare,
// and closed hi-hat — with a random measure length and random rhythm tiles
// (including tiles with some hits toggled to rests) filling each beat.
//
// The first instrument (bass drum) is the anchor: its rhythm is rolled with
// no outside influence. Every other line then reacts to how busy that
// anchor turned out to be — real drumming is about sharing space, so a
// packed anchor (a running sixteenth-note kick, say) pushes the rest of the
// kit toward sparser, simpler blocks, while a sparse anchor leaves room for
// other lines to be busier, instead of every line independently rolling the
// same chaotic odds.
//
// A single 1-10 "complexity" dial (see paramsForComplexity) drives how wild
// the whole thing gets: how much the measure length varies, whether triplet
// tiles are in play at all, how dense/steady the anchor is, and how much
// jitter the reactive lines get. It's one knob rather than four so it stays
// simple to reason about and tune; it can't separately express "busy but
// predictable" vs. "sparse but wild" since those collapse onto one axis —
// if that distinction turns out to matter, split it into two dials later.
import { InstrumentId } from "./instruments";
import { NOTE_TILES, RhythmHit, RhythmTile, TRIPLET_TILES, tileFromHits } from "./rhythm";
import { DEFAULT_VOLUME, LineData, MAX_BEATS } from "./song";

export const MIN_COMPLEXITY = 1;
export const MAX_COMPLEXITY = 10;
export const DEFAULT_COMPLEXITY = 5;

export interface RandomBeatOptions {
  // Which instruments to generate, in order — the first is the anchor line
  // (see reactiveProbabilities). Kept to a fixed, simple core for now rather
  // than randomizing which instruments show up.
  instruments: InstrumentId[];
  // 1 (steady/plain) to 10 (chaotic) — see paramsForComplexity.
  complexity: number;
}

export const DEFAULT_RANDOM_BEAT_OPTIONS: RandomBeatOptions = {
  instruments: ["kick", "snare", "hihatClosed"],
  complexity: DEFAULT_COMPLEXITY,
};

// The busiest tile in the catalog (t-s6: six sixteenth-triplets) — used to
// normalize a line's raw hits-per-beat into a 0..1 "busyness" reading.
const MAX_NOTE_HITS_PER_BEAT = 6;
// How strongly other lines' density responds to the anchor's, before
// jitter — 1 would be perfectly inverse (anchor maxed out drives everyone
// else to the sparsest floor); pulled back slightly so a very busy anchor
// still leaves other lines a little room rather than going dead silent.
const REACTIVITY = 0.85;

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp01(t);
}

// Piecewise-linear interpolation across explicit (complexity, value) control
// points — e.g. [[1, 0.05], [7, 0.15], [10, 0.32]] holds 0.05 at complexity
// 1, 0.15 at 7 (calibrated to match the original shipped defaults), and
// climbs further to 0.32 by 10. Keeping each parameter as its own small
// table of control points (rather than one formula) is what lets "5 should
// feel plain" and "7 should match what's live today" both hold exactly,
// instead of fighting a single curve to hit two unrelated targets.
function scaleByComplexity(complexity: number, points: [number, number][]): number {
  const c = Math.min(points[points.length - 1][0], Math.max(points[0][0], complexity));
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    if (c >= x0 && c <= x1) return lerp(y0, y1, x1 === x0 ? 0 : (c - x0) / (x1 - x0));
  }
  return points[points.length - 1][1];
}

interface ComplexityParams {
  minBlocks: number;
  maxBlocks: number;
  emptyBlockProbability: number;
  hitRestProbability: number;
  tripletProbability: number;
  reactivityJitter: number;
}

// Complexity 7 is calibrated to reproduce the original shipped defaults
// (3-7 blocks, 0.15/0.3 empty/rest, the full straight+triplet catalog drawn
// uniformly — which works out to ~62% triplet tiles since triplets
// outnumber straight tiles in the catalog 13-to-8) — the level the app
// shipped with before this dial existed. 5 sits below that: a plain, steady
// groove. 10 pushes past 7 into real chaos.
function paramsForComplexity(complexity: number): ComplexityParams {
  return {
    minBlocks: Math.round(scaleByComplexity(complexity, [[1, 4], [7, 3], [10, 3]])),
    maxBlocks: Math.round(scaleByComplexity(complexity, [[1, 4], [7, 7], [10, 7]])),
    emptyBlockProbability: scaleByComplexity(complexity, [[1, 0.05], [5, 0.12], [7, 0.15], [10, 0.32]]),
    hitRestProbability: scaleByComplexity(complexity, [[1, 0.08], [5, 0.18], [7, 0.3], [10, 0.48]]),
    tripletProbability: scaleByComplexity(complexity, [[1, 0], [3, 0], [7, 0.62], [10, 0.75]]),
    reactivityJitter: scaleByComplexity(complexity, [[1, 0.05], [7, 0.25], [10, 0.4]]),
  };
}

function randomTile(hitRestProbability: number, tripletProbability: number): RhythmTile {
  const pool = Math.random() < tripletProbability ? TRIPLET_TILES : NOTE_TILES;
  const base = pool[Math.floor(Math.random() * pool.length)];
  const hits: RhythmHit[] = base.hits.map((h) => ({
    ...h,
    type: Math.random() < hitRestProbability ? "rest" : "note",
  }));
  return tileFromHits(hits);
}

function randomLineId(index: number): string {
  return `line-${index}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildLine(
  instrument: InstrumentId,
  index: number,
  blockCount: number,
  emptyBlockProbability: number,
  hitRestProbability: number,
  tripletProbability: number
): LineData {
  const blocks: (RhythmTile | null)[] = Array(MAX_BEATS).fill(null);
  for (let i = 0; i < blockCount; i++) {
    if (Math.random() < emptyBlockProbability) continue;
    blocks[i] = randomTile(hitRestProbability, tripletProbability);
  }
  return { id: randomLineId(index), instrument, blocks, volume: DEFAULT_VOLUME };
}

// Average note hits per beat over the blocks actually in use — the raw
// "how busy is this line" measurement other lines react to.
function lineNoteDensity(blocks: (RhythmTile | null)[], blockCount: number): number {
  let noteHits = 0;
  for (let i = 0; i < blockCount; i++) {
    const tile = blocks[i];
    if (!tile) continue;
    for (const h of tile.hits) if (h.type === "note") noteHits++;
  }
  return blockCount > 0 ? noteHits / blockCount : 0;
}

// The "share the space" rule: derives another line's fill probabilities from
// the anchor's density rather than reusing the same odds independently —
// otherwise every line rolls the same chaotic dice and they frequently all
// land busy (or all land sparse) together instead of trading off.
function reactiveProbabilities(
  anchorDensity: number,
  jitterMagnitude: number
): { emptyBlockProbability: number; hitRestProbability: number } {
  const anchorBusyness = clamp01(anchorDensity / MAX_NOTE_HITS_PER_BEAT);
  const jitter = (Math.random() - 0.5) * jitterMagnitude;
  const targetBusyness = clamp01(1 - anchorBusyness * REACTIVITY + jitter);
  return {
    emptyBlockProbability: lerp(0.55, 0.05, targetBusyness),
    hitRestProbability: lerp(0.55, 0.1, targetBusyness),
  };
}

export function generateRandomBeat(options: Partial<RandomBeatOptions> = {}): LineData[] {
  const opts = { ...DEFAULT_RANDOM_BEAT_OPTIONS, ...options };
  const params = paramsForComplexity(opts.complexity);
  const blockCount = randomInt(params.minBlocks, params.maxBlocks);
  const instruments = opts.instruments;
  if (instruments.length === 0) return [];

  const anchor = buildLine(
    instruments[0],
    0,
    blockCount,
    params.emptyBlockProbability,
    params.hitRestProbability,
    params.tripletProbability
  );
  const anchorDensity = lineNoteDensity(anchor.blocks, blockCount);

  const lines: LineData[] = [anchor];
  for (let i = 1; i < instruments.length; i++) {
    const { emptyBlockProbability, hitRestProbability } = reactiveProbabilities(anchorDensity, params.reactivityJitter);
    lines.push(buildLine(instruments[i], i, blockCount, emptyBlockProbability, hitRestProbability, params.tripletProbability));
  }

  // computeMeasureLength derives the beat's length from the last filled
  // block across all lines, not from blockCount directly — if every line
  // happened to roll "empty" at the final beat, the measure would silently
  // come out shorter than intended. Force one line to land a tile there.
  const reachesBlockCount = lines.some((l) => l.blocks[blockCount - 1]);
  if (!reachesBlockCount) {
    const forced = lines[randomInt(0, lines.length - 1)];
    forced.blocks[blockCount - 1] = randomTile(params.hitRestProbability, params.tripletProbability);
  }

  return lines;
}
