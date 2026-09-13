// The bassline's "melody" mode: composes a free-standing melodic line across
// the bar instead of locking onto the drum pattern's kick/snare (that's
// generateBassline.ts, the "groove" mode). The only thing it borrows from the
// drum pattern is `measureLength` — it still adheres to the time signature,
// it just doesn't need an actual hit anywhere to anchor on. A single
// "melodyComplexity" dial (1-10, separate from groove's "fills" — a different
// generator, a different notion of "busy") controls note density, how far the
// line roams from its anchor, and how often a landing gets ornamented with a
// fast neighbor-tone grace note or turn.
//
// That ornament figure is where the "intricate maqam/raga" sound comes from:
// it grabs its neighbor via scaleToneAbove/scaleToneBelow, which already walk
// a quarter-tone scale's own grid (see scales.ts) — so a neighbor tone next to
// a maqam Rast or Bayati degree is a neutral second/third away, not a plain
// semitone, with zero special-casing needed here.
//
// Like generateBassline this leans on Math.random() and isn't seeded;
// "Regenerate" in the UI just runs it again.

import type { HitAccent } from "./rhythm";
import type { BassNote, BasslineSettings } from "./bassline";
import { DEFAULT_MELODY_COMPLEXITY, rootMidi } from "./bassline";
import { scaleToneAbove, scaleToneBelow } from "./scales";
import { BASS_LOW, BASS_HIGH } from "./generateBassline";

const UNIT = 0.25; // one 16th note, in beats — the melody's rhythmic grid

// Note duration, in 16th-note units, blended between a "simple" weighting
// (mostly quarters and halves) and a "busy" one (mostly 8ths and 16ths) by
// complexity. 8 = half, 6 = dotted quarter, 4 = quarter, 3 = dotted 8th,
// 2 = 8th, 1 = 16th.
const DURATION_UNITS = [8, 6, 4, 3, 2, 1];
const SIMPLE_UNIT_WEIGHTS: Record<number, number> = { 8: 0.25, 6: 0.05, 4: 0.45, 3: 0.05, 2: 0.2, 1: 0 };
const BUSY_UNIT_WEIGHTS: Record<number, number> = { 8: 0, 6: 0, 4: 0.05, 3: 0.1, 2: 0.35, 1: 0.5 };

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function near(a: number, b: number, eps = 1e-6): boolean {
  return Math.abs(a - b) < eps;
}

// Piecewise-linear lookup over (complexity, value) control points — same
// shape as generateBassline's lerpPoints, kept local for the same reason that
// one is: it isn't exported.
function lerpPoints(x: number, points: [number, number][]): number {
  const cx = clamp(x, points[0][0], points[points.length - 1][0]);
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    if (cx >= x0 && cx <= x1) {
      const t = x1 === x0 ? 0 : (cx - x0) / (x1 - x0);
      return y0 + (y1 - y0) * t;
    }
  }
  return points[points.length - 1][1];
}

