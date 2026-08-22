import { InstrumentId, defaultInstrumentFor } from "./instruments";
import { RhythmTile, getTileById } from "./rhythm";

export const MAX_BEATS = 7;

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

export function serializeLines(lines: LineData[]): StoredLine[] {
  return lines.map((l) => ({
    instrument: l.instrument,
    blocks: l.blocks.map((b) => b?.id ?? null),
    volume: l.volume,
  }));
}

export function deserializeLines(stored: StoredLine[]): LineData[] {
  return stored.map((l, index) => ({
    id: `line-${index}-${Math.random().toString(36).slice(2, 8)}`,
    instrument: l.instrument as InstrumentId,
    blocks: l.blocks.map((id) => (id ? getTileById(id) ?? null : null)),
    volume: l.volume ?? DEFAULT_VOLUME,
  }));
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
