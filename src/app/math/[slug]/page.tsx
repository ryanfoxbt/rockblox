import { asc, eq } from "drizzle-orm";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { mathLessons } from "@/db/schema";
import { SLOT_LETTERS } from "@/lib/board";
import { buildShareMetadata } from "@/lib/shareMetadata";
import { breadcrumbJsonLd, mathLessonJsonLd } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";
import { MathLessonWorkspace } from "@/components/MathLessonWorkspace";
import { getCurrentUser } from "@/lib/auth/session";
import { isMathAdmin } from "@/lib/auth/mathAdmin";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const db = getDb();
  const [lesson] = await db
    .select({
      grade: mathLessons.grade,
      lessonNumber: mathLessons.lessonNumber,
      title: mathLessons.title,
      mathSkill: mathLessons.mathSkill,
      teaches: mathLessons.teaches,
    })
    .from(mathLessons)
    .where(eq(mathLessons.slug, slug))
    .limit(1);
  if (!lesson) return {};

  return buildShareMetadata({
    title: `Grade ${lesson.grade} Lesson ${lesson.lessonNumber}: ${lesson.title} — RockBlocks Math`,
    description: `${lesson.mathSkill}. ${lesson.teaches} Part of RockBlocks Math, a free grade-aligned math curriculum taught through drumming — free at rockblocks.app.`,
    path: `/math/${slug}`,
  });
}

export default async function MathLessonPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ slot?: string }>;
}) {
  const { slug } = await params;
  const { slot } = await searchParams;

  const db = getDb();
  const [[lesson], user] = await Promise.all([
    db.select().from(mathLessons).where(eq(mathLessons.slug, slug)).limit(1),
    getCurrentUser(),
  ]);
  if (!lesson) notFound();

  const admin = isMathAdmin(user);
  // An unpublished lesson is a draft — hidden from everyone except the
  // curriculum admin, who can still open it directly (e.g. from
  // /math/admin) to preview it before flipping it live.
  if (!lesson.isPublished && !admin) notFound();

  // Every other published lesson (all grades), for the badge system's
  // "every lesson" denominator — see useMathProgress. Prev/next nav below
  // is scoped to just this lesson's grade, in lessonNumber order.
  const publishedLessons = await db
    .select({
      slug: mathLessons.slug,
      grade: mathLessons.grade,
      lessonNumber: mathLessons.lessonNumber,
      title: mathLessons.title,
      mathSkill: mathLessons.mathSkill,
    })
    .from(mathLessons)
    .where(eq(mathLessons.isPublished, true))
    .orderBy(asc(mathLessons.grade), asc(mathLessons.lessonNumber));

  const gradeLessons = publishedLessons.filter((l) => l.grade === lesson.grade);
  const lessonIndex = gradeLessons.findIndex((l) => l.slug === slug);
  const prevLesson = lessonIndex > 0 ? gradeLessons[lessonIndex - 1] : null;
  const nextLesson = lessonIndex >= 0 && lessonIndex < gradeLessons.length - 1 ? gradeLessons[lessonIndex + 1] : null;

  const initialSlot = SLOT_LETTERS.find((l) => l === slot);

  return (
    <>
      <JsonLd
        data={mathLessonJsonLd({
          slug: lesson.slug,
          grade: lesson.grade,
          lessonNumber: lesson.lessonNumber,
          title: lesson.title,
          mathSkill: lesson.mathSkill,
          teaches: lesson.teaches,
        })}
      />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", url: "/" },
          { name: "RockBlocks Math", url: "/math" },
          { name: `Grade ${lesson.grade} Lesson ${lesson.lessonNumber}: ${lesson.title}`, url: `/math/${lesson.slug}` },
        ])}
      />
      <MathLessonWorkspace
        lesson={lesson}
        prev={prevLesson}
        next={nextLesson}
        total={gradeLessons.length}
        initialSlot={initialSlot}
        allLessonSlugs={publishedLessons.map((l) => l.slug)}
      />
    </>
  );
}
