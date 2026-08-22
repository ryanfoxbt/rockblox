import { eq } from "drizzle-orm";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { lessons } from "@/db/schema";
import { SLOT_LETTERS } from "@/lib/board";
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
    />
  );
}
