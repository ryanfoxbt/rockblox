import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { rockWordsWords } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { isRockWordsAdmin } from "@/lib/auth/rockWordsAdmin";
import { gradeByNumber } from "@/lib/rockWords";

// GET /api/rockwords-admin/words — every word (published or not), for the
// admin list view. See [id]/route.ts for the update endpoint.
export async function GET() {
  const user = await getCurrentUser();
  if (!isRockWordsAdmin(user)) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const db = getDb();
  const rows = await db
    .select()
    .from(rockWordsWords)
    .orderBy(asc(rockWordsWords.grade), asc(rockWordsWords.word));

  return NextResponse.json({ words: rows });
}

// POST /api/rockwords-admin/words — creates a brand-new word. Starts
// unpublished (regardless of what's in the body) so it can be reviewed
// before it enters the live rotation — same staging convention
// /api/math-admin/lessons uses.
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!isRockWordsAdmin(user)) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const body = (await request.json().catch(() => null)) as
    | { grade?: unknown; word?: unknown; clue?: unknown; clueShownByDefault?: unknown }
    | null;
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const { grade, word, clue, clueShownByDefault } = body;

  if (typeof grade !== "number" || !Number.isInteger(grade)) {
    return NextResponse.json({ error: "grade must be a whole number" }, { status: 400 });
  }
  const gradeConfig = gradeByNumber(grade);
  if (!gradeConfig) {
    return NextResponse.json({ error: "Unknown grade" }, { status: 400 });
  }
  if (typeof word !== "string" || !/^[a-zA-Z]+$/.test(word.trim())) {
    return NextResponse.json({ error: "word must contain only letters" }, { status: 400 });
  }
  const normalizedWord = word.trim().toLowerCase();
  if (normalizedWord.length !== gradeConfig.wordLength) {
    return NextResponse.json(
      { error: `${gradeConfig.label} words must be exactly ${gradeConfig.wordLength} letters` },
      { status: 400 }
    );
  }
  if (typeof clue !== "string" || !clue.trim()) {
    return NextResponse.json({ error: "clue must be a non-empty string" }, { status: 400 });
  }
  if (clueShownByDefault !== undefined && typeof clueShownByDefault !== "boolean") {
    return NextResponse.json({ error: "clueShownByDefault must be a boolean" }, { status: 400 });
  }

  const db = getDb();
  const [taken] = await db
    .select({ id: rockWordsWords.id })
    .from(rockWordsWords)
    .where(and(eq(rockWordsWords.grade, grade), eq(rockWordsWords.word, normalizedWord)))
    .limit(1);
  if (taken) {
    return NextResponse.json({ error: `"${normalizedWord}" is already in ${gradeConfig.label}'s word list.` }, { status: 409 });
  }

  const [created] = await db
    .insert(rockWordsWords)
    .values({
      grade,
      word: normalizedWord,
      clue: clue.trim(),
      clueShownByDefault: clueShownByDefault ?? false,
      isPublished: false,
    })
    .returning();

  return NextResponse.json({ word: created }, { status: 201 });
}
