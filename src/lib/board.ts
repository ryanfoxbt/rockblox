import { StoredLine } from "./song";

export type SlotLetter = "A" | "B" | "C" | "D";

export const SLOT_LETTERS: SlotLetter[] = ["A", "B", "C", "D"];

export interface BoardSlotData {
  bpm: number;
  lines: StoredLine[];
}

export interface BoardData {
  slug: string;
  displayName: string;
  slots: Record<SlotLetter, BoardSlotData | null>;
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
