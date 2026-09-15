import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { rockWordsWords } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { isRockWordsAdmin } from "@/lib/auth/rockWordsAdmin";
import { gradeByNumber } from "@/lib/rockWords";

// GET /api/rockwords-admin/words/[id] — the full editable record for one word.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!isRockWordsAdmin(user)) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const { id } = await params;
  const db = getDb();
  const [word] = await db
    .select()
    .from(rockWordsWords)
    .where(eq(rockWordsWords.id, Number(id)))
    .limit(1);
  if (!word) return NextResponse.json({ error: "Word not found" }, { status: 404 });

  return NextResponse.json({ word });
}

// PATCH /api/rockwords-admin/words/[id] — update any subset of a word's
// editable fields. Grade isn't editable here — changing a word's grade
// changes what length it must be, which is enough of a structural change
// that it's simpler to delete and recreate than to reconcile in place.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!isRockWordsAdmin(user)) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const { id } = await params;
  const numericId = Number(id);
  const body = (await request.json().catch(() => null)) as
    | { word?: unknown; clue?: unknown; clueShownByDefault?: unknown; isPublished?: unknown }
    | null;
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const db = getDb();
  const [existing] = await db.select().from(rockWordsWords).where(eq(rockWordsWords.id, numericId)).limit(1);
  if (!existing) return NextResponse.json({ error: "Word not found" }, { status: 404 });

  const updates: Partial<{ word: string; clue: string; clueShownByDefault: boolean; isPublished: boolean }> = {};

  if (body.word !== undefined) {
    if (typeof body.word !== "string" || !/^[a-zA-Z]+$/.test(body.word.trim())) {
      return NextResponse.json({ error: "word must contain only letters" }, { status: 400 });
    }
    const normalizedWord = body.word.trim().toLowerCase();
    const gradeConfig = gradeByNumber(existing.grade);
    if (gradeConfig && normalizedWord.length !== gradeConfig.wordLength) {
      return NextResponse.json(
        { error: `${gradeConfig.label} words must be exactly ${gradeConfig.wordLength} letters` },
        { status: 400 }
      );
    }
    updates.word = normalizedWord;
  }
  if (body.clue !== undefined) {
    if (typeof body.clue !== "string" || !body.clue.trim()) {
      return NextResponse.json({ error: "clue must be a non-empty string" }, { status: 400 });
    }
    updates.clue = body.clue.trim();
  }
  if (body.clueShownByDefault !== undefined) {
    if (typeof body.clueShownByDefault !== "boolean") {
      return NextResponse.json({ error: "clueShownByDefault must be a boolean" }, { status: 400 });
    }
    updates.clueShownByDefault = body.clueShownByDefault;
  }
  if (body.isPublished !== undefined) {
    if (typeof body.isPublished !== "boolean") {
      return NextResponse.json({ error: "isPublished must be a boolean" }, { status: 400 });
    }
    updates.isPublished = body.isPublished;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No editable fields in body" }, { status: 400 });
  }

  const [updated] = await db.update(rockWordsWords).set(updates).where(eq(rockWordsWords.id, numericId)).returning();
  return NextResponse.json({ word: updated });
}

// DELETE /api/rockwords-admin/words/[id] — words have no downstream
// references (unlike a math lesson's progress rows), so a hard delete is
// safe rather than needing an isPublished-only unpublish path.
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!isRockWordsAdmin(user)) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const { id } = await params;
  const db = getDb();
  await db.delete(rockWordsWords).where(eq(rockWordsWords.id, Number(id)));
  return NextResponse.json({ ok: true });
}
