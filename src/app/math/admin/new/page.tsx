import Link from "next/link";
import { getDb } from "@/db";
import { mathLessons } from "@/db/schema";
import { requireMathAdmin } from "@/lib/auth/mathAdmin";
import { MathLessonCreator } from "@/components/MathLessonCreator";

export default async function NewMathLessonPage() {
  await requireMathAdmin();

  const db = getDb();
  const existing = await db.select({ grade: mathLessons.grade, lessonNumber: mathLessons.lessonNumber }).from(mathLessons);

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
          / <span className="text-white/60">New Lesson</span>
        </nav>

        <MathLessonCreator existing={existing} />
      </div>
    </div>
  );
}
