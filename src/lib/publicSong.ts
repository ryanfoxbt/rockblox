// Public sharing of a signed-in user's saved song: the owner flips a switch
// (see SharePublicButton + the /api/my-songs/[id] PUT), and the song becomes
// readable at /s/<publicSlug> with no login — same read-only Editor /
// StackBuilder the curated /songs pages use, so a visitor can play and remix
// it but never writes back to the owner's copy.

import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { userSongs } from "@/db/schema";
import { EXTENDED_SLOT_LETTERS, type SlotMap } from "@/lib/board";
import { measureLengthFromStoredLines } from "@/lib/song";
import { formatDuration, totalStackSeconds, type StackArrangement } from "@/lib/stack";

export { SITE_URL } from "@/lib/seo";

// A URL-safe slug from a saved-song title: lowercased, accents stripped, runs
// of anything non-alphanumeric collapsed to single dashes, trimmed, and
// capped so "/s/<slug>-<suffix>" stays short. Falls back to "song" for a
// title that slugifies to nothing (all emoji, all punctuation, empty).
export function slugifyTitle(title: string): string {
  // NFKD splits accented letters into base + combining mark; the [^a-z0-9]
  // pass then drops the marks (and everything else non-alphanumeric) — so
  // "Café Déjà-Vu!" becomes "cafe-deja-vu".
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return base || "song";
}

// Short random suffix appended to the title slug so two songs called "My
// Beat" get distinct links. ~1.7M values, and the `public_slug` unique
// constraint plus a retry loop in the API handle the rare collision.
export function slugSuffix(): string {
  return Math.random().toString(36).slice(2, 6);
}

export interface PublicSong {
  id: string;
  title: string;
  slug: string;
  slots: SlotMap;
  stack: StackArrangement | null;
}

// Loads a saved song by its public slug, only if the owner currently has
// sharing turned on. Returns null both for "no such slug" and "slug exists
// but sharing is off" — a link simply stops resolving the moment it's made
// private, with nothing to distinguish the two from outside.
export async function loadPublicSong(slug: string): Promise<PublicSong | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(userSongs)
    .where(and(eq(userSongs.publicSlug, slug), eq(userSongs.isPublic, true)))
    .limit(1);
  if (!row) return null;
  return { id: row.id, title: row.title, slug, slots: row.slots, stack: row.stack ?? null };
}

// Per-slot bar lengths for a song's slots, for the stack duration math.
function measureLengths(slots: SlotMap): Partial<Record<string, number>> {
  const m: Partial<Record<string, number>> = {};
  for (const letter of EXTENDED_SLOT_LETTERS) {
    const slot = slots[letter];
    m[letter] = slot ? measureLengthFromStoredLines(slot.lines) : 0;
  }
  return m;
}

// A short "6 sections · 0:48" / "3 beats" line describing what's in the song,
// for the OG card and the share copy. Empty string when there's nothing yet.
export function publicSongSummary(song: PublicSong): string {
  const stack = song.stack;
  if (stack && stack.steps.length > 0) {
    const secs = totalStackSeconds(stack.steps, measureLengths(song.slots), stack.bpm);
    const n = stack.steps.length;
    return `${n} section${n === 1 ? "" : "s"} · ${formatDuration(secs)}`;
  }
  const filled = EXTENDED_SLOT_LETTERS.filter(
    (l) => song.slots[l] && song.slots[l]!.lines.length > 0
  ).length;
  return filled > 0 ? `${filled} beat${filled === 1 ? "" : "s"}` : "";
}

// Title + description for the page metadata and social preview. Deliberately
// front-loads the song name and ends on the free/no-login hook.
export function publicSongShareText(song: PublicSong): { title: string; description: string } {
  const summary = publicSongSummary(song);
  return {
    title: `${song.title} — a drum song on RockBlocks`,
    description:
      `${song.title}${summary ? `: ${summary}` : ""} — a drum beat built on RockBlocks. ` +
      "Hit play, remix it right in your browser, or save your own copy. Free, no login.",
  };
}
