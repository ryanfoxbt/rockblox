import { NextResponse } from "next/server";
import { asc } from "drizzle-orm";
import { getDb } from "@/db";
import { mathLessons } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { isMathAdmin } from "@/lib/auth/mathAdmin";

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
