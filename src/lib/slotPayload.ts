import type { BoardSlotData, ExtendedSlotLetter } from "@/lib/board";
import type { StoredLine } from "@/lib/song";
import { type CustomSamples, isValidCustomSamples } from "@/lib/customSamples";
import { type Bassline, isValidBassline } from "@/lib/bassline";

// Shared validation for slot payloads coming off the wire — used by the public
// board routes (POST /api/boards, PUT /api/boards/[slug]) and the private
// saved-song routes (/api/my-songs). Previously duplicated in each board route.

export function isValidStoredLines(lines: unknown): lines is StoredLine[] {
  return (
    Array.isArray(lines) &&
    lines.every(
      (l) =>
        l &&
        typeof l === "object" &&
        typeof (l as { instrument?: unknown }).instrument === "string" &&
        Array.isArray((l as { blocks?: unknown }).blocks)
    )
  );
}

export interface RawSlotPayload {
  bpm?: unknown;
  lines?: unknown;
  kit?: unknown;
  customSamples?: unknown;
  bassline?: unknown;
}

// A full, non-empty slot's worth of data, or undefined if the payload isn't
// one (missing/blank lines, bad bpm, malformed custom samples).
export function toSlotData(raw: RawSlotPayload): BoardSlotData | undefined {
  if (
    typeof raw.bpm === "number" &&
    Number.isFinite(raw.bpm) &&
    isValidStoredLines(raw.lines) &&
    raw.lines.length > 0 &&
    isValidCustomSamples(raw.customSamples) &&
    isValidBassline(raw.bassline)
  ) {
    return {
      bpm: raw.bpm,
      lines: raw.lines,
      kit: typeof raw.kit === "string" ? raw.kit : undefined,
      customSamples: raw.customSamples as CustomSamples | undefined,
      bassline: (raw.bassline as Bassline | undefined) ?? undefined,
    };
  }
  return undefined;
}

export interface SingleSlotBody {
  slot: ExtendedSlotLetter;
  bpm: number;
  lines: StoredLine[];
  kit?: string;
  customSamples?: CustomSamples;
  bassline?: Bassline;
}

// One-slot autosave payload (`{ slot, bpm, lines, kit?, customSamples? }`).
// `allowedSlots` is the letter set the caller accepts — SLOT_LETTERS for a
// public board, EXTENDED_SLOT_LETTERS for a saved song.
export function isValidSingleSlotBody(
  body: unknown,
  allowedSlots: readonly string[]
): body is SingleSlotBody {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  if (typeof b.slot !== "string" || !allowedSlots.includes(b.slot)) return false;
  if (typeof b.bpm !== "number" || !Number.isFinite(b.bpm)) return false;
  if (!Array.isArray(b.lines)) return false;
  if (b.kit !== undefined && typeof b.kit !== "string") return false;
  if (!isValidCustomSamples(b.customSamples)) return false;
  if (!isValidBassline(b.bassline)) return false;
  return isValidStoredLines(b.lines);
}
