// Generates a chaotic, fully-random RockBlocks beat: a random subset of
// instruments, a random measure length, and random rhythm tiles (including
// tiles with some hits toggled to rests) filling each beat. No musical
// guardrails yet — every draw is independent and uniform — that's
// intentional for this first pass; options below exist so future tuning
// (e.g. weighting toward simpler tiles, keeping a steady cymbal voice, etc.)
// has somewhere to land without changing the call site.
import { INSTRUMENTS, InstrumentId } from "./instruments";
import { NOTE_TILES, RhythmHit, RhythmTile, TRIPLET_TILES, tileFromHits } from "./rhythm";
import { DEFAULT_VOLUME, LineData, MAX_BEATS } from "./song";

export interface RandomBeatOptions {
  maxInstruments: number;
  minBlocks: number;
  maxBlocks: number;
  // Chance a given beat is left completely empty (no tile at all) on a line.
  emptyBlockProbability: number;
  // Chance any single hit within a placed tile is silenced to a rest.
  hitRestProbability: number;
}

export const DEFAULT_RANDOM_BEAT_OPTIONS: RandomBeatOptions = {
  maxInstruments: 5,
  minBlocks: 3,
  maxBlocks: MAX_BEATS,
  emptyBlockProbability: 0.15,
  hitRestProbability: 0.3,
};

const RANDOM_TILE_CATALOG: RhythmTile[] = [...NOTE_TILES, ...TRIPLET_TILES];

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function pickRandomInstruments(count: number): InstrumentId[] {
  const pool = INSTRUMENTS.map((i) => i.id);
  const picked: InstrumentId[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const index = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(index, 1)[0]);
  }
  return picked;
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

export function generateRandomBeat(options: Partial<RandomBeatOptions> = {}): LineData[] {
  const opts = { ...DEFAULT_RANDOM_BEAT_OPTIONS, ...options };
  const blockCount = randomInt(opts.minBlocks, opts.maxBlocks);
  const instruments = pickRandomInstruments(Math.min(opts.maxInstruments, INSTRUMENTS.length));

  const lines: LineData[] = instruments.map((instrument, index) => {
    const blocks: (RhythmTile | null)[] = Array(MAX_BEATS).fill(null);
    for (let i = 0; i < blockCount; i++) {
      if (Math.random() < opts.emptyBlockProbability) continue;
      blocks[i] = randomTile(opts.hitRestProbability);
    }
    return { id: randomLineId(index), instrument, blocks, volume: DEFAULT_VOLUME };
  });

  // computeMeasureLength derives the beat's length from the last filled
  // block across all lines, not from blockCount directly — if every line
  // happened to roll "empty" at the final beat, the measure would silently
  // come out shorter than intended. Force one line to land a tile there.
  const reachesBlockCount = lines.some((l) => l.blocks[blockCount - 1]);
  if (!reachesBlockCount && lines.length > 0) {
    const forced = lines[randomInt(0, lines.length - 1)];
    forced.blocks[blockCount - 1] = randomTile(opts.hitRestProbability);
  }

  return lines;
}
