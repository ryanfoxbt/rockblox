// Generates RockBlocks beats for a fixed, simple kit — bass drum, snare,
// and closed hi-hat — plus variations/fills based on an existing beat.
//
// generateRandomBeat makes a beat from scratch: a random measure length and
// random rhythm tiles (including tiles with some hits toggled to rests)
// filling each beat. The first instrument (bass drum) is the anchor: its
// rhythm is rolled with no outside influence. Every other line then reacts
// to how busy that anchor turned out to be — real drumming is about sharing
// space, so a packed anchor (a running sixteenth-note kick, say) pushes the
// rest of the kit toward sparser, simpler blocks, while a sparse anchor
// leaves room for other lines to be busier, instead of every line
// independently rolling the same chaotic odds.
//
// generateGrooveVariation, generateFillVariation and generateSoloVariation
// instead start from an existing beat (typically the song's main groove) —
// most songs are built from one theme repeated with small changes plus the
// occasional fill or solo break, not four unrelated random beats, so once a
// first groove exists the natural next step is "give me B/C/D inspired by A"
// rather than "randomize again."
//
// A single 1-10 "complexity" dial (see paramsForComplexity) drives how wild
// any of this gets: how much the measure length varies (generateRandomBeat
// only), whether triplet tiles are in play at all, how dense/steady the
// anchor is, how much jitter the reactive lines get, and — for a variation —
// how far it's allowed to drift from its source. It's one knob rather than
// several so it stays simple to reason about and tune; it can't separately
// express "busy but predictable" vs. "sparse but wild" since those collapse
// onto one axis — if that distinction turns out to matter, split it into two
// dials later.
import { InstrumentId } from "./instruments";
import { NOTE_FRACTION, NoteName, NOTE_TILES, RhythmHit, RhythmTile, TRIPLET_TILES, tileFromHits } from "./rhythm";
import { computeMeasureLength, DEFAULT_VOLUME, LineData, MAX_BEATS } from "./song";

export const MIN_COMPLEXITY = 1;
export const MAX_COMPLEXITY = 10;
export const DEFAULT_COMPLEXITY = 3;

export interface RandomBeatOptions {
  // Which instruments to generate, in order — the first is the anchor line
  // (see reactiveProbabilities). Kept to a fixed, simple core for now rather
  // than randomizing which instruments show up.
  instruments: InstrumentId[];
  // 1 (steady/plain) to 10 (chaotic) — see paramsForComplexity.
  complexity: number;
  // Explicit beat count, 1..MAX_BEATS. When omitted, the count is rolled
  // from complexity (paramsForComplexity's min/maxBlocks) as before.
  beats?: number;
}

