import Link from "next/link";
import { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { mathLessons } from "@/db/schema";
import { MATH_GRADES } from "@/lib/mathSchool";
import { buildShareMetadata } from "@/lib/shareMetadata";
import { breadcrumbJsonLd, mathCourseJsonLd, mathLessonListJsonLd } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";
import { MathProgressOverview } from "@/components/MathProgressOverview";
import { getCurrentUser } from "@/lib/auth/session";
import { isMathAdmin } from "@/lib/auth/mathAdmin";

export const metadata: Metadata = buildShareMetadata({
  title: "RockBlocks Math — Learn Math Through Drumming, Free",
  description:
    "RockBlocks Math is a free, grade-aligned math curriculum taught through drumming. Grade 1: 24 lessons that each pair a math concept — addition, subtraction, place value, and more — with a worked-example drum beat, then have you build and check your own answer in the real RockBlocks editor. No login or download.",
  path: "/math",
});

export default async function MathIndexPage() {
  const db = getDb();
  const [lessons, user] = await Promise.all([
    db
      .select({
        slug: mathLessons.slug,
        grade: mathLessons.grade,
        lessonNumber: mathLessons.lessonNumber,
        title: mathLessons.title,
        mathSkill: mathLessons.mathSkill,
      })
      .from(mathLessons)
      .where(eq(mathLessons.isPublished, true))
      .orderBy(asc(mathLessons.grade), asc(mathLessons.lessonNumber)),
    getCurrentUser(),
  ]);
  const allLessonSlugs = lessons.map((l) => l.slug);

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-10 text-white sm:px-6">
      {MATH_GRADES.map((g) => (
        <JsonLd
          key={`course-${g.grade}`}
          data={mathCourseJsonLd(g.grade, lessons.filter((l) => l.grade === g.grade).length)}
        />
      ))}
      <JsonLd data={mathLessonListJsonLd(lessons)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", url: "/" },
          { name: "RockBlocks Math", url: "/math" },
        ])}
      />
      <div className="mx-auto w-full max-w-xl">
        <nav aria-label="Breadcrumb" className="text-xs text-white/40">
          <Link href="/" className="transition hover:text-yellow-400">
            Home
          </Link>{" "}
          / <span className="text-white/60">RockBlocks Math</span>
        </nav>
        <div className="mt-2 flex items-start justify-between gap-4">
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
            Rock<span className="text-yellow-400">Blocks</span> Math
          </h1>
          {isMathAdmin(user) && (
            <Link
              href="/math/admin"
              className="shrink-0 rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-white/50 transition hover:border-yellow-400 hover:text-yellow-400"
            >
              Edit lessons
            </Link>
          )}
        </div>
        <p className="mt-2 text-sm text-white/50">
          A free way to learn math through drumming: each lesson pairs a math concept — addition, subtraction,
          place value, skip counting, and more — with worked-example drum beats built to actually correlate with
          it. Then you build the answer yourself, right in a real RockBlocks beat: drag the tiles, press play,
          change the kit, see it in sheet music, watch the drummer play it — the same app, just pointed at a math
          problem. Check your answer, then keep going: expand the beat, drop it in a Stack, or save a copy. No
          login or download required to try it.
        </p>

        {MATH_GRADES.map((g) => (
          <MathProgressOverview
            key={g.grade}
            grade={g.grade}
            lessons={lessons.filter((l) => l.grade === g.grade)}
            allLessonSlugs={allLessonSlugs}
          />
        ))}
      </div>
    </div>
  );
}
