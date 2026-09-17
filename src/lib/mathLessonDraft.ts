import { isValidCustomSamples } from "./customSamples";
import { isValidBassline } from "./bassline";
import { EXTENDED_SLOT_LETTERS, type SlotMap, type BoardSlotData } from "./board";

// Keeps a math lesson's in-progress answers (all four slots) across a
// refresh — the same problem draftStorage.ts solves for the homepage
// scratchpad, but keyed per lesson slug since every lesson's four slots are
// their own independent answer canvas (see MathLessonWorkspace) and a
// visitor working through several lessons in a row should be able to
// refresh any one of them without losing that slot's in-progress beat.
// Never synced to an account; purely a "don't lose my work on an accidental
// refresh" safety net, same as the scratchpad draft.
const KEY_PREFIX = "rockblocks:math-draft:";

function isValidSlotData(value: unknown): value is BoardSlotData {
  if (!value || typeof value !== "object") return false;
  const d = value as Record<string, unknown>;
  if (typeof d.bpm !== "number" || !Number.isFinite(d.bpm)) return false;
  if (!Array.isArray(d.lines)) return false;
  if (d.kit !== undefined && typeof d.kit !== "string") return false;
  if (!isValidCustomSamples(d.customSamples)) return false;
  if (!isValidBassline(d.bassline)) return false;
  return d.lines.every(
    (l) =>
      l &&
      typeof l === "object" &&
      typeof (l as { instrument?: unknown }).instrument === "string" &&
      Array.isArray((l as { blocks?: unknown }).blocks)
  );
}

function isValidSlotMap(value: unknown): value is SlotMap {
  if (!value || typeof value !== "object") return false;
  return Object.entries(value as Record<string, unknown>).every(
    ([key, slot]) =>
      (EXTENDED_SLOT_LETTERS as string[]).includes(key) && (slot === null || isValidSlotData(slot))
  );
}

export function loadMathLessonDraft(lessonSlug: string): SlotMap | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + lessonSlug);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isValidSlotMap(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveMathLessonDraft(lessonSlug: string, slots: SlotMap): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY_PREFIX + lessonSlug, JSON.stringify(slots));
  } catch {
    // Storage full or disabled (e.g. private browsing) — the student's
    // in-progress answer just won't survive a refresh this session; nothing
    // here is essential.
  }
}

export function clearMathLessonDraft(lessonSlug: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY_PREFIX + lessonSlug);
  } catch {
    // see saveMathLessonDraft
  }
}
