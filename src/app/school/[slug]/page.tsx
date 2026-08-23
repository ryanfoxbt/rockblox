import { eq } from "drizzle-orm";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { lessons } from "@/db/schema";
import { SLOT_LETTERS } from "@/lib/board";
import { DRUM_LESSONS } from "@/lib/drumSchool";
import { buildShareMetadata } from "@/lib/shareMetadata";
import { Editor } from "@/components/Editor";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const db = getDb();
  const [lesson] = await db
    .select({ lessonNumber: lessons.lessonNumber, title: lessons.title, teaches: lessons.teaches })
    .from(lessons)
    .where(eq(lessons.slug, slug))
    .limit(1);
  if (!lesson) return {};

  return buildShareMetadata({
    title: `Lesson ${lesson.lessonNumber}: ${lesson.title} — Drum School`,
    description: `${lesson.teaches} Part of RockBlocks Drum School, a stepwise beginner drum curriculum — free at rockblocks.app.`,
    path: `/school/${slug}`,
  });
}

export default async function LessonPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ slot?: string }>;
}) {
  const { slug } = await params;
  const { slot } = await searchParams;

  const db = getDb();
  const [lesson] = await db.select().from(lessons).where(eq(lessons.slug, slug)).limit(1);
  if (!lesson) notFound();

  const initialSlot = SLOT_LETTERS.find((l) => l === slot);

  // DRUM_LESSONS is already ordered by lessonNumber (see lib/drumSchool.ts),
  // so a lesson's neighbors in that array are its curriculum neighbors —
  // no need to sort or look at lessonNumber directly.
  const lessonIndex = DRUM_LESSONS.findIndex((l) => l.slug === slug);
  const prevLesson = lessonIndex > 0 ? DRUM_LESSONS[lessonIndex - 1] : null;
  const nextLesson =
    lessonIndex >= 0 && lessonIndex < DRUM_LESSONS.length - 1 ? DRUM_LESSONS[lessonIndex + 1] : null;

  return (
    <Editor
      board={{
        slug: lesson.slug,
        displayName: lesson.title,
        slots: { A: lesson.slotA, B: lesson.slotB, C: lesson.slotC, D: lesson.slotD },
        stack: lesson.stack,
        readOnly: true,
        basePath: `/school/${lesson.slug}`,
        subtitle: `Lesson ${lesson.lessonNumber}: ${lesson.title} — ${lesson.teaches}`,
      }}
      initialSlot={initialSlot}
      lessonNav={{
        prevHref: prevLesson ? `/school/${prevLesson.slug}` : null,
        nextHref: nextLesson ? `/school/${nextLesson.slug}` : null,
      }}
    />
  );
}
