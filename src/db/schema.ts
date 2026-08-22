import { boolean, doublePrecision, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import type { BoardSlotData } from "@/lib/board";
import type { CustomSamples } from "@/lib/customSamples";
import type { StackArrangement } from "@/lib/stack";
import type {
  FullSongArrangementStep,
  FullSongSlot,
  OtherRhythmOnset,
  SongOnset,
  TranscribeDiagnostics,
} from "@/lib/transcribeDrums";

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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

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

// "transcribing" is a same-step status ping (see importFullSong in
// inngest/functions.ts) — not a distinct pipeline stage of its own, just a
// way for /test's status bar to distinguish "still separating drums on
// Replicate" (usually the long part) from "computing the pattern"
// (seconds) instead of one opaque "processing" the whole time.
export type SongImportStatus = "uploaded" | "processing" | "transcribing" | "done" | "error";

// Tracks one "turn a song into a RockBlocks beat" job: an uploaded MP3 run
// through the Inngest pipeline (Replicate/Demucs drum-stem separation, then
// onset-detection transcription) down to up to four patterns the owner can
// drop into their board's slots — as many real recurring main grooves as the
// song has (mainBeatCount, 1-3, filling patternA/B/C... in order) plus fills
// in whatever slots are left over. Row-per-job rather than storing the
// result directly on
// `boards` since a job is transient working state, not a saved beat, until
// the owner explicitly imports it.
export const songImports = pgTable("song_imports", {
  id: text("id").primaryKey(),
  // Null for a scratch import run from /test (see app/test) — nothing to
  // save into yet, just previewing the transcription; the owner picks a page
  // to save to afterward if they keep the result.
  boardSlug: text("board_slug"),
  status: text("status").$type<SongImportStatus>().notNull().default("uploaded"),
  originalFilename: text("original_filename").notNull(),
  blobUrl: text("blob_url").notNull(),
  errorMessage: text("error_message"),
  bpm: integer("bpm"),
  measureLength: integer("measure_length"),
  // How many of patternA/B/C/D (from A) are real recurring main grooves —
  // the rest, through D, are fills. See transcribeDrums.ts.
  mainBeatCount: integer("main_beat_count"),
  patternA: jsonb("pattern_a").$type<StoredLine[]>(),
  patternB: jsonb("pattern_b").$type<StoredLine[]>(),
  patternC: jsonb("pattern_c").$type<StoredLine[]>(),
  patternD: jsonb("pattern_d").$type<StoredLine[]>(),
  // Per-pattern source timestamp (seconds into the song) and instrument list
  // — while the transcription pipeline is still being tuned, this is what
  // lets a human jump to the exact part of the song each pattern came from
  // and judge accuracy by ear, without digging through logs.
  diagnostics: jsonb("diagnostics").$type<TranscribeDiagnostics>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// The /test-only counterpart to songImports above (see transcribeFullSong in
// transcribeDrums.ts): not tied to a board at all — there's no owner, no
// slot cap, just a whole song's worth of detected grooves/fills and the
// bar-by-bar arrangement reconstructing how they actually play through the
// song, for previewing/playing back on /test. Drums only, no vocals/bass/
// "other" layering.
// Superseded by songAnalyses below — automatic whole-song clustering didn't
// match what a drummer actually wants (the main beat per section, picked by
// ear, not an algorithm's guess at "distinct"). Left in place, unused by any
// UI, rather than dropped outright.
export const fullSongImports = pgTable("full_song_imports", {
  id: text("id").primaryKey(),
  status: text("status").$type<SongImportStatus>().notNull().default("uploaded"),
  originalFilename: text("original_filename").notNull(),
  blobUrl: text("blob_url").notNull(),
  errorMessage: text("error_message"),
  bpm: integer("bpm"),
  measureLength: integer("measure_length"),
  durationSeconds: integer("duration_seconds"),
  slots: jsonb("slots").$type<FullSongSlot[]>(),
  arrangement: jsonb("arrangement").$type<FullSongArrangementStep[]>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Backs /test's manual-crop workflow: separates every stem once (the slow,
// Replicate-backed part) and classifies every drum hit in the whole song
// plus every vocals/bass/"other" onset (unclassified — just tagged by
// source), then hands the browser a beat grid (bpm/gridOrigin/beatSeconds)
// plus both onset lists — cropping and quantizing a clip into a Slot's
// pattern happens entirely client-side from there (see lib/quantizeClip.ts),
// so picking 4 clips feels instant instead of waiting on a job per slot.
export const songAnalyses = pgTable("song_analyses", {
  id: text("id").primaryKey(),
  status: text("status").$type<SongImportStatus>().notNull().default("uploaded"),
  originalFilename: text("original_filename").notNull(),
  blobUrl: text("blob_url").notNull(),
  errorMessage: text("error_message"),
  bpm: doublePrecision("bpm"),
  beatSeconds: doublePrecision("beat_seconds"),
  gridOrigin: doublePrecision("grid_origin"),
  durationSeconds: doublePrecision("duration_seconds"),
  onsets: jsonb("onsets").$type<SongOnset[]>(),
  otherOnsets: jsonb("other_onsets").$type<OtherRhythmOnset[]>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