// Clamp a requested beat count into the app's valid range.
function clampBeats(beats: number): number {
  return Math.max(1, Math.min(MAX_BEATS, Math.round(beats)));
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
// shipped with before this dial existed. 3 (the default) sits well below
// that: a plain, steady groove. 10 pushes past 7 into real chaos.
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

// computeMeasureLength derives a beat's length from the last filled block
// across all lines, not from any stored count — if mutation/generation
// happens to roll "empty" at the final beat on every line, the measure
// would silently come out shorter than intended. Force one line to land a
// tile there.
function forceReachMeasureLength(
  lines: LineData[],
  measureLength: number,
  hitRestProbability: number,
  tripletProbability: number
): void {
  if (lines.length === 0 || measureLength === 0) return;
  const reaches = lines.some((l) => l.blocks[measureLength - 1]);
  if (reaches) return;
  const forced = lines[randomInt(0, lines.length - 1)];
  forced.blocks[measureLength - 1] = randomTile(hitRestProbability, tripletProbability);
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
  const blockCount =
    opts.beats != null ? clampBeats(opts.beats) : randomInt(params.minBlocks, params.maxBlocks);
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

  forceReachMeasureLength(lines, blockCount, params.hitRestProbability, params.tripletProbability);
  return lines;
}

// How much of each block gets re-rolled for a groove variation, scaled by
// complexity — low complexity keeps the result close kin to its source (a
// subtle fill-in-the-blanks variation), high complexity lets it drift much
// further while still sharing the source's instruments and bar length.
const VARIATION_MUTATION_PROBABILITY: [number, number][] = [[1, 0.15], [5, 0.35], [10, 0.65]];
// A mutated block has a small chance of flipping to/from silence outright
// rather than just swapping to a different tile, so variations can gain or
// drop a hit entirely and not just reshuffle existing ones.
const VARIATION_ADD_HIT_PROBABILITY = 0.4;
const VARIATION_DROP_HIT_PROBABILITY = 0.15;

// A variation of an existing groove: same instruments and the same measure
// length as the source (so it can drop into another slot of the same song
// without a jarring bar-length change), with each block having a chance —
// scaled by complexity — of being re-rolled rather than kept as-is.
export function generateGrooveVariation(
  sourceLines: LineData[],
  complexity: number,
  beats?: number
): LineData[] {
  // An explicit `beats` overrides the source's own bar length — beats past
  // the source's end are generated fresh, extra source beats are dropped.
  const measureLength = beats != null ? clampBeats(beats) : computeMeasureLength(sourceLines);
  const params = paramsForComplexity(complexity);
  const mutationProbability = scaleByComplexity(complexity, VARIATION_MUTATION_PROBABILITY);

  const lines: LineData[] = sourceLines.map((line, index) => {
    const blocks: (RhythmTile | null)[] = Array(MAX_BEATS).fill(null);
    for (let i = 0; i < measureLength; i++) {
      const original = line.blocks[i] ?? null;
      if (Math.random() >= mutationProbability) {
        blocks[i] = original;
        continue;
      }
      if (!original) {
        blocks[i] =
          Math.random() < VARIATION_ADD_HIT_PROBABILITY
            ? randomTile(params.hitRestProbability, params.tripletProbability)
            : null;
      } else {
        blocks[i] =
          Math.random() < VARIATION_DROP_HIT_PROBABILITY
            ? null
            : randomTile(params.hitRestProbability, params.tripletProbability);
      }
    }
    return { id: randomLineId(index), instrument: line.instrument, blocks, volume: line.volume };
  });

  forceReachMeasureLength(lines, measureLength, params.hitRestProbability, params.tripletProbability);
  return lines;
}

function pickRandomSubset<T>(pool: T[], count: number): T[] {
  const copy = [...pool];
  const picked: T[] = [];
  for (let i = 0; i < count && copy.length > 0; i++) {
    picked.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
  }
  return picked;
}

// A drum fill rarely rebuilds the whole bar from scratch: usually the
// groove keeps playing for most of the measure and only the tail end —
// the last beat, the last beat and a half, sometimes (occasionally) the
// entire bar — breaks into fill material. Real fills also tend to be
// simple: straight time (rarely a polyrhythm/triplet feel), built mostly
// from kick/snare/toms, with the timekeeping cymbal (hi-hat/ride) dropping
// out for the tail and an occasional crash as the only cymbal voice.
const CYMBAL_VOICES: InstrumentId[] = ["hihatClosed", "hihatOpen", "ride"];
const FILL_TOM_CHOICES: InstrumentId[] = ["lowTom", "midTom", "highTom"];
const SLOTS_PER_BEAT = 4;
// How often the fill takes over the whole bar rather than just its tail.
const FULL_MEASURE_FILL_PROBABILITY = 0.25;
// A tail longer than this (in beats) stops reading as "a fill" and starts
// reading as "a different groove," regardless of how long the bar is.
const MAX_FILL_TAIL_BEATS = 3;

// How much of the measure (from the end) becomes fill material — a whole
// number of beats, or a whole number plus a half-beat (the "start on beat
// 2 1/2" case), never finer than that. Always leaves at least one full beat
// of groove prefix unless the whole bar is chosen as the fill.
function pickFillTailBeats(measureLength: number): number {
  if (measureLength <= 1 || Math.random() < FULL_MEASURE_FILL_PROBABILITY) return measureLength;
  const maxTail = Math.min(measureLength - 1, MAX_FILL_TAIL_BEATS);
  const halfBeatSteps = Math.round(maxTail * 2);
  return (1 + Math.floor(Math.random() * halfBeatSteps)) / 2;
}

// Decomposes a straight-note tile into 4 sixteenth-slot onset flags —
// null if the tile contains a triplet fraction, which can't land cleanly
// on a 4-slot grid (a null/empty beat decomposes to all-false, not null).
function tileToSlotFlags(tile: RhythmTile | null): boolean[] | null {
  if (!tile) return Array(SLOTS_PER_BEAT).fill(false);
  const flags: boolean[] = [];
  for (const hit of tile.hits) {
    const span = NOTE_FRACTION[hit.note] * SLOTS_PER_BEAT;
    if (!Number.isInteger(span)) return null;
    flags.push(hit.type === "note");
    for (let i = 1; i < span; i++) flags.push(false);
  }
  return flags.length === SLOTS_PER_BEAT ? flags : null;
}

function slotFlagsToTile(flags: boolean[]): RhythmTile | null {
  if (!flags.some((f) => f)) return null;
  const hits: RhythmHit[] = flags.map((f) => ({ type: f ? "note" : "rest", note: "sixteenth" }));
  return tileFromHits(hits);
}

function randomFillSlots(count: number, hitProbability: number): boolean[] {
  return Array.from({ length: count }, () => Math.random() < hitProbability);
}

interface FillDensity {
  kick: number;
  snare: number;
  otherCore: number;
  tom: number;
  crash: number;
}

// Deliberately narrower ranges than a from-scratch beat's density — a fill
// is meant to read as a simple, punchy break, not a busy solo.
function fillDensityForComplexity(complexity: number): FillDensity {
  return {
    kick: scaleByComplexity(complexity, [[1, 0.2], [10, 0.5]]),
    snare: scaleByComplexity(complexity, [[1, 0.3], [10, 0.6]]),
    otherCore: scaleByComplexity(complexity, [[1, 0.25], [10, 0.55]]),
    tom: scaleByComplexity(complexity, [[1, 0.15], [10, 0.4]]),
    crash: scaleByComplexity(complexity, [[1, 0.2], [10, 0.55]]),
  };
}

function fillHitProbabilityFor(instrument: InstrumentId, density: FillDensity): number {
  if (instrument === "kick") return density.kick;
  if (instrument === "snare") return density.snare;
  return density.otherCore;
}

// Builds one line's blocks for the fill: beats fully before the cutoff are
// copied verbatim from the source (untouched groove material), beats fully
// after it are generated fresh, and the one beat the cutoff falls inside
// (if it's a half-beat cutoff) keeps its source content for the first half
// and gets fresh content for the second. `sourceBlocks` is null for a line
// that doesn't exist in the source at all (a newly-added tom) — it has
// nothing to copy, so its prefix is silent.
function buildFillLineBlocks(
  sourceBlocks: (RhythmTile | null)[] | null,
  measureLength: number,
  tailStartBeat: number,
  straddleBeat: number,
  silenceDuringTail: boolean,
  hitProbability: number
): (RhythmTile | null)[] {
  const blocks: (RhythmTile | null)[] = Array(MAX_BEATS).fill(null);
  const prefixBeats = Math.floor(tailStartBeat);
  const half = SLOTS_PER_BEAT / 2;

  for (let b = 0; b < measureLength; b++) {
    if (b < prefixBeats) {
      blocks[b] = sourceBlocks ? sourceBlocks[b] ?? null : null;
      continue;
    }
    if (b === straddleBeat) {
      const prefixFlags = (sourceBlocks ? tileToSlotFlags(sourceBlocks[b] ?? null) : null) ?? Array(SLOTS_PER_BEAT).fill(false);
      const tailFlags = silenceDuringTail ? Array(half).fill(false) : randomFillSlots(half, hitProbability);
      blocks[b] = slotFlagsToTile([...prefixFlags.slice(0, half), ...tailFlags]);
      continue;
    }
    blocks[b] = silenceDuringTail ? null : slotFlagsToTile(randomFillSlots(SLOTS_PER_BEAT, hitProbability));
  }
  return blocks;
}

// A fill inspired by an existing groove: the groove keeps playing through
// most of the bar, and only the tail end turns into fill material — mostly
// kick/snare (plus whatever else the groove already used), 1-2 toms added
// for color, the timekeeping cymbal dropping out for the tail, and an
// occasional single crash accent landing on the very last sixteenth of the
// bar. No triplets: real fills are rarely polyrhythmic.
export function generateFillVariation(
  sourceLines: LineData[],
  complexity: number,
  beats?: number
): LineData[] {
  const measureLength = beats != null ? clampBeats(beats) : computeMeasureLength(sourceLines);
  if (measureLength === 0) return [];
  const density = fillDensityForComplexity(complexity);

  let tailBeats = pickFillTailBeats(measureLength);
  let tailStartBeat = measureLength - tailBeats;
  let straddleBeat = Number.isInteger(tailStartBeat) ? -1 : Math.floor(tailStartBeat);

  // A half-beat cutoff only works when every source line's tile at that
  // beat is straight (decomposable onto the sixteenth grid) — a triplet
  // tile can't be split mid-beat, so fall back to a whole-beat cut instead.
  if (straddleBeat >= 0) {
    const decomposable = sourceLines.every((l) => tileToSlotFlags(l.blocks[straddleBeat] ?? null) !== null);
    if (!decomposable) {
      tailBeats = Math.ceil(tailBeats);
      tailStartBeat = measureLength - tailBeats;
      straddleBeat = -1;
    }
  }

  const toms = pickRandomSubset(
    FILL_TOM_CHOICES.filter((t) => !sourceLines.some((l) => l.instrument === t)),
    randomInt(1, 2)
  );
  const includeCrash = !sourceLines.some((l) => l.instrument === "crash") && Math.random() < density.crash;

  const lines: LineData[] = [];
  let index = 0;
  for (const line of sourceLines) {
    const isCymbal = CYMBAL_VOICES.includes(line.instrument);
    const blocks = buildFillLineBlocks(
      line.blocks,
      measureLength,
      tailStartBeat,
      straddleBeat,
      isCymbal,
      fillHitProbabilityFor(line.instrument, density)
    );
    lines.push({ id: randomLineId(index++), instrument: line.instrument, blocks, volume: line.volume });
  }
  for (const tom of toms) {
    const blocks = buildFillLineBlocks(null, measureLength, tailStartBeat, straddleBeat, false, density.tom);
    lines.push({ id: randomLineId(index++), instrument: tom, blocks, volume: DEFAULT_VOLUME });
  }
  if (includeCrash) {
    const blocks: (RhythmTile | null)[] = Array(MAX_BEATS).fill(null);
    blocks[measureLength - 1] = slotFlagsToTile([false, false, false, true]);
    lines.push({ id: randomLineId(index++), instrument: "crash", blocks, volume: DEFAULT_VOLUME });
  }

  // Drop any line left with nothing to play — most commonly the timekeeping
  // cymbal on a full-measure fill, which never got a chance to sound at all.
  const nonEmptyLines = lines.filter((l) => l.blocks.some((b) => b));
  forceReachMeasureLength(nonEmptyLines, measureLength, 0.1, 0);
  return nonEmptyLines;
}

// --- Drum solo -----------------------------------------------------------
// A solo, unlike a fill, replaces the groove for the whole bar and ranges
// across the kit. The rule that keeps it playable by an actual person is two
// hands and two feet. This kit has exactly one foot voice (the kick — there
// is no hi-hat pedal), so in practice the constraints are:
//   * at most TWO hand voices sounding on any single grid cell, and
//   * at most ONE kick on any single grid cell,
//   * a "walking" lead hand that only steps to an ADJACENT drum between
//     consecutive notes rather than leaping across the kit, and
//   * one subdivision per beat — no limb playing triplets against another
//     limb's straight sixteenths in the same beat.
// The result reads as a single-stroke roll around the snare and toms with
// kick accents underneath and a crash to open (and sometimes close) the
// phrase — i.e. something a drummer can actually sit down and play.

// Snare + toms in physical (high-to-low) order: the lead hand may only move
// one step along this ladder per note.
const SOLO_HAND_LADDER: InstrumentId[] = ["highTom", "midTom", "lowTom", "snare"];
// The off hand keeps time on one of these, but only while the beat is in
// straight eighths — once the roll is in triplets/sixteenths or faster, both
// hands are in the roll and there is no spare hand for a time voice.
const SOLO_TIME_VOICES: InstrumentId[] = ["hihatClosed", "ride"];
// Every voice a hand can strike, ordered by keep-priority for the
// two-hands-per-cell safety net (time voice is dropped first).
const SOLO_HAND_VOICES: InstrumentId[] = [...SOLO_HAND_LADDER, "crash", ...SOLO_TIME_VOICES];
// Output line order — kick first (anchor convention), then melodic voices,
// then the time voice and crash.
const SOLO_LINE_ORDER: InstrumentId[] = [
  "kick",
  "snare",
  "highTom",
  "midTom",
  "lowTom",
  "hihatClosed",
  "ride",
  "crash",
];

// How many equal cells a beat is cut into, and the note value each cell gets.
const SOLO_SUB_NOTE: Record<number, NoteName> = {
  2: "eighth",
  3: "eighthTriplet",
  4: "sixteenth",
  6: "sixteenthTriplet",
};

interface SoloBeat {
  note: NoteName;
  // instrument -> per-cell onset flags for this beat
  grids: Map<InstrumentId, boolean[]>;
}

// A drum solo inspired by an existing groove: the groove is set aside and
// the whole bar becomes a kit solo. `complexity` drives the subdivision
// (steady eighths at the low end, sixteenth-note triplets at the top), how
// continuously the lead hand rolls, and how hard the kick works underneath.
// The source is used only for its bar length and for matching line volumes.
export function generateSoloVariation(
  sourceLines: LineData[],
  complexity: number,
  beats?: number
): LineData[] {
  const measureLength = beats != null ? clampBeats(beats) : computeMeasureLength(sourceLines);
  if (measureLength === 0) return [];

  const tripletChance = scaleByComplexity(complexity, [[1, 0], [4, 0.15], [7, 0.4], [10, 0.6]]);
  const fastChance = scaleByComplexity(complexity, [[1, 0.1], [4, 0.55], [7, 0.85], [10, 0.95]]);
  const leadDensity = scaleByComplexity(complexity, [[1, 0.55], [10, 0.95]]);
  const kickDensity = scaleByComplexity(complexity, [[1, 0.28], [10, 0.55]]);
  const offHandChance = scaleByComplexity(complexity, [[1, 0.35], [10, 0.8]]);

  const timeVoice = SOLO_TIME_VOICES[randomInt(0, SOLO_TIME_VOICES.length - 1)];
  const used = new Set<InstrumentId>();
  const soloBeats: SoloBeat[] = [];
  let handPos = randomInt(0, SOLO_HAND_LADDER.length - 1);

  for (let b = 0; b < measureLength; b++) {
    const triplet = Math.random() < tripletChance;
    const fast = Math.random() < fastChance;
    const sub = triplet ? (fast ? 6 : 3) : fast ? 4 : 2;
    const note = SOLO_SUB_NOTE[sub];
    const grids = new Map<InstrumentId, boolean[]>();
    const cell = (id: InstrumentId): boolean[] => {
      let g = grids.get(id);
      if (!g) {
        g = Array(sub).fill(false);
        grids.set(id, g);
      }
      return g;
    };
    // A separate time-keeping hand only fits under a straight-eighth roll;
    // anything faster is a two-handed roll on the lead voice alone.
    const offHandActive = sub === 2;

    for (let c = 0; c < sub; c++) {
      const strong = c === 0 || (sub % 2 === 0 && c === sub / 2);
      // Guarantee the final beat lands a note so the bar keeps its length.
      const forceLead = b === measureLength - 1 && c === 0;

      if (forceLead || Math.random() < leadDensity) {
        if (!forceLead && Math.random() < 0.55) {
          const step = Math.random() < 0.5 ? -1 : 1;
          handPos = Math.max(0, Math.min(SOLO_HAND_LADDER.length - 1, handPos + step));
        }
        const inst = SOLO_HAND_LADDER[handPos];
        cell(inst)[c] = true;
        used.add(inst);
      }

      if (offHandActive && (strong || Math.random() < 0.25) && Math.random() < offHandChance) {
        cell(timeVoice)[c] = true;
        used.add(timeVoice);
      }

      if (c === 0 || (strong && Math.random() < kickDensity) || Math.random() < kickDensity * 0.5) {
        cell("kick")[c] = true;
        used.add("kick");
      }
    }

    // Crash opens the bar and sometimes closes it. It is a hand hit, so it
    // evicts the time voice from that cell to stay within two hands.
    if (b === 0 || (b === measureLength - 1 && Math.random() < 0.4)) {
      cell("crash")[0] = true;
      used.add("crash");
      const tv = grids.get(timeVoice);
      if (tv) tv[0] = false;
    }

    // Safety net: never let more than two hand voices land on one cell.
    for (let c = 0; c < sub; c++) {
      const here = SOLO_HAND_VOICES.filter((id) => grids.get(id)?.[c]);
      for (const id of here.slice(2)) grids.get(id)![c] = false;
    }

    // Keep the foot human: no more than two kick strokes in an unbroken run.
    const kg = grids.get("kick");
    if (kg) {
      let run = 0;
      for (let c = 0; c < sub; c++) {
        run = kg[c] ? run + 1 : 0;
        if (run > 2) kg[c] = false;
      }
    }

    soloBeats.push({ note, grids });
  }

  const lines: LineData[] = [];
  let index = 0;
  for (const inst of SOLO_LINE_ORDER) {
    if (!used.has(inst)) continue;
    const blocks: (RhythmTile | null)[] = Array(MAX_BEATS).fill(null);
    for (let b = 0; b < measureLength; b++) {
      const g = soloBeats[b].grids.get(inst);
      if (!g || !g.some(Boolean)) continue;
      blocks[b] = tileFromHits(g.map((on) => ({ type: on ? "note" : "rest", note: soloBeats[b].note })));
    }
    if (!blocks.some((x) => x)) continue;
    const volume = sourceLines.find((l) => l.instrument === inst)?.volume ?? DEFAULT_VOLUME;
    lines.push({ id: randomLineId(index++), instrument: inst, blocks, volume });
  }
  return lines;
}