function weightedPick(items: number[], weights: number[]): number {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

function pickDurationUnits(complexity: number): number {
  const t = clamp((complexity - 1) / 9, 0, 1);
  const weights = DURATION_UNITS.map(
    (u) => SIMPLE_UNIT_WEIGHTS[u] * (1 - t) + BUSY_UNIT_WEIGHTS[u] * t
  );
  return weightedPick(DURATION_UNITS, weights);
}

export function generateMelody(measureLength: number, settings: BasslineSettings): BassNote[] {
  if (measureLength < 1) return [];

  const { root, scale } = settings;
  const c = clamp(settings.melodyComplexity ?? DEFAULT_MELODY_COMPLEXITY, 1, 10);

  // Same anchor logic as generateBassline: keep the root's pitch class exact,
  // shift by whole octaves into a sane register.
  let anchor = rootMidi(settings);
  while (anchor < BASS_LOW + 2) anchor += 12;
  while (anchor > BASS_HIGH - 4) anchor -= 12;

  // How far (in semitones) the line may roam from its anchor — narrow and
  // singable at low complexity, sweeping over an octave-plus at high.
  const rangeSpan = lerpPoints(c, [[1, 4], [4, 7], [7, 12], [10, 18]]);
  const lo = clamp(anchor - rangeSpan, BASS_LOW, BASS_HIGH);
  const hi = clamp(anchor + rangeSpan, BASS_LOW, BASS_HIGH);

  const repeatChance = lerpPoints(c, [[1, 0.18], [10, 0.05]]);
  const leapChance = lerpPoints(c, [[1, 0.05], [4, 0.15], [7, 0.35], [10, 0.55]]);
  // How often the walk keeps going the same direction rather than reversing —
  // gives phrases a sense of arc/contour instead of a pure random walk.
  const directionPersistence = lerpPoints(c, [[1, 0.75], [10, 0.35]]);
  const ornamentChance = lerpPoints(c, [[1, 0.04], [4, 0.16], [7, 0.34], [10, 0.55]]);
  const turnFigureChance = lerpPoints(c, [[1, 0], [5, 0.06], [10, 0.28]]);
  const restChance = lerpPoints(c, [[1, 0.12], [10, 0.02]]);

  // Walks `steps` scale degrees from `from` in `dir`, stopping short (rather
  // than overshooting) if it would leave the roam range.
  const walk = (from: number, steps: number, dir: number): number => {
    let m = from;
    for (let i = 0; i < steps; i++) {
      const next = dir > 0 ? scaleToneAbove(m, root, scale) : scaleToneBelow(m, root, scale);
      if (next < lo || next > hi) break;
      m = next;
    }
    return m;
  };

  const notes: BassNote[] = [];
  let pos = 0; // beats into the bar
  let current = anchor;
  let direction = Math.random() < 0.5 ? 1 : -1;

  while (pos < measureLength - 1e-6) {
    const unitsLeft = Math.round((measureLength - pos) / UNIT);
    const units = Math.min(pickDurationUnits(c), unitsLeft);
    if (units < 1) break;

    // Rest instead of a note — but never on the bar's very first beat, so the
    // line always has a clear downbeat to anchor on.
    if (pos > 0 && Math.random() < restChance) {
      pos += units * UNIT;
      continue;
    }

    // Mostly keep going the way it was, occasionally reverse. At a range
    // edge there's nowhere left to go that way, so turn around regardless.
    if (Math.random() > directionPersistence) direction *= -1;
    if (direction > 0 && current >= hi) direction = -1;
    if (direction < 0 && current <= lo) direction = 1;

    let target: number;
    if (Math.random() < repeatChance) {
      target = current;
    } else if (Math.random() < leapChance) {
      target = walk(current, 2 + Math.floor(Math.random() * 3), direction); // 2-4 scale degrees
    } else {
      target = walk(current, 1, direction);
    }

    const accent: HitAccent | undefined =
      near(pos % 1, 0) && Math.random() < 0.25 ? "accent" : undefined;
    const beatOf = (p: number) => Math.floor(p);
    const offsetOf = (p: number) => p - Math.floor(p);

    // A landing can get ornamented with either a quick neighbor-tone grace
    // note or (more elaborate, more likely at higher complexity) a full turn
    // figure around it — both need at least two units of room.
    if (units >= 2 && Math.random() < turnFigureChance) {
      const upper = scaleToneAbove(target, root, scale);
      const lower = scaleToneBelow(target, root, scale);
      const figure = Math.random() < 0.5 ? [upper, target, lower, target] : [lower, target, upper, target];
      const figUnits = Math.min(units, figure.length);
      const each = Math.max(1, Math.floor(units / figUnits));
      let used = 0;
      for (let i = 0; i < figUnits; i++) {
        const u = i === figUnits - 1 ? units - used : each;
        const p = pos + used * UNIT;
        notes.push({
          beat: beatOf(p),
          offset: offsetOf(p),
          duration: u * UNIT,
          midi: figure[i],
          accent: i === figUnits - 1 ? accent : "ghost",
        });
        used += u;
      }
    } else if (units >= 2 && Math.random() < ornamentChance) {
      const neighbor =
        Math.random() < 0.5 ? scaleToneAbove(target, root, scale) : scaleToneBelow(target, root, scale);
      notes.push({ beat: beatOf(pos), offset: offsetOf(pos), duration: UNIT, midi: neighbor, accent: "ghost" });
      const p2 = pos + UNIT;
      notes.push({
        beat: beatOf(p2),
        offset: offsetOf(p2),
        duration: (units - 1) * UNIT,
        midi: target,
        accent,
      });
    } else {
      notes.push({ beat: beatOf(pos), offset: offsetOf(pos), duration: units * UNIT, midi: target, accent });
    }

    current = target;
    pos += units * UNIT;
  }

  return notes;
}
