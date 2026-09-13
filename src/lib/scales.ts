// Scale catalog for the bassline generator. Each scale is a set of semitone
// offsets from its root, within one octave (0 = the root, 12 excluded). Most
// scales only use whole semitones, but a few (Middle Eastern maqamat) fall on
// the half-semitone (quarter-tone) grid too — see the "quarter-tone" note
// below. The generator snaps every pitch it picks to one of these so a
// bassline stays in the key the user chose — see generateBassline.ts.
//
// Quarter tones: standard MIDI note numbers are integers, so there's no
// note number for "a quarter tone above C". This app sidesteps that by
// keeping `midi` a plain float everywhere pitch flows through (BassNote.midi,
// the functions below) — the live synth in bassVoice.ts already converts an
// arbitrary float to a frequency, so e.g. 60.5 just plays a quarter tone above
// C4. All the pitch math here works in half-semitone steps (round to the
// nearest 0.5) so a fractional scale degree round-trips exactly. The one
// place this can't reach is a plain MIDI file export, where note numbers must
// be integers — see pushBassNoteEvents in midiEncoder.ts for how that's
// handled with a per-note pitch bend instead.

export const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
] as const;

// Human, octave-numbered name for an absolute MIDI note (MIDI 60 = C4), used
// by the read-only bassline row. Middle C as C4 is the convention the rest of
// the app's MIDI export already assumes (see midiEncoder.ts). A quarter tone
// (a .5 remainder) is named relative to the note above it, half-flat — e.g.
// 63.5 is "Ed4" (E half-flat, the maqam-notation convention), the same way a
// written flat borrows its octave number from the letter above rather than
// the pitch below.
export function midiNoteName(midi: number): string {
  const rounded = Math.round(midi * 2) / 2;
  const flooredPc = Math.floor(rounded);
  const isQuarterTone = rounded - flooredPc === 0.5;
  const pc = isQuarterTone ? flooredPc + 1 : flooredPc;
  const name = NOTE_NAMES[((pc % 12) + 12) % 12];
  const octave = Math.floor(pc / 12) - 1;
  return isQuarterTone ? `${name}d${octave}` : `${name}${octave}`;
}

export interface ScaleDef {
  name: string;
  group: string;
  // Ascending semitone offsets from the root, first entry always 0.
  intervals: number[];
}

