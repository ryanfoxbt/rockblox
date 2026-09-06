import { InstrumentId, defaultInstrumentFor } from "./instruments";
import { RhythmTile, getTileById } from "./rhythm";

// Hard ceiling on beats in one pattern. The grid shows far fewer by default
// (see DEFAULT_GRID_BEATS) — this is just how far it can be pulled open.
export const MAX_BEATS = 8;

// The starter grid: three voices and four beats, enough to build a
// recognizable 4/4 groove with zero setup. Both narrower (3 beats = 3/4)
// and wider (up to MAX_BEATS) are reachable from the grid's edge nudge, but
// 4 is the prominent home the Editor opens on and returns to.
export const DEFAULT_GRID_BEATS = 4;
export const MIN_GRID_BEATS = 3;

// Top to bottom: hi-hat, snare, bass drum — the three voices a fresh
// pattern starts with. Adding a 4th+ piece falls back to defaultInstrumentFor.
export const DEFAULT_LINE_INSTRUMENTS: InstrumentId[] = ["hihatClosed", "snare", "kick"];

export const DEFAULT_VOLUME = 100;

export interface StoredLine {
  instrument: string;
  blocks: (string | null)[];
  volume?: number;
}

export interface StoredSong {
  bpm: number;
  lines: StoredLine[];
}

export interface LineData {
  id: string;
  instrument: InstrumentId;
  blocks: (RhythmTile | null)[];
  volume: number; // 0-100
}

export function createLine(index: number): LineData {
  return {
    id: `line-${index}-${Math.random().toString(36).slice(2, 8)}`,
    instrument: defaultInstrumentFor(index),
    blocks: Array(MAX_BEATS).fill(null),
    volume: DEFAULT_VOLUME,
  };
}

// The three-voice starter pattern a fresh Editor opens on (homepage
// scratchpad, a newly claimed page, an empty board slot) — hi-hat / snare /
// bass, every beat empty.
export function createDefaultLines(): LineData[] {
  return DEFAULT_LINE_INSTRUMENTS.map((instrument, index) => ({
    id: `line-${index}-${Math.random().toString(36).slice(2, 8)}`,
    instrument,
    blocks: Array(MAX_BEATS).fill(null),
    volume: DEFAULT_VOLUME,
  }));
}

export function serializeLines(lines: LineData[]): StoredLine[] {
  return lines.map((l) => ({
    instrument: l.instrument,
    blocks: l.blocks.map((b) => b?.id ?? null),
    volume: l.volume,
  }));
}

export function deserializeLines(stored: StoredLine[]): LineData[] {
  return stored.map((l, index) => {
    const tiles = l.blocks.map((id) => (id ? getTileById(id) ?? null : null));
    return {
      id: `line-${index}-${Math.random().toString(36).slice(2, 8)}`,
      instrument: l.instrument as InstrumentId,
      // Normalize to exactly MAX_BEATS slots so the grid can always slice up
      // to the visible beat count — patterns saved before a MAX_BEATS bump
      // store fewer, and a generator could hand us a shorter array too.
      blocks: Array.from({ length: MAX_BEATS }, (_, i) => tiles[i] ?? null),
      volume: l.volume ?? DEFAULT_VOLUME,
    };
  });
}

export function computeMeasureLength(lines: LineData[]): number {
  let max = 0;
  for (const line of lines) {
    for (let i = line.blocks.length - 1; i >= 0; i--) {
      if (line.blocks[i]) {
        max = Math.max(max, i + 1);
        break;
      }
    }
  }
  return max;
}

// Same measure-length rule as computeMeasureLength above, but for the
// as-stored (not-yet-deserialized) shape — used server-side where we don't
// need to resolve tile ids, just how many beat-blocks are filled.
export function measureLengthFromStoredLines(lines: StoredLine[]): number {
  let max = 0;
  for (const line of lines) {
    for (let i = line.blocks.length - 1; i >= 0; i--) {
      if (line.blocks[i]) {
        max = Math.max(max, i + 1);
        break;
      }
    }
  }
  return max;
}
