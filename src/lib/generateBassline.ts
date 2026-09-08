// Turns a drum pattern into a bassline. The kick is the backbone — every kick
// onset gets a bass note — and the snare is the secondary anchor. A single
// "fills" dial (0-10) decides how much the line does beyond that: whether the
// snare gets its own notes, whether gaps get passing tones, how often the line
// walks by step into the next beat, and whether the bar's last beat breaks
// into a run. Pitches are snapped to the chosen scale (see scales.ts) except
// for deliberate chromatic approach notes at the high end of the dial.
//
// Like the drum generators in randomBeat.ts this leans on Math.random() and
// isn't seeded; "Regenerate" in the UI just runs it again. The caller stores
// the resolved notes so playback and reloads stay stable until the next roll.

import { NOTE_FRACTION, type HitAccent } from "./rhythm";
import type { LineData } from "./song";
import type { BassNote, BasslineSettings } from "./bassline";
import { rootMidi } from "./bassline";
import { nearestScaleTone, scaleToneAbove, scaleToneBelow } from "./scales";

// Absolute MIDI range a generated note may occupy — roughly C1 to C4, the
// usable span of a 4-string bass plus a little headroom.
export const BASS_LOW = 24;
export const BASS_HIGH = 60;

interface Onset {
  beat: number;
  offset: number; // 0..1 within the beat
  pos: number; // beat + offset, for convenience
  accent?: HitAccent;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

// Piecewise-linear lookup over (fills, value) control points — same shape as
// randomBeat.ts's scaleByComplexity, kept local since that one isn't exported.
function lerpPoints(fills: number, points: [number, number][]): number {
  const x = clamp(fills, points[0][0], points[points.length - 1][0]);
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    if (x >= x0 && x <= x1) {
      const t = x1 === x0 ? 0 : (x - x0) / (x1 - x0);
      return y0 + (y1 - y0) * t;
    }
  }
  return points[points.length - 1][1];
}

// Every "note" hit on the first line with this instrument, as fractional beat
// positions — same hit-walk the audio engine and MIDI encoder use.
function lineOnsets(lines: LineData[], instrument: string, measureLength: number): Onset[] {
  const line = lines.find((l) => l.instrument === instrument);
  if (!line) return [];
  const onsets: Onset[] = [];
  for (let beat = 0; beat < measureLength; beat++) {
    const tile = line.blocks[beat];
    if (!tile) continue;
    let acc = 0;
    for (const h of tile.hits) {
      if (h.type === "note") {
        onsets.push({ beat, offset: acc, pos: beat + acc, accent: h.accent });
      }
      acc += NOTE_FRACTION[h.note];
    }
  }
  return onsets;
}

