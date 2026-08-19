import { CustomSamples, isValidCustomSamples } from "./customSamples";
import { StoredLine } from "./song";

// A safety net for the homepage's scratchpad — the one place in the editor
// with no board to autosave to (see Editor.tsx's isScratchpad), so a beat
// built there lives only in React state until the user claims a URL for it.
// That's exactly the case where a refresh — including the "reload to fix
// stuck headphone audio" workaround — would otherwise silently wipe it.
// localStorage survives the reload; it's cleared once the beat is actually
// claimed (see ClaimUrlBox) since it's no longer the only copy at that point.
const DRAFT_KEY = "rockblocks:draft";

export interface Draft {
  bpm: number;
  lines: StoredLine[];
  kit: string;
  customSamples: CustomSamples;
}

function isValidDraft(value: unknown): value is Draft {
  if (!value || typeof value !== "object") return false;
  const d = value as Record<string, unknown>;
  if (typeof d.bpm !== "number" || !Number.isFinite(d.bpm)) return false;
  if (typeof d.kit !== "string") return false;
  if (!Array.isArray(d.lines)) return false;
  if (!isValidCustomSamples(d.customSamples)) return false;
  return d.lines.every(
    (l) =>
      l &&
      typeof l === "object" &&
      typeof (l as { instrument?: unknown }).instrument === "string" &&
      Array.isArray((l as { blocks?: unknown }).blocks)
  );
}

export function loadDraft(): Draft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isValidDraft(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveDraft(draft: Draft): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Storage full or disabled (e.g. private browsing) — losing this safety
    // net silently beats breaking the editor over it.
  }
}

export function clearDraft(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    // see saveDraft
  }
}
