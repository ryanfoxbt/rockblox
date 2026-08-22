import { StoredLine } from "./song";
import { CustomSamples } from "./customSamples";
import type { StackArrangement } from "./stack";

export type SlotLetter = "A" | "B" | "C" | "D";

export const SLOT_LETTERS: SlotLetter[] = ["A", "B", "C", "D"];

export interface BoardSlotData {
  bpm: number;
  lines: StoredLine[];
  // Optional so old, already-saved slots (from before a given setting
  // existed) still deserialize fine — add future remembered settings here.
  kit?: string;
  // User-recorded sounds (currently just for the Fart kit) that replace one
  // or more of the kit's stock samples, keyed by instrument slot.
  customSamples?: CustomSamples;
}

export interface BoardData {
  slug: string;
  displayName: string;
  slots: Record<SlotLetter, BoardSlotData | null>;
  // The Stack Builder arrangement (sequencing repeats of A-D into one longer
  // song), if this page's owner has built one. Board-level, not per-slot.
  stack?: StackArrangement | null;
  // Whether Text to Beat's preview shows the "rules used" breakdown.
  textToBeatShowRules?: boolean;
  // Curated /songs content rendered through this same board UI: playable
  // and editable in the browser, but never autosaved back — every visitor
  // always sees the original mapping. Also suppresses per-owner features
  // (TextyBeat's save, the Wall, presence) that don't make sense on a page
  // nobody claimed. See src/app/songs/[slug]/page.tsx.
  readOnly?: boolean;
  // Where this board's own links point — "/DisplayName" for a normal
  // claimed board, "/songs/slug" for a read-only song. Only ever differs
  // from the default when readOnly is set.
  basePath?: string;
  // Shown instead of the normal "Your page: /X" + save-status row when
  // readOnly, e.g. "Blitzkrieg Bop — The Ramones".
  subtitle?: string;
}

const NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]{1,23}$/;

// Words that would collide with existing routes/assets, or that we don't
// want people impersonating on a public, unauthenticated vanity URL.
const RESERVED_NAMES = new Set([
  "p",
  "api",
  "admin",
  "rockblocks",
  "www",
  "app",
  "login",
  "logout",
  "signup",
  "signin",
  "songs",
  "about",
  "help",
  "static",
  "assets",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
  "_next",
]);

export function isValidBoardName(name: string): boolean {
  return NAME_PATTERN.test(name);
}

export function isReservedBoardName(name: string): boolean {
  return RESERVED_NAMES.has(name.toLowerCase());
}

export function normalizeBoardSlug(name: string): string {
  return name.toLowerCase();
}
