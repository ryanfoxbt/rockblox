import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import type { BoardSlotData, SlotLetter, SlotMap } from "@/lib/board";
import type { CustomSamples } from "@/lib/customSamples";
import type { MathChallenge } from "@/lib/mathSchool";
import type { StackArrangement } from "@/lib/stack";

export interface StoredLine {
  instrument: string;
  blocks: (string | null)[];
  volume?: number;
}

export const patterns = pgTable("patterns", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  slug: text("slug").notNull().unique(),
  bpm: integer("bpm").notNull(),
  lines: jsonb("lines").$type<StoredLine[]>().notNull(),
  kit: text("kit"),
  customSamples: jsonb("custom_samples").$type<CustomSamples>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// A personalized, no-login page (e.g. rockblocks.app/RyanFox) that holds up
// to 4 saved drum beats — slots A-D, like the pattern banks on an old drum
// machine. `slug` is the lowercased, canonical lookup key; `displayName`
// preserves the casing the owner originally typed for the URL.
export const boards = pgTable("boards", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  slug: text("slug").notNull().unique(),
  displayName: text("display_name").notNull(),
  slotA: jsonb("slot_a").$type<BoardSlotData>(),
  slotB: jsonb("slot_b").$type<BoardSlotData>(),
  slotC: jsonb("slot_c").$type<BoardSlotData>(),
  slotD: jsonb("slot_d").$type<BoardSlotData>(),
  // Stack Builder: an arrangement sequencing repeats of slots A-D, played at
  // one global tempo, into a longer song (see lib/stack.ts).
  stack: jsonb("stack").$type<StackArrangement>(),
  // Deprecated — no longer read (Text to Beat is unconditional everywhere
  // now), kept here purely so `db:push` doesn't propose dropping this
  // column, which would be a real, irreversible data-loss operation for no
  // benefit. Safe to actually drop in a future cleanup pass.
  textToBeatAlwaysOn: boolean("text_to_beat_always_on").notNull().default(false),
  // Whether the Text to Beat preview shows the "rules used" breakdown
  // (time signature formula, density curve, per-word rhythm/accent choices)
  // alongside the generated grooves — see lib/textToBeat.ts's trace output.
  textToBeatShowRules: boolean("text_to_beat_show_rules").notNull().default(true),
  // Neon Auth user id of the account that "owns" this public URL, once the
  // future "buy a claimed URL" feature exists. Null for every board today
  // (claiming is still anonymous and unlocked) — a public URL stays publicly
  // readable regardless; ownership only ever gates who may *edit* it.
  ownerId: text("owner_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// A signed-in user's private, saved drum song — the "Super Powers" payoff.
// Unlike `boards` (a public, anonymously-claimed vanity URL capped at 4
// slots), a user_song is visible only to its owner, there can be any number
// of them per account, and it carries the doubled 8-slot set (A-H, see
// SlotMap). `slots` is one JSON object keyed by slot letter rather than eight
// columns so the width can vary and the whole doc autosaves in one write.
export const userSongs = pgTable(
  "user_songs",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    title: text("title").notNull().default("Untitled"),
    slots: jsonb("slots").$type<SlotMap>().notNull().default({}),
    // Stack Builder arrangement over this song's slots, if the owner built one.
    stack: jsonb("stack").$type<StackArrangement>(),
    // Public sharing. When the owner turns this on, the song becomes readable,
    // playable, and "save a copy"-able with no login at /s/<publicSlug> —
    // exactly like a curated /songs page: a visitor's edits never write back.
    // `publicSlug` is assigned once, the first time sharing is enabled, and
    // kept stable across later rename / unshare / re-share so a link already
    // posted somewhere keeps resolving.
    isPublic: boolean("is_public").notNull().default(false),
    publicSlug: text("public_slug").unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("user_songs_owner_idx").on(table.ownerId)]
);

// A curated, staff-picked drum mapping of a famous song — e.g. the Ramones'
// "Blitzkrieg Bop" — shaped just like `boards` (slots A-D plus a Stack
// Builder arrangement) so the same Editor/StackBuilder UI can render it, but
// served read-only from /songs/[slug] instead of a claimable board: no
// autosave, no claiming, no per-board features like TextyBeat or the Wall.
// Seeded by hand (see scripts/), not written through any API route, so
// every visitor always sees the same original mapping regardless of what
// they mess around with in their own browser session.
export const songs = pgTable("songs", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  artist: text("artist").notNull(),
  slotA: jsonb("slot_a").$type<BoardSlotData>(),
  slotB: jsonb("slot_b").$type<BoardSlotData>(),
  slotC: jsonb("slot_c").$type<BoardSlotData>(),
  slotD: jsonb("slot_d").$type<BoardSlotData>(),
  stack: jsonb("stack").$type<StackArrangement>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// A curated, staff-written beginner drum lesson — shaped just like `songs`
// (slots A-D plus a Stack Builder arrangement, same read-only Editor/
// StackBuilder UI) but served from /school/[slug] instead of /songs/[slug],
// and ordered/numbered as a stepwise curriculum rather than a flat list. See
// scripts/seedLessons.mts, which writes each lesson's pattern directly
// (hand-authored in code, not captured from a hand-built board) since the
// content is original teaching material rather than a transcription of an
// existing recording.
export const lessons = pgTable("lessons", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  slug: text("slug").notNull().unique(),
  lessonNumber: integer("lesson_number").notNull(),
  title: text("title").notNull(),
  teaches: text("teaches").notNull(),
  slotA: jsonb("slot_a").$type<BoardSlotData>(),
  slotB: jsonb("slot_b").$type<BoardSlotData>(),
  slotC: jsonb("slot_c").$type<BoardSlotData>(),
  slotD: jsonb("slot_d").$type<BoardSlotData>(),
  stack: jsonb("stack").$type<StackArrangement>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// A curated, staff-written RockBlocks Math lesson — shaped just like `lessons`
// (slots A-D plus a Stack Builder arrangement, same read-only Editor/
// StackBuilder UI) but served from /math/[slug] instead of /school/[slug],
// and scoped to a US grade level rather than one flat curriculum. Each
// lesson pairs a grade-aligned math concept (`mathSkill`) with a drum
// pattern built to actually correlate with it (e.g. skip-counting by 2s is
// a hi-hat hit on every other beat block) — see scripts/seedMathLessons.mts
// and src/lib/mathSchool.ts.
export const mathLessons = pgTable("math_lessons", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  slug: text("slug").notNull().unique(),
  grade: integer("grade").notNull(),
  lessonNumber: integer("lesson_number").notNull(),
  title: text("title").notNull(),
  mathSkill: text("math_skill").notNull(),
  teaches: text("teaches").notNull(),
  // One real, checkable question per slot (A-D) — see MathChallenge in
  // src/lib/mathSchool.ts for the shape and
  // src/components/MathLessonWorkspace.tsx for the interactive UI that
  // grades it client-side: the student builds their answer directly in that
  // slot's own beat blocks, in the real Editor, using every normal
  // RockBlocks feature (kit, tempo, sheet music, drummer view, save a copy)
  // — the question and "check my answer" live in a small popover, not a
  // rebuilt editor.
  challenges: jsonb("challenges").$type<Record<SlotLetter, MathChallenge>>().notNull(),
  slotA: jsonb("slot_a").$type<BoardSlotData>(),
  slotB: jsonb("slot_b").$type<BoardSlotData>(),
  slotC: jsonb("slot_c").$type<BoardSlotData>(),
  slotD: jsonb("slot_d").$type<BoardSlotData>(),
  stack: jsonb("stack").$type<StackArrangement>(),
  // Hidden from /math's public list and lesson pages while false — lets the
  // admin panel (src/app/math/admin) stage a lesson before it's ready
  // without deleting it. Defaults true so every existing seeded lesson stays
  // visible.
  isPublished: boolean("is_published").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// One solved question in RockBlocks Math (a lesson slug + slot letter),
// permanently recorded for a signed-in user — the "saved for good" half of
// progress tracking. An anonymous visitor's progress lives only in
// localStorage (see src/lib/useMathProgress.ts); signing in merges that
// local progress into this table and it's durable from then on, the same
// way an anonymous board becomes permanent once claimed. Badges themselves
// aren't stored — they're derived client-side from which rows exist, so
// adding or renaming a badge never needs a migration.
export const mathProgress = pgTable(
  "math_progress",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    ownerId: text("owner_id").notNull(),
    lessonSlug: text("lesson_slug").notNull(),
    slot: text("slot").notNull(),
    solvedAt: timestamp("solved_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("math_progress_owner_slug_slot_idx").on(table.ownerId, table.lessonSlug, table.slot),
    index("math_progress_owner_idx").on(table.ownerId),
  ]
);

// A live "who's here right now" heartbeat for one board — upserted roughly
// every 20s by each open tab (see PresenceIndicator.tsx), keyed by a random
// per-tab id (sessionStorage, not tied to any account since there isn't
// one). A row older than the API route's own activity window just reads as
// "not here anymore" rather than being deleted — the client never needs a
// distinct "they left" signal, only "who's active right now." `location` is
// a coarse city/region string from Vercel's own geo headers, never the IP
// itself and never anything more precise than that.
export const boardPresence = pgTable(
  "board_presence",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    boardSlug: text("board_slug").notNull(),
    visitorId: text("visitor_id").notNull(),
    location: text("location"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("board_presence_board_visitor_idx").on(table.boardSlug, table.visitorId),
    index("board_presence_board_slug_idx").on(table.boardSlug),
    // Cross-board "who's active anywhere right now" scan for /api/activity
    // (Spy + Explore).
    index("board_presence_last_seen_idx").on(table.lastSeenAt),
  ]
);

// One scrawled line on a board's graffiti wall — like writing on a bathroom
// stall or a tree trunk, except the "wall" is shared by everyone who visits
// that URL. `boardSlug` isn't a foreign key (this app has no cascading-delete
// story for boards at all), just a plain lookup key. `ipHash` exists only
// for the per-board-per-IP rate limit in the wall API route — never the raw
// IP, and never surfaced to any client.
export const wallMessages = pgTable(
  "wall_messages",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    boardSlug: text("board_slug").notNull(),
    message: text("message").notNull(),
    ipHash: text("ip_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("wall_messages_board_slug_idx").on(table.boardSlug)]
);

// Freeform gripes from the "Complain" button — not tied to a user (there's
// no login), just whatever page they typed it from, for context.
export const complaints = pgTable("complaints", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  message: text("message").notNull(),
  url: text("url").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
