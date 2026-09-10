import { notFound } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { mathLessons } from "@/db/schema";
import { requireMathAdmin } from "@/lib/auth/mathAdmin";
import { MathLessonEditor } from "@/components/MathLessonEditor";

export default async function MathAdminLessonPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireMathAdmin();
  const { slug } = await params;

  const db = getDb();
  const [lesson] = await db
    .select({
      slug: mathLessons.slug,
      grade: mathLessons.grade,
      lessonNumber: mathLessons.lessonNumber,
      title: mathLessons.title,
      mathSkill: mathLessons.mathSkill,
      teaches: mathLessons.teaches,
      challenges: mathLessons.challenges,
      isPublished: mathLessons.isPublished,
    })
    .from(mathLessons)
    .where(eq(mathLessons.slug, slug))
    .limit(1);
  if (!lesson) notFound();

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-10 text-white sm:px-6">
      <div className="mx-auto w-full max-w-2xl">
        <nav aria-label="Breadcrumb" className="text-xs text-white/40">
          <Link href="/" className="transition hover:text-yellow-400">
            Home
          </Link>{" "}
          /{" "}
          <Link href="/math" className="transition hover:text-yellow-400">
            RockBlocks Math
          </Link>{" "}
          /{" "}
          <Link href="/math/admin" className="transition hover:text-yellow-400">
            Admin
          </Link>{" "}
          / <span className="text-white/60">{lesson.title}</span>
        </nav>

        <MathLessonEditor lesson={lesson} />
      </div>
    </div>
  );
}