// Grouped roughly by how a musician would reach for them. The keys are the
// stable ids that get persisted in a saved bassline; renaming a key is a
// breaking change, adding one never is.
export const SCALES = {
  major: { name: "Major (Ionian)", group: "Common", intervals: [0, 2, 4, 5, 7, 9, 11] },
  naturalMinor: {
    name: "Natural minor (Aeolian)",
    group: "Common",
    intervals: [0, 2, 3, 5, 7, 8, 10],
  },
  harmonicMinor: {
    name: "Harmonic minor",
    group: "Common",
    intervals: [0, 2, 3, 5, 7, 8, 11],
  },
  melodicMinor: {
    name: "Melodic minor",
    group: "Common",
    intervals: [0, 2, 3, 5, 7, 9, 11],
  },

  dorian: { name: "Dorian", group: "Modes", intervals: [0, 2, 3, 5, 7, 9, 10] },
  phrygian: { name: "Phrygian", group: "Modes", intervals: [0, 1, 3, 5, 7, 8, 10] },
  lydian: { name: "Lydian", group: "Modes", intervals: [0, 2, 4, 6, 7, 9, 11] },
  mixolydian: { name: "Mixolydian", group: "Modes", intervals: [0, 2, 4, 5, 7, 9, 10] },
  locrian: { name: "Locrian", group: "Modes", intervals: [0, 1, 3, 5, 6, 8, 10] },

  majorPentatonic: {
    name: "Major pentatonic",
    group: "Pentatonic & blues",
    intervals: [0, 2, 4, 7, 9],
  },
  minorPentatonic: {
    name: "Minor pentatonic",
    group: "Pentatonic & blues",
    intervals: [0, 3, 5, 7, 10],
  },
  blues: { name: "Blues (hexatonic)", group: "Pentatonic & blues", intervals: [0, 3, 5, 6, 7, 10] },
  majorBlues: {
    name: "Major blues",
    group: "Pentatonic & blues",
    intervals: [0, 2, 3, 4, 7, 9],
  },
  egyptian: {
    name: "Egyptian (suspended)",
    group: "Pentatonic & blues",
    intervals: [0, 2, 5, 7, 10],
  },

  bebopDominant: {
    name: "Bebop dominant",
    group: "Jazz",
    intervals: [0, 2, 4, 5, 7, 9, 10, 11],
  },
  bebopMajor: { name: "Bebop major", group: "Jazz", intervals: [0, 2, 4, 5, 7, 8, 9, 11] },
  lydianDominant: {
    name: "Lydian dominant (acoustic)",
    group: "Jazz",
    intervals: [0, 2, 4, 6, 7, 9, 10],
  },
  altered: {
    name: "Altered (super-Locrian)",
    group: "Jazz",
    intervals: [0, 1, 3, 4, 6, 8, 10],
  },
  harmonicMajor: {
    name: "Harmonic major",
    group: "Jazz",
    intervals: [0, 2, 4, 5, 7, 8, 11],
  },

  phrygianDominant: {
    name: "Phrygian dominant (Freygish)",
    group: "Exotic",
    intervals: [0, 1, 4, 5, 7, 8, 10],
  },
  doubleHarmonic: {
    name: "Double harmonic (Byzantine)",
    group: "Exotic",
    intervals: [0, 1, 4, 5, 7, 8, 11],
  },
  hungarianMinor: {
    name: "Hungarian minor",
    group: "Exotic",
    intervals: [0, 2, 3, 6, 7, 8, 11],
  },
  hungarianMajor: {
    name: "Hungarian / Gypsy major",
    group: "Exotic",
    intervals: [0, 3, 4, 6, 7, 9, 10],
  },
  neapolitanMinor: {
    name: "Neapolitan minor",
    group: "Exotic",
    intervals: [0, 1, 3, 5, 7, 8, 11],
  },
  neapolitanMajor: {
    name: "Neapolitan major",
    group: "Exotic",
    intervals: [0, 1, 3, 5, 7, 9, 11],
  },
  persian: { name: "Persian", group: "Exotic", intervals: [0, 1, 4, 5, 6, 8, 11] },
  enigmatic: { name: "Enigmatic", group: "Exotic", intervals: [0, 1, 4, 6, 8, 10, 11] },

  wholeTone: { name: "Whole tone", group: "Symmetric", intervals: [0, 2, 4, 6, 8, 10] },
  diminishedWholeHalf: {
    name: "Diminished (whole-half)",
    group: "Symmetric",
    intervals: [0, 2, 3, 5, 6, 8, 9, 11],
  },
  diminishedHalfWhole: {
    name: "Diminished (half-whole)",
    group: "Symmetric",
    intervals: [0, 1, 3, 4, 6, 7, 9, 10],
  },
  augmented: { name: "Augmented", group: "Symmetric", intervals: [0, 3, 4, 7, 8, 11] },
  chromatic: {
    name: "Chromatic",
    group: "Symmetric",
    intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  },

  hirajoshi: { name: "Hirajoshi", group: "Japanese", intervals: [0, 2, 3, 7, 8] },
  inSen: { name: "In (Sakura)", group: "Japanese", intervals: [0, 1, 5, 7, 8] },
  iwato: { name: "Iwato", group: "Japanese", intervals: [0, 1, 5, 6, 10] },
  kumoi: { name: "Kumoi", group: "Japanese", intervals: [0, 2, 3, 7, 9] },
  yo: { name: "Yo", group: "Japanese", intervals: [0, 2, 5, 7, 9] },

  // Arabic/Turkish/Persian maqam theory formally divides the octave into 24
  // quarter tones rather than 12 semitones — these use the .5 (half-semitone)
  // steps described up top for their neutral 2nds/3rds/7ths. Notes land a
  // quarter tone off the piano's grid entirely, not just off this scale's
  // degrees, so nearestScaleTone etc. below search in 0.5 steps everywhere,
  // not just for these.
  maqamRast: {
    name: "Maqam Rast",
    group: "Maqam (quarter-tone)",
    intervals: [0, 2, 3.5, 5, 7, 9, 10.5],
  },
  maqamBayati: {
    name: "Maqam Bayati",
    group: "Maqam (quarter-tone)",
    intervals: [0, 1.5, 3, 5, 7, 8, 10],
  },
  maqamSaba: {
    name: "Maqam Saba",
    group: "Maqam (quarter-tone)",
    intervals: [0, 1.5, 3, 4, 7, 8, 10],
  },
  maqamHijaz: {
    name: "Maqam Hijaz",
    group: "Maqam (quarter-tone)",
    intervals: [0, 1, 4, 5, 7, 8, 10],
  },

  // Hindustani ragas: theory describes these via 22 just-intonation shrutis,
  // but unlike the maqamat above that's a tuning nuance within each scale
  // step rather than extra scale degrees, so these stay on the ordinary
  // 12-tone grid — the same convention every notation staff and MIDI-based
  // sequencer uses for ragas.
  ragaTodi: { name: "Raga Todi", group: "Raga", intervals: [0, 1, 3, 6, 7, 8, 11] },
  ragaAhirBhairav: {
    name: "Raga Ahir Bhairav",
    group: "Raga",
    intervals: [0, 1, 4, 5, 7, 9, 10],
  },
  ragaMarwa: { name: "Raga Marwa", group: "Raga", intervals: [0, 1, 4, 6, 9, 11] },
} satisfies Record<string, ScaleDef>;

