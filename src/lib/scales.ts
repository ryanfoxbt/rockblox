// Scale catalog for the bassline generator. Each scale is a set of semitone
// offsets from its root, within one octave (0 = the root, 12 excluded). The
// generator snaps every pitch it picks to one of these so a bassline stays in
// the key the user chose — see generateBassline.ts.

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
// the app's MIDI export already assumes (see midiEncoder.ts).
export function midiNoteName(midi: number): string {
  const name = NOTE_NAMES[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${name}${octave}`;
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
export function isInScale(midi: number, root: number, scaleId: ScaleId): boolean {
  const degree = (((midi - root) % 12) + 12) % 12;
  return SCALES[scaleId].intervals.includes(degree);
}

// Every scale tone from `lowMidi` to `highMidi` inclusive, ascending.
export function scalePitches(
  root: number,
  scaleId: ScaleId,
  lowMidi: number,
  highMidi: number
): number[] {
  const out: number[] = [];
  for (let m = lowMidi; m <= highMidi; m++) {
    if (isInScale(m, root, scaleId)) out.push(m);
  }
  return out;
}

// Snap an arbitrary pitch to the nearest member of the scale. Ties resolve
// downward — a bassline sitting a hair low reads better than a hair sharp.
export function nearestScaleTone(midi: number, root: number, scaleId: ScaleId): number {
  const target = Math.round(midi);
  for (let d = 0; d <= 6; d++) {
    if (isInScale(target - d, root, scaleId)) return target - d;
    if (isInScale(target + d, root, scaleId)) return target + d;
  }
  return target;
}

// The next scale tone strictly above / below `midi`.
export function scaleToneAbove(midi: number, root: number, scaleId: ScaleId): number {
  let m = Math.round(midi) + 1;
  while (!isInScale(m, root, scaleId)) m++;
  return m;
}

export function scaleToneBelow(midi: number, root: number, scaleId: ScaleId): number {
  let m = Math.round(midi) - 1;
  while (!isInScale(m, root, scaleId)) m--;
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
