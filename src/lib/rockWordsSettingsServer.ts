import "server-only";

import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { rockWordsSettings } from "@/db/schema";
import { DEFAULT_MAX_ROWS, isValidMaxRows, MaxRows } from "./rockWords";

// Reads the game-wide max-guesses setting (see rock_words_settings in
// schema.ts) — falls back to the default rather than writing a row on read,
// so a fresh database needs no seed step before the game works. The admin
// PATCH endpoint (see /api/rockwords-admin/settings) is what actually
// creates/updates the row.
export async function getRockWordsMaxRows(): Promise<MaxRows> {
  const db = getDb();
  const [row] = await db.select().from(rockWordsSettings).where(eq(rockWordsSettings.id, 1)).limit(1);
  if (row && isValidMaxRows(row.maxRows)) return row.maxRows;
  return DEFAULT_MAX_ROWS;
}
