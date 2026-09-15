import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { rockWordsSettings } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { isRockWordsAdmin } from "@/lib/auth/rockWordsAdmin";
import { isValidMaxRows } from "@/lib/rockWords";

// PATCH /api/rockwords-admin/settings — updates the game-wide max-guesses
// setting (4, 6, or 8). Upserts the singleton row (id fixed at 1) rather
// than requiring it to already exist.
export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();
  if (!isRockWordsAdmin(user)) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const body = (await request.json().catch(() => null)) as { maxRows?: unknown } | null;
  if (!body || typeof body.maxRows !== "number" || !isValidMaxRows(body.maxRows)) {
    return NextResponse.json({ error: "maxRows must be 4, 6, or 8" }, { status: 400 });
  }

  const db = getDb();
  await db
    .insert(rockWordsSettings)
    .values({ id: 1, maxRows: body.maxRows })
    .onConflictDoUpdate({ target: rockWordsSettings.id, set: { maxRows: body.maxRows } });

  return NextResponse.json({ maxRows: body.maxRows });
}
