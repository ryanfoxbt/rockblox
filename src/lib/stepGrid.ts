// The classic drum-machine view's data model: each beat block is exactly 4
// sixteenth-note steps (quarter/eighth/dottedEighth/sixteenth note fractions
// are all multiples of a sixteenth, so this always round-trips losslessly
// against rhythm.ts's tile hits). Triplet tiles don't divide evenly onto this
// grid, so a beat holding one reports as `null` — the classic view renders
// that beat locked and points the user back to RockBlocks to edit it.
import { HitAccent, NOTE_FRACTION, NoteName, RhythmHit, RhythmTile, tileFromHits } from "./rhythm";

export const STEPS_PER_BEAT = 4;

export interface StepCell {
  on: boolean;
  accent?: HitAccent;
}

const UNITS_TO_NOTE: Record<number, NoteName> = {
  1: "sixteenth",
  2: "eighth",
  3: "dottedEighth",
  4: "quarter",
};

function isTripletNote(note: NoteName): boolean {
  return note === "eighthTriplet" || note === "sixteenthTriplet";
}

function emptySteps(): StepCell[] {
  return Array.from({ length: STEPS_PER_BEAT }, () => ({ on: false }));
}

// Expands one beat's tile into its 4 sixteenth-note onset steps. `null`
// input (no tile placed) is a beat of silence, same as 4 empty steps.
// Returns `null` when the tile can't be represented on this grid at all.
export function tileToSteps(tile: RhythmTile | null): StepCell[] | null {
  if (!tile) return emptySteps();
  if (tile.hits.some((h) => isTripletNote(h.note))) return null;

  const steps = emptySteps();
  let pos = 0;
  for (const h of tile.hits) {
    const units = Math.round(NOTE_FRACTION[h.note] * STEPS_PER_BEAT);
    if (h.type === "note" && pos < STEPS_PER_BEAT) steps[pos] = { on: true, accent: h.accent };
    pos += units;
  }
  return steps;
}

// Rebuilds a beat's tile from its steps — the inverse of tileToSteps. A step
// that's off just extends whichever rest/note segment came before it (drum
// hits are one-shots; there's no such thing as an "off" step in the middle
// of a note's sustain). Returns null when every step is off, matching the
// rest of the app's convention that an empty beat is `null`, not a tile.
export function stepsToTile(steps: StepCell[]): RhythmTile | null {
  if (steps.every((s) => !s.on)) return null;
  const hits: RhythmHit[] = [];
  let i = 0;
  while (i < steps.length) {
    const onset = steps[i].on;
    let j = i + 1;
    while (j < steps.length && !steps[j].on) j++;
    const note = UNITS_TO_NOTE[j - i] ?? "sixteenth";
    hits.push(onset ? { type: "note", note, accent: steps[i].accent } : { type: "rest", note });
    i = j;
  }
  return tileFromHits(hits);
}

// normal -> accent -> ghost -> normal, same cycle as rhythm.ts's
// cycleHitAccent but for a step that isn't backed by a hit index yet.
export function cycleStepAccent(accent: HitAccent | undefined): HitAccent | undefined {
  return accent === undefined ? "accent" : accent === "accent" ? "ghost" : undefined;
}
