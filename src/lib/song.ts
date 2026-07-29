import { InstrumentId, defaultInstrumentFor } from "./instruments";
import { RhythmTile } from "./rhythm";

export const MAX_BEATS = 7;

export interface LineData {
  id: string;
  instrument: InstrumentId;
  blocks: (RhythmTile | null)[];
}

export function createLine(index: number): LineData {
  return {
    id: `line-${index}-${Math.random().toString(36).slice(2, 8)}`,
    instrument: defaultInstrumentFor(index),
    blocks: Array(MAX_BEATS).fill(null),
  };
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