export type ScaleId = keyof typeof SCALES;

export const SCALE_IDS = Object.keys(SCALES) as ScaleId[];

export function isScaleId(v: unknown): v is ScaleId {
  return typeof v === "string" && v in SCALES;
}

// Scale ids grouped in catalog order, for rendering an <optgroup> picker.
export function scalesByGroup(): { group: string; ids: ScaleId[] }[] {
  const out: { group: string; ids: ScaleId[] }[] = [];
  for (const id of SCALE_IDS) {
    const group = SCALES[id].group;
    let bucket = out.find((b) => b.group === group);
    if (!bucket) {
      bucket = { group, ids: [] };
      out.push(bucket);
    }
    bucket.ids.push(id);
  }
  return out;
}

// True when `midi` is a member of `scaleId` rooted at pitch class `root` (0-11).
// Compares in half-semitone steps (an integer count of quarter tones) rather
// than raw float degrees, so a maqam's .5 intervals match exactly instead of
// depending on float equality.
export function isInScale(midi: number, root: number, scaleId: ScaleId): boolean {
  const halfSteps = Math.round((midi - root) * 2);
  const degree = (((halfSteps % 24) + 24) % 24) / 2;
  return SCALES[scaleId].intervals.includes(degree);
}

// Every scale tone from `lowMidi` to `highMidi` inclusive, ascending. Steps in
// half-semitones so a maqam's quarter tones aren't skipped.
export function scalePitches(
  root: number,
  scaleId: ScaleId,
  lowMidi: number,
  highMidi: number
): number[] {
  const out: number[] = [];
  for (let m = Math.round(lowMidi * 2) / 2; m <= highMidi; m += 0.5) {
    if (isInScale(m, root, scaleId)) out.push(m);
  }
  return out;
}

// Snap an arbitrary pitch to the nearest member of the scale. Ties resolve
// downward — a bassline sitting a hair low reads better than a hair sharp.
// Steps in half-semitones so a maqam's quarter-tone degrees are reachable.
export function nearestScaleTone(midi: number, root: number, scaleId: ScaleId): number {
  const target = Math.round(midi * 2) / 2;
  for (let d = 0; d <= 12; d++) {
    const step = d * 0.5;
    if (isInScale(target - step, root, scaleId)) return target - step;
    if (isInScale(target + step, root, scaleId)) return target + step;
  }
  return target;
}

// The next scale tone strictly above / below `midi`.
export function scaleToneAbove(midi: number, root: number, scaleId: ScaleId): number {
  let m = Math.round(midi * 2) / 2 + 0.5;
  while (!isInScale(m, root, scaleId)) m += 0.5;
  return m;
}

export function scaleToneBelow(midi: number, root: number, scaleId: ScaleId): number {
  let m = Math.round(midi * 2) / 2 - 0.5;
  while (!isInScale(m, root, scaleId)) m -= 0.5;
  return m;
}

// The scale degree at `index` steps above the root tone `rootMidi` (index may
// be negative or run past the octave — it keeps walking the scale). Used to
// grab "the 5th", "the 3rd", etc. regardless of which scale is active.
export function scaleDegree(
  rootMidi: number,
  index: number,
  root: number,
  scaleId: ScaleId
): number {
  let m = rootMidi;
  if (index > 0) for (let i = 0; i < index; i++) m = scaleToneAbove(m, root, scaleId);
  else if (index < 0) for (let i = 0; i < -index; i++) m = scaleToneBelow(m, root, scaleId);
  return m;
}
