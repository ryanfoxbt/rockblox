import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { mathLessons } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { isMathAdmin } from "@/lib/auth/mathAdmin";
import type { SlotLetter } from "@/lib/board";
import type { MathChallenge } from "@/lib/mathSchool";
import { isValidChallenges } from "@/lib/mathLessonValidation";

// GET /api/math-admin/lessons/[slug] — the full editable record for one
// lesson (published or not).
export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const user = await getCurrentUser();
  if (!isMathAdmin(user)) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const { slug } = await params;
  const db = getDb();
  const [lesson] = await db.select().from(mathLessons).where(eq(mathLessons.slug, slug)).limit(1);
  if (!lesson) return NextResponse.json({ error: "Lesson not found" }, { status: 404 });

  return NextResponse.json({ lesson });
}

// PATCH /api/math-admin/lessons/[slug] — update any subset of a lesson's
// editable fields: title, mathSkill, teaches, the four slots' questions and
// answers (challenges), and whether it's published. Structural fields
// (slug, grade, lessonNumber, the beat data itself) aren't editable here —
// this is for fixing wording and impossible answer counts, not restructuring
// the curriculum.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const user = await getCurrentUser();
  if (!isMathAdmin(user)) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const { slug } = await params;
  const body = (await request.json().catch(() => null)) as
    | {
        title?: unknown;
        mathSkill?: unknown;
        teaches?: unknown;
        challenges?: unknown;
        isPublished?: unknown;
      }
    | null;
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const updates: Partial<{
    title: string;
    mathSkill: string;
    teaches: string;
    challenges: Record<SlotLetter, MathChallenge>;
    isPublished: boolean;
  }> = {};

  if (body.title !== undefined) {
    if (typeof body.title !== "string" || !body.title.trim()) {
      return NextResponse.json({ error: "title must be a non-empty string" }, { status: 400 });
    }
    updates.title = body.title.trim();
  }
  if (body.mathSkill !== undefined) {
    if (typeof body.mathSkill !== "string" || !body.mathSkill.trim()) {
      return NextResponse.json({ error: "mathSkill must be a non-empty string" }, { status: 400 });
    }
    updates.mathSkill = body.mathSkill.trim();
  }
  if (body.teaches !== undefined) {
    if (typeof body.teaches !== "string" || !body.teaches.trim()) {
      return NextResponse.json({ error: "teaches must be a non-empty string" }, { status: 400 });
    }
    updates.teaches = body.teaches.trim();
  }
  if (body.challenges !== undefined) {
    if (!isValidChallenges(body.challenges)) {
      return NextResponse.json(
        { error: "challenges must have a prompt, explanation, and at least one valid target for every slot A-D" },
        { status: 400 }
      );
    }
    updates.challenges = body.challenges;
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

  const db = getDb();
  const [updated] = await db.update(mathLessons).set(updates).where(eq(mathLessons.slug, slug)).returning();
  if (!updated) return NextResponse.json({ error: "Lesson not found" }, { status: 404 });

  return NextResponse.json({ lesson: updated });
}
