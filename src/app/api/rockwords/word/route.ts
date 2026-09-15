import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { rockWordsWords } from "@/db/schema";
import { gradeByNumber } from "@/lib/rockWords";

// GET /api/rockwords/word?grade=0&exclude=1,2,3 — one random published word
// for that grade, for "Play again" without a full page reload. `exclude`
// (word ids, comma-separated) lets the client skip whatever it's played
// most recently — tracked client-side only, no server-side session/state.
export async function GET(request: NextRequest) {
  const gradeParam = request.nextUrl.searchParams.get("grade");
  const grade = Number(gradeParam);
  if (!gradeParam || !Number.isInteger(grade) || !gradeByNumber(grade)) {
    return NextResponse.json({ error: "Unknown grade" }, { status: 400 });
  }

  const excludeParam = request.nextUrl.searchParams.get("exclude") ?? "";
  const excludeIds = excludeParam
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n));

  const db = getDb();
  const rows = await db
    .select({
      id: rockWordsWords.id,
      word: rockWordsWords.word,
      clue: rockWordsWords.clue,
      clueShownByDefault: rockWordsWords.clueShownByDefault,
    })
    .from(rockWordsWords)
    .where(and(eq(rockWordsWords.grade, grade), eq(rockWordsWords.isPublished, true)));

  // Prefer a word outside the caller's recent list, but fall back to the
  // full set if excluding them would leave nothing to play (a short list
  // shouldn't ever dead-end the game).
  const pool = rows.filter((r) => !excludeIds.includes(r.id));
  const candidates = pool.length > 0 ? pool : rows;
  if (candidates.length === 0) {
    return NextResponse.json({ error: "No words available for this grade yet" }, { status: 404 });
  }

  const picked = candidates[Math.floor(Math.random() * candidates.length)];
  return NextResponse.json({ round: picked });
}
