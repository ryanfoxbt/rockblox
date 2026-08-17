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
import { InstrumentId } from "./instruments";
import { NOTE_TILES, RhythmHit, RhythmTile, TRIPLET_TILES, tileFromHits } from "./rhythm";
import { DEFAULT_VOLUME, LineData, MAX_BEATS } from "./song";

export interface RandomBeatOptions {
  // Which instruments to generate, in order — the first is the anchor line
  // (see reactiveProbabilities). Kept to a fixed, simple core for now rather
  // than randomizing which instruments show up.
  instruments: InstrumentId[];
  minBlocks: number;
  maxBlocks: number;
  // Chance a given beat is left completely empty (no tile at all) on the
  // anchor line. Other lines derive their own odds from the anchor's
  // resulting density instead of using this directly — see reactiveProbabilities.
  emptyBlockProbability: number;
  // Chance any single hit within a placed tile is silenced to a rest, on the
  // anchor line — see emptyBlockProbability above for why other lines differ.
  hitRestProbability: number;
}

export const DEFAULT_RANDOM_BEAT_OPTIONS: RandomBeatOptions = {
  instruments: ["kick", "snare", "hihatClosed"],
  minBlocks: 3,
  maxBlocks: MAX_BEATS,
  emptyBlockProbability: 0.15,
  hitRestProbability: 0.3,
};

const RANDOM_TILE_CATALOG: RhythmTile[] = [...NOTE_TILES, ...TRIPLET_TILES];

// The busiest tile in the catalog (t-s6: six sixteenth-triplets) — used to
// normalize a line's raw hits-per-beat into a 0..1 "busyness" reading.
const MAX_NOTE_HITS_PER_BEAT = 6;
// How strongly other lines' density responds to the anchor's, before jitter
// — 1 would be perfectly inverse (anchor maxed out drives everyone else to
// the sparsest floor); pulled back slightly so a very busy anchor still
// leaves other lines a little room rather than going dead silent.
const REACTIVITY = 0.85;
// Random spread mixed into each reacting line's target busyness so they
// don't all land on exactly the same density and feel mechanical.
const REACTIVITY_JITTER = 0.25;

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp01(t);
}

function randomTile(hitRestProbability: number): RhythmTile {
  const base = RANDOM_TILE_CATALOG[Math.floor(Math.random() * RANDOM_TILE_CATALOG.length)];
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
  hitRestProbability: number
): LineData {
  const blocks: (RhythmTile | null)[] = Array(MAX_BEATS).fill(null);
  for (let i = 0; i < blockCount; i++) {
    if (Math.random() < emptyBlockProbability) continue;
    blocks[i] = randomTile(hitRestProbability);
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
function reactiveProbabilities(anchorDensity: number): { emptyBlockProbability: number; hitRestProbability: number } {
  const anchorBusyness = clamp01(anchorDensity / MAX_NOTE_HITS_PER_BEAT);
  const jitter = (Math.random() - 0.5) * REACTIVITY_JITTER;
  const targetBusyness = clamp01(1 - anchorBusyness * REACTIVITY + jitter);
  return {
    emptyBlockProbability: lerp(0.55, 0.05, targetBusyness),
    hitRestProbability: lerp(0.55, 0.1, targetBusyness),
  };
}

export function generateRandomBeat(options: Partial<RandomBeatOptions> = {}): LineData[] {
  const opts = { ...DEFAULT_RANDOM_BEAT_OPTIONS, ...options };
  const blockCount = randomInt(opts.minBlocks, opts.maxBlocks);
  const instruments = opts.instruments;
  if (instruments.length === 0) return [];

  const anchor = buildLine(instruments[0], 0, blockCount, opts.emptyBlockProbability, opts.hitRestProbability);
  const anchorDensity = lineNoteDensity(anchor.blocks, blockCount);

  const lines: LineData[] = [anchor];
  for (let i = 1; i < instruments.length; i++) {
    const { emptyBlockProbability, hitRestProbability } = reactiveProbabilities(anchorDensity);
    lines.push(buildLine(instruments[i], i, blockCount, emptyBlockProbability, hitRestProbability));
  }

  // computeMeasureLength derives the beat's length from the last filled
  // block across all lines, not from blockCount directly — if every line
  // happened to roll "empty" at the final beat, the measure would silently
  // come out shorter than intended. Force one line to land a tile there.
  const reachesBlockCount = lines.some((l) => l.blocks[blockCount - 1]);
  if (!reachesBlockCount) {
    const forced = lines[randomInt(0, lines.length - 1)];
    forced.blocks[blockCount - 1] = randomTile(opts.hitRestProbability);
  }

  return lines;
}
