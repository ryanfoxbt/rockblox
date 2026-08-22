import { eq } from "drizzle-orm";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { lessons } from "@/db/schema";
import { SLOT_LETTERS } from "@/lib/board";
import { buildShareMetadata } from "@/lib/shareMetadata";
import { StackBuilder } from "@/components/StackBuilder";

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
    description: `${lesson.teaches} Arranged into a full song on RockBlocks Drum School — free at rockblocks.app.`,
    path: `/school/${slug}/stack`,
  });
}

export default async function LessonStackPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { slug } = await params;
  const { from } = await searchParams;

  const db = getDb();
  const [lesson] = await db.select().from(lessons).where(eq(lessons.slug, slug)).limit(1);
  if (!lesson) notFound();

  const returnSlot = SLOT_LETTERS.find((l) => l === from);

  return (
    <StackBuilder
      board={{
        slug: lesson.slug,
        displayName: lesson.title,
        slots: { A: lesson.slotA, B: lesson.slotB, C: lesson.slotC, D: lesson.slotD },
        stack: lesson.stack ?? null,
        readOnly: true,
        basePath: `/school/${lesson.slug}`,
        subtitle: `Lesson ${lesson.lessonNumber}: ${lesson.title} — ${lesson.teaches}`,
      }}
      returnSlot={returnSlot}
    />
  );
}
