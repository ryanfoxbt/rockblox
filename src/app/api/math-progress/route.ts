import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { mathProgress } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { MATH_LESSONS } from "@/lib/mathSchool";
import { SLOT_LETTERS } from "@/lib/board";

// GET /api/math-progress — every question the signed-in user has solved,
// for merging into their local (localStorage) progress on sign-in — see
// src/lib/useMathProgress.ts.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to save progress" }, { status: 401 });

  const db = getDb();
  const rows = await db
    .select({ lessonSlug: mathProgress.lessonSlug, slot: mathProgress.slot })
    .from(mathProgress)
    .where(eq(mathProgress.ownerId, user.id));

  return NextResponse.json({ solved: rows });
}

// POST /api/math-progress — record one solved question. Idempotent (the
// same lesson+slot for the same user only ever counts once, enforced by the
// table's unique index) so the client can call this freely on every correct
// check without worrying about double-counting.
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to save progress" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { lessonSlug?: unknown; slot?: unknown } | null;
  const lessonSlug = typeof body?.lessonSlug === "string" ? body.lessonSlug : null;
  const slot = typeof body?.slot === "string" ? body.slot : null;

  if (!lessonSlug || !slot || !(SLOT_LETTERS as string[]).includes(slot) || !MATH_LESSONS.some((l) => l.slug === lessonSlug)) {
    return NextResponse.json({ error: "Invalid lessonSlug or slot" }, { status: 400 });
  }

  const db = getDb();
  await db
    .insert(mathProgress)
    .values({ ownerId: user.id, lessonSlug, slot })
    .onConflictDoNothing();

  return NextResponse.json({ ok: true }, { status: 201 });
}
