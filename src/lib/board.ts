import { StoredLine } from "./song";
import { CustomSamples } from "./customSamples";
import type { StackArrangement } from "./stack";
import type { Bassline } from "./bassline";

export type SlotLetter = "A" | "B" | "C" | "D";

export const SLOT_LETTERS: SlotLetter[] = ["A", "B", "C", "D"];

// Super Powers: a signed-in user's private saved songs get eight slots
// instead of four. The base `SlotLetter`/`SLOT_LETTERS` above stay at A-D so
// every existing path (public boards, /songs, /school, Stack Builder, Text to
// Beat, the Song Crop tool) is untouched; only the saved-song Editor and its
// API opt into the wider set.
export type ExtendedSlotLetter = SlotLetter | "E" | "F" | "G" | "H";

export const EXTENDED_SLOT_LETTERS: ExtendedSlotLetter[] = ["A", "B", "C", "D", "E", "F", "G", "H"];

// A slot map that may hold either the 4-slot (A-D) or 8-slot (A-H) set. Kept
// partial so a 4-key record still satisfies it — `SlotLetter` is assignable
// to `ExtendedSlotLetter`, so existing 4-slot callers pass through unchanged.
export type SlotMap = Partial<Record<ExtendedSlotLetter, BoardSlotData | null>>;

export function isExtendedSlotLetter(value: unknown): value is ExtendedSlotLetter {
  return typeof value === "string" && (EXTENDED_SLOT_LETTERS as string[]).includes(value);
}

export interface BoardSlotData {
  bpm: number;
  lines: StoredLine[];
  // Optional so old, already-saved slots (from before a given setting
  // existed) still deserialize fine — add future remembered settings here.
  kit?: string;
  // User-recorded sounds (currently just for the Fart kit) that replace one
  // or more of the kit's stock samples, keyed by instrument slot.
  customSamples?: CustomSamples;
  // A generated bass part that follows this slot's kick and snare. Optional
  // so slots saved before the feature existed still deserialize — see
  // lib/generateBassline.ts.
  bassline?: Bassline;
}

export interface BoardData {
  slug: string;
  displayName: string;
  // A-D for public boards / songs / lessons; A-H for a signed-in user's
  // private saved song (see SlotMap and the Editor's `slotLetters` prop).
  slots: SlotMap;
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
  // Only set when the OWNER of a private saved song opens it (never on a
  // public board, a curated song, or the read-only /s/<slug> view): the
  // song's current public-sharing state, so the header can show a Share
  // control and, once shared, the /s/<slug> link. `slug` is null until
  // sharing has been enabled at least once.
  publicShare?: { isPublic: boolean; slug: string | null };
}

const NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]{1,23}$/;

// Words that would collide with existing routes/assets, or that we don't
// want people impersonating on a public, unauthenticated vanity URL.
const RESERVED_NAMES = new Set([
  "p",
  "api",
  "admin",
  "my",
  "auth",
  "rockblocks",
  "www",
  "app",
  "login",
  "logout",
  "signup",
  "signin",
  "songs",
  "school",
  "math",
  "test",
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
