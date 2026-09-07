// Turns a manually-picked clip (a time range + how many beat-blocks it
// should fill) into a Slot's actual StoredLine[] pattern, using the
// whole-song classified onset list from analyzeSongForCropping. Pure,
// client-safe math — no Buffer/FFT deps — so cropping a clip on /test can
// quantize instantly instead of round-tripping to the server per pick.
import { InstrumentId } from "./instruments";
import { RhythmHit, tileFromHits } from "./rhythm";
import { StoredLine } from "./song";

export interface ClipOnset {
  time: number;
  instrument: InstrumentId;
}

// How close (as a fraction of one sixteenth-note) a hit has to land to a
// grid slot to count as "on" that slot — an onset sitting roughly halfway
// between two slots is genuinely ambiguous and gets dropped rather than
// forced onto whichever one is a hair closer. Slightly looser than a strict
// half-slot cutoff: the whole-song tempo/grid estimate is a single straight
// line, so small drift accumulates the further an onset sits from the grid
// origin — a real hit late in a long clip can end up a bit further from its
// slot than one at the very start, even though it's clearly still meant for
// that slot. The grid-shift control in SongCropTool corrects a constant
// phase offset (e.g. a pickup note); this just adds a little slack for the
// drift a single tempo estimate can't fully capture.
const SLOT_MATCH_TOLERANCE = 0.42;

const LINE_ORDER: InstrumentId[] = [
  "kick",
  "snare",
  "hihatClosed",
  "hihatOpen",
  "ride",
  "crash",
  "lowTom",
  "midTom",
  "highTom",
  "rimshot",
];

/**
 * @param onsets Every classified hit in the whole song (or close enough to
 *   the clip — no need to pre-filter).
 * @param gridOrigin Whole-song beat grid phase, in seconds (see
 *   analyzeSongForCropping).
 * @param beatSeconds Whole-song beat duration, in seconds.
 * @param clipStartSeconds Where the clip starts — snapped to the nearest
 *   sixteenth-note grid line rather than trusted exactly, so a selection
 *   UI's pixel math being a hair off doesn't misalign the whole pattern.
 * @param blockCount How many beat-blocks the clip should fill — not tied to
 *   the app-wide MAX_BEATS cap (see song.ts); the crop tool enforces its own
 *   limit before calling this, and the output array is sized to whatever
 *   blockCount actually is.
 */
export function quantizeClipToLines(
  onsets: ClipOnset[],
  gridOrigin: number,
  beatSeconds: number,
  clipStartSeconds: number,
  blockCount: number
): StoredLine[] {
  const sixteenthSeconds = beatSeconds / 4;
  const totalSlots = blockCount * 4;
  const startSlot = Math.round((clipStartSeconds - gridOrigin) / sixteenthSeconds);

  const slotsByInstrument = new Map<InstrumentId, Set<number>>();
  for (const onset of onsets) {
    const rawSlot = (onset.time - gridOrigin) / sixteenthSeconds;
    const nearestSlot = Math.round(rawSlot);
    if (Math.abs(rawSlot - nearestSlot) > SLOT_MATCH_TOLERANCE) continue;
    const relativeSlot = nearestSlot - startSlot;
    if (relativeSlot < 0 || relativeSlot >= totalSlots) continue;
    if (!slotsByInstrument.has(onset.instrument)) slotsByInstrument.set(onset.instrument, new Set());
    slotsByInstrument.get(onset.instrument)!.add(relativeSlot);
  }

  const lines: StoredLine[] = [];
  for (const instrument of LINE_ORDER) {
    const slots = slotsByInstrument.get(instrument);
    if (!slots || slots.size === 0) continue;

    const blocks: (string | null)[] = new Array(blockCount).fill(null);
    for (let beat = 0; beat < blockCount; beat++) {
      const hits: RhythmHit[] = [];
      for (let k = 0; k < 4; k++) {
        const globalSlot = beat * 4 + k;
        hits.push({ type: slots.has(globalSlot) ? "note" : "rest", note: "sixteenth" });
      }
      blocks[beat] = hits.some((h) => h.type === "note") ? tileFromHits(hits).id : null;
    }
    lines.push({ instrument, blocks, volume: 100 });
  }
  return lines;
}
