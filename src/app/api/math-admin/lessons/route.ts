import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { mathLessons } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { isMathAdmin } from "@/lib/auth/mathAdmin";
import { isValidChallenges, mathLessonSlug } from "@/lib/mathLessonValidation";
import { standardMathStack, starterSlotForChallenge } from "@/lib/mathSchool";

// GET /api/math-admin/lessons — every lesson (published or not), trimmed to
// what the admin list view needs. See [slug]/route.ts for the full editable
// record and the update endpoint.
export async function GET() {
  const user = await getCurrentUser();
  if (!isMathAdmin(user)) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const db = getDb();
  const rows = await db
    .select({
      slug: mathLessons.slug,
      grade: mathLessons.grade,
      lessonNumber: mathLessons.lessonNumber,
      title: mathLessons.title,
      mathSkill: mathLessons.mathSkill,
      isPublished: mathLessons.isPublished,
    })
    .from(mathLessons)
    .orderBy(asc(mathLessons.grade), asc(mathLessons.lessonNumber));

  return NextResponse.json({ lessons: rows });
}

// POST /api/math-admin/lessons — creates a brand-new lesson from scratch
// (the counterpart to [slug]/route.ts's PATCH, which can only touch an
// existing lesson's wording/answers/publish state, never its grade, lesson
// number, or slug). The slug is always derived from grade + lessonNumber +
// title via mathLessonSlug, never typed by hand, so it can't drift from the
// app's own naming convention. Starts unpublished — see isPublished below —
// so a lesson can be built out over several saves before it's ever live on
// /math.
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!isMathAdmin(user)) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const body = (await request.json().catch(() => null)) as
    | {
        grade?: unknown;
        lessonNumber?: unknown;
        title?: unknown;
        mathSkill?: unknown;
        teaches?: unknown;
        bpm?: unknown;
        challenges?: unknown;
      }
    | null;
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const { grade, lessonNumber, title, mathSkill, teaches, bpm, challenges } = body;

  if (typeof grade !== "number" || !Number.isInteger(grade) || grade < 1) {
    return NextResponse.json({ error: "grade must be a positive whole number" }, { status: 400 });
  }
  if (typeof lessonNumber !== "number" || !Number.isInteger(lessonNumber) || lessonNumber < 1) {
    return NextResponse.json({ error: "lessonNumber must be a positive whole number" }, { status: 400 });
  }
  if (typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "title must be a non-empty string" }, { status: 400 });
  }
  if (typeof mathSkill !== "string" || !mathSkill.trim()) {
    return NextResponse.json({ error: "mathSkill must be a non-empty string" }, { status: 400 });
  }
  if (typeof teaches !== "string" || !teaches.trim()) {
    return NextResponse.json({ error: "teaches must be a non-empty string" }, { status: 400 });
  }
  if (typeof bpm !== "number" || !Number.isInteger(bpm) || bpm < 40 || bpm > 200) {
    return NextResponse.json({ error: "bpm must be a whole number between 40 and 200" }, { status: 400 });
  }
  if (!isValidChallenges(challenges)) {
    return NextResponse.json(
      { error: "challenges must have a prompt, explanation, and at least one valid target for every slot A-D" },
      { status: 400 }
    );
  }

  const slug = mathLessonSlug(grade, lessonNumber, title);
  const db = getDb();

  const [numberTaken] = await db
    .select({ slug: mathLessons.slug })
    .from(mathLessons)
    .where(and(eq(mathLessons.grade, grade), eq(mathLessons.lessonNumber, lessonNumber)))
    .limit(1);
  if (numberTaken) {
    return NextResponse.json(
      { error: `Grade ${grade} already has a Lesson ${lessonNumber} ("${numberTaken.slug}") — pick a different lesson number.` },
      { status: 409 }
    );
  }

  const [slugTaken] = await db.select({ slug: mathLessons.slug }).from(mathLessons).where(eq(mathLessons.slug, slug)).limit(1);
  if (slugTaken) {
    return NextResponse.json({ error: `A lesson already exists at slug "${slug}" — change the title slightly.` }, { status: 409 });
  }

  const [created] = await db
    .insert(mathLessons)
    .values({
      slug,
      grade,
      lessonNumber,
      title: title.trim(),
      mathSkill: mathSkill.trim(),
      teaches: teaches.trim(),
      challenges,
      slotA: starterSlotForChallenge(bpm, challenges.A),
      slotB: starterSlotForChallenge(bpm, challenges.B),
      slotC: starterSlotForChallenge(bpm, challenges.C),
      slotD: starterSlotForChallenge(bpm, challenges.D),
      stack: standardMathStack(slug, bpm),
      isPublished: false,
    })
    .returning();

  return NextResponse.json({ lesson: created }, { status: 201 });
}
