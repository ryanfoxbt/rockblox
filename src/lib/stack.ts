import { SLOT_LETTERS, SlotLetter } from "./board";

// A user's claimed page holds up to 4 beats (A-D, see board.ts). Stack
// Builder lets them arrange repeats of those beats into one longer song,
// all played at one shared tempo instead of each slot's own saved bpm.
export interface StackStep {
  id: string;
  slot: SlotLetter;
}

export interface StackArrangement {
  bpm: number;
  steps: StackStep[];
}

export const MAX_STACK_SECONDS = 180;

export function createStepId(): string {
  return `step-${Math.random().toString(36).slice(2, 10)}`;
}

export function stepDurationSeconds(measureLength: number, bpm: number): number {
  return (60 / bpm) * measureLength;
}

export function totalStackSeconds(
  steps: StackStep[],
  measureLengths: Record<SlotLetter, number>,
  bpm: number
): number {
  return steps.reduce((sum, step) => sum + stepDurationSeconds(measureLengths[step.slot] ?? 0, bpm), 0);
}

export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

export function isValidStackArrangement(value: unknown): value is StackArrangement {
  if (value === undefined || value === null) return true;
  if (typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v.bpm !== "number" || !Number.isFinite(v.bpm)) return false;
  if (!Array.isArray(v.steps)) return false;
  return v.steps.every(
    (s) =>
      s &&
      typeof s === "object" &&
      typeof (s as { id?: unknown }).id === "string" &&
      SLOT_LETTERS.includes((s as { slot?: unknown }).slot as SlotLetter)
  );
}
