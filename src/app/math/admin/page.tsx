import Link from "next/link";
import { asc } from "drizzle-orm";
import { getDb } from "@/db";
import { mathLessons } from "@/db/schema";
import { requireMathAdmin } from "@/lib/auth/mathAdmin";
import { MathAdminList } from "@/components/MathAdminList";

export default async function MathAdminPage() {
  await requireMathAdmin();

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

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-10 text-white sm:px-6">
      <div className="mx-auto w-full max-w-xl">
        <nav aria-label="Breadcrumb" className="text-xs text-white/40">
          <Link href="/" className="transition hover:text-yellow-400">
            Home
          </Link>{" "}
          /{" "}
          <Link href="/math" className="transition hover:text-yellow-400">
            RockBlocks Math
          </Link>{" "}
          / <span className="text-white/60">Admin</span>
        </nav>
        <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
          Lesson <span className="text-yellow-400">Editor</span>
        </h1>
        <p className="mt-2 text-sm text-white/50">
          Edit question wording and answers, or publish/unpublish a lesson. Unpublished lessons are hidden from{" "}
          <Link href="/math" className="text-yellow-400 transition hover:underline">
            /math
          </Link>{" "}
          and its lesson pages for everyone else.
        </p>

        <MathAdminList initialLessons={rows} />
      </div>
    </div>
  );
}
