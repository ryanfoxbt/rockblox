import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import type { BoardSlotData } from "@/lib/board";

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