function near(a: number, b: number, eps = 0.06): boolean {
  return Math.abs(a - b) < eps;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateBassline(
  lines: LineData[],
  measureLength: number,
  settings: BasslineSettings
): BassNote[] {
  if (measureLength < 1) return [];

  const { root, scale, fills } = settings;
  // Keep the root's pitch class exactly — only shift by whole octaves to land
  // it in a sane bass window. (A plain clamp would round C1 up to E1 and
  // silently change the key.)
  let anchor = rootMidi(settings);
  while (anchor < BASS_LOW + 2) anchor += 12;
  while (anchor > BASS_HIGH - 12) anchor -= 12;

  // Chord tones, robust across every scale: snap the just-intonation-ish
  // interval above the root to the nearest scale member.
  const third = nearestScaleTone(anchor + 4, root, scale);
  const fifth = nearestScaleTone(anchor + 7, root, scale);
  const seventh = nearestScaleTone(anchor + 10, root, scale);
  const octaveUp = clamp(anchor + 12, BASS_LOW, BASS_HIGH);
  const chordTones = [anchor, fifth, octaveUp, third, seventh];

  // --- fills-driven probabilities ---------------------------------------
  const snareChance = lerpPoints(fills, [[0, 0], [2, 0.35], [5, 0.75], [10, 1]]);
  const passingChance = lerpPoints(fills, [[0, 0], [3, 0.22], [6, 0.55], [10, 0.85]]);
  const octaveChance = lerpPoints(fills, [[0, 0], [2, 0.06], [6, 0.22], [10, 0.4]]);
  const chordToneChance = lerpPoints(fills, [[0, 0], [3, 0.14], [6, 0.38], [10, 0.62]]);
  const walkChance = lerpPoints(fills, [[0, 0], [4, 0.2], [7, 0.5], [10, 0.8]]);
  const runChance = lerpPoints(fills, [[0, 0], [5, 0.15], [8, 0.5], [10, 0.85]]);
  const chromaticChance = lerpPoints(fills, [[0, 0], [6, 0.12], [10, 0.4]]);
  const ghostChance = lerpPoints(fills, [[0, 0.04], [10, 0.28]]);

  const kick = lineOnsets(lines, "kick", measureLength);
  const snare = lineOnsets(lines, "snare", measureLength);

  // Skeleton onset positions: every kick hit. If the pattern has no kick at
  // all, fall back to the downbeat of each beat so the line isn't empty.
  const skeleton: Onset[] =
    kick.length > 0
      ? kick
      : Array.from({ length: measureLength }, (_, b) => ({ beat: b, offset: 0, pos: b }));

  const notes: BassNote[] = [];
  const add = (pos: number, midi: number, accent?: HitAccent) => {
    const beat = Math.floor(pos + 1e-6);
    notes.push({
      beat,
      offset: clamp(pos - beat, 0, 0.9999),
      duration: 0.25, // provisional; recomputed as gap-to-next below
      midi: clamp(Math.round(midi), BASS_LOW, BASS_HIGH),
      accent,
    });
  };

  // --- 1. a note on every skeleton (kick) onset ------------------------
  skeleton.forEach((on, i) => {
    const strong = near(on.offset, 0);
    let midi = anchor;
    if (strong && Math.random() < chordToneChance) {
      // Weight the low chord tones: root, 5th, octave show up first.
      midi = pick(chordTones.slice(0, Math.random() < 0.5 ? 2 : chordTones.length));
    }
    // An octave pop, but never stacked past one octave over the root — two
    // lifts in a row (e.g. off the already-octave-up chord tone) jumps the
    // line right out of a bass register.
    if (midi < anchor + 12 && Math.random() < octaveChance) {
      midi = clamp(midi + 12, BASS_LOW, anchor + 12);
    }
    add(on.pos, midi, on.accent);

    // --- walking approach into the next skeleton onset ---------------
    const next = skeleton[i + 1];
    if (next && Math.random() < walkChance && next.pos - on.pos >= 0.5) {
      const targetIsChromatic = Math.random() < chromaticChance;
      const apPos = next.pos - (next.pos - on.pos >= 1 ? 0.5 : 0.25);
      const fromAbove = Math.random() < 0.5;
      const approach = targetIsChromatic
        ? anchor + (fromAbove ? 1 : -1)
        : fromAbove
          ? scaleToneAbove(anchor, root, scale)
          : scaleToneBelow(anchor, root, scale);
      add(apPos, approach, Math.random() < ghostChance ? "ghost" : undefined);
    }
  });

  // --- 2. passing tones in the wide gaps between skeleton onsets ------
  for (let i = 0; i < skeleton.length - 1; i++) {
    const a = skeleton[i];
    const b = skeleton[i + 1];
    const gap = b.pos - a.pos;
    if (gap <= 0.75 || Math.random() >= passingChance) continue;
    const mid = a.pos + gap / 2;
    const quantized = Math.round(mid * 4) / 4; // nearest 16th
    if (quantized <= a.pos + 0.1 || quantized >= b.pos - 0.1) continue;
    const step = Math.random() < 0.5 ? scaleToneAbove(anchor, root, scale) : scaleToneBelow(anchor, root, scale);
    add(quantized, step, Math.random() < ghostChance ? "ghost" : undefined);
  }

  // --- 3. snare reinforcement ---------------------------------------
  for (const s of snare) {
    if (skeleton.some((k) => near(k.pos, s.pos))) continue;
    if (Math.random() >= snareChance) continue;
    const midi = Math.random() < chordToneChance ? pick([fifth, octaveUp, third]) : anchor;
    add(s.pos, midi, s.accent);
  }

  // --- 4. turnaround run on the bar's last beat --------------------
  if (Math.random() < runChance) {
    const lastBeat = measureLength - 1;
    const sub = fills >= 8 && Math.random() < 0.6 ? 4 : 2; // 16ths or 8ths
    // Remove anything already sitting after the downbeat of the last beat so
    // the run reads cleanly.
    for (let j = notes.length - 1; j >= 0; j--) {
      if (notes[j].beat === lastBeat && notes[j].offset > 0.01) notes.splice(j, 1);
    }
    let tone = pick([anchor, fifth, third]);
    const ascending = Math.random() < 0.5;
    for (let s = 1; s < sub; s++) {
      tone = ascending
        ? scaleToneAbove(tone, root, scale)
        : scaleToneBelow(tone, root, scale);
      add(lastBeat + s / sub, tone, Math.random() < ghostChance ? "ghost" : undefined);
    }
  }

  // --- 5. tidy: sort, de-dupe, recompute durations, clamp to the bar ---
  notes.sort((a, b) => a.beat + a.offset - (b.beat + b.offset));

  const deduped: BassNote[] = [];
  for (const n of notes) {
    const prev = deduped[deduped.length - 1];
    if (prev && near(prev.beat + prev.offset, n.beat + n.offset, 0.03)) {
      // Keep the louder of two coincident notes (accent > normal > ghost).
      const rank = (a?: HitAccent) => (a === "accent" ? 2 : a === "ghost" ? 0 : 1);
      if (rank(n.accent) > rank(prev.accent)) deduped[deduped.length - 1] = n;
      continue;
    }
    deduped.push(n);
  }

  for (let i = 0; i < deduped.length; i++) {
    const n = deduped[i];
    const start = n.beat + n.offset;
    const nextStart = i + 1 < deduped.length ? deduped[i + 1].beat + deduped[i + 1].offset : measureLength;
    n.duration = clamp(nextStart - start, 0.1, 2);
  }

  return deduped.filter((n) => n.beat < measureLength);
}

// Re-pitch an existing bassline for a new key / octave / scale WITHOUT re-rolling
// its rhythm. Transposition by the (shortest-path) root move plus whole octaves
// preserves the line's melodic shape; the scale re-snap keeps every note in the
// new key. The Bassline modal uses this so key/scale/octave (and volume, which
// is playback-only) apply instantly — only the Fills dial changes *which* notes
// exist, so that one still calls generateBassline.
export function repitchBassline(
  notes: BassNote[],
  from: BasslineSettings,
  to: BasslineSettings
): BassNote[] {
  // Shortest-path pitch-class move for the root, so C→B steps down 1 rather
  // than up 11 and the line doesn't jump an octave on a small key change.
  let pcDelta = (((to.root - from.root) % 12) + 12) % 12;
  if (pcDelta > 6) pcDelta -= 12;
  const delta = pcDelta + 12 * (to.octave - from.octave);

  return notes.map((n) => {
    let midi = clamp(n.midi + delta, BASS_LOW, BASS_HIGH);
    midi = nearestScaleTone(midi, to.root, to.scale);
    return { ...n, midi: clamp(midi, BASS_LOW, BASS_HIGH) };
  });
}
