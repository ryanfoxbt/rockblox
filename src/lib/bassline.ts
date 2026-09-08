// A bassline is a pitched part generated from a drum pattern's kick and snare
// (see generateBassline.ts). Unlike a drum line it isn't hand-edited: the user
// sets a few knobs — root, scale, how busy the fills are — and re-rolls. The
// resolved `notes` are stored alongside the drum pattern so a reload plays the
// exact same part rather than re-generating a different one.

import type { HitAccent } from "./rhythm";
import { isScaleId, type ScaleId } from "./scales";

export interface BasslineSettings {
  // Pitch class of the key's root, 0 = C … 11 = B.
  root: number;
  scale: ScaleId;
  // Which octave the root note sits in, 1-3. 2 puts the part around E1-G2 —
  // a natural electric-bass register.
  octave: number;
  // 0 = a root note on every kick and nothing else; 10 = a busy walking line
  // with runs, chromatic approach notes and syncopation. See generateBassline.
  fills: number;
  volume: number; // 0-100, like a drum line's volume
}

export interface BassNote {
  beat: number; // 0-based beat index within the bar
  offset: number; // start position within the beat, 0..1 (fraction of a beat)
  duration: number; // length in beats
  midi: number; // absolute MIDI note number
  accent?: HitAccent;
}

export interface Bassline {
  enabled: boolean;
  settings: BasslineSettings;
  notes: BassNote[];
}

// Which parts a download (MP3 or MIDI) should contain — lets the user pull the
// drums and the generated bass out together or on their own.
export type ExportPart = "full" | "drums" | "bass";

// True when a bassline actually has something to export/play.
export function basslineHasNotes(b: Bassline | null | undefined): b is Bassline {
  return !!b && b.enabled && b.notes.length > 0;
}

export const MIN_FILLS = 0;
export const MAX_FILLS = 10;
export const DEFAULT_FILLS = 3;

export const DEFAULT_BASSLINE_SETTINGS: BasslineSettings = {
  root: 0, // C
  scale: "naturalMinor",
  octave: 2,
  fills: DEFAULT_FILLS,
  volume: 90,
};

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function isValidSettings(v: unknown): v is BasslineSettings {
  if (!v || typeof v !== "object") return false;
  const s = v as Record<string, unknown>;
  return (
    isFiniteNumber(s.root) &&
    s.root >= 0 &&
    s.root <= 11 &&
    isScaleId(s.scale) &&
    isFiniteNumber(s.octave) &&
    isFiniteNumber(s.fills) &&
    isFiniteNumber(s.volume)
  );
}

function isValidNote(v: unknown): v is BassNote {
  if (!v || typeof v !== "object") return false;
  const n = v as Record<string, unknown>;
  return (
    isFiniteNumber(n.beat) &&
    isFiniteNumber(n.offset) &&
    isFiniteNumber(n.duration) &&
    isFiniteNumber(n.midi) &&
    (n.accent === undefined || n.accent === "accent" || n.accent === "ghost")
  );
}

// Structural check for a bassline coming off the wire (an API slot payload) or
// out of localStorage (the scratchpad draft). Tolerant of extra keys; strict
// about the shape the player and the UI rely on.
export function isValidBassline(v: unknown): v is Bassline {
  if (v === null || v === undefined) return true; // absent is fine — no bassline
  if (typeof v !== "object") return false;
  const b = v as Record<string, unknown>;
  return (
    typeof b.enabled === "boolean" &&
    isValidSettings(b.settings) &&
    Array.isArray(b.notes) &&
    b.notes.every(isValidNote)
  );
}

// MIDI note for a settings object's key root, in its chosen octave. MIDI 12 =
// C0, so octave `o` root pitch-class `r` is 12 * (o + 1) + r.
export function rootMidi(settings: BasslineSettings): number {
  return 12 * (settings.octave + 1) + settings.root;
}
