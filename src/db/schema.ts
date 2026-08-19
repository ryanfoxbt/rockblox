import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import type { BoardSlotData } from "@/lib/board";
import type { CustomSamples } from "@/lib/customSamples";
import type { StackArrangement } from "@/lib/stack";
import type { TranscribeDiagnostics } from "@/lib/transcribeDrums";

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

export type SongImportStatus = "uploaded" | "processing" | "done" | "error";

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
  boardSlug: text("board_slug").notNull(),
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
