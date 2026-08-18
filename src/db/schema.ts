import { boolean, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
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
  // Text to Beat is normally gated to a page with nothing saved yet (see
  // Editor.tsx's isBlankBoard) — this opts a specific page out of that gate
  // so its owner can keep re-generating from it while testing/iterating,
  // without it being a general bulk-overwrite tool for anyone's live page.
  textToBeatAlwaysOn: boolean("text_to_beat_always_on").notNull().default(false),
  // Whether the Text to Beat preview shows the "rules used" breakdown
  // (time signature formula, density curve, per-word rhythm/accent choices)
  // alongside the generated grooves — see lib/textToBeat.ts's trace output.
  textToBeatShowRules: boolean("text_to_beat_show_rules").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

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
