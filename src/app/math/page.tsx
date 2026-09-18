import Link from "next/link";
import { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { mathLessons } from "@/db/schema";
import { MATH_GRADES } from "@/lib/mathSchool";
import { buildShareMetadata } from "@/lib/shareMetadata";
import {
  breadcrumbJsonLd,
  MATH_DESCRIPTION,
  MATH_FAQ,
  MATH_STEPS,
  mathCourseJsonLd,
  mathLessonListJsonLd,
  mathPageJsonLd,
} from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";
import { MathLessonsBrowser } from "@/components/MathLessonsBrowser";
import { getCurrentUser } from "@/lib/auth/session";
import { isMathAdmin } from "@/lib/auth/mathAdmin";

export const metadata: Metadata = {
  ...buildShareMetadata({
    title: "RockBlocks Math — Learn Math Through Drumming, Free",
    description: MATH_DESCRIPTION,
    path: "/math",
  }),
  keywords: [
    "math game for kids",
    "free math curriculum",
    "learn math through music",
    "grade-aligned math practice",
    "homeschool math curriculum",
    "k-12 math practice",
    "elementary math game",
    "high school math practice free",
    "math worksheet alternative",
    "teach math with drumming",
  ],
};

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
      <JsonLd data={mathPageJsonLd} />
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
          A free way to learn math through drumming, Kindergarten through Grade 12: each lesson pairs a math
          concept — from counting and place value up through trigonometry, quadratics, and an intro to
          limits — with worked-example drum beats built to actually correlate with it. Then you build the
          answer yourself, right in a real RockBlocks beat: drag the tiles, press play, change the kit, see it
          in sheet music, watch the drummer play it — the same app, just pointed at a math problem. Check your
          answer, then keep going: expand the beat, drop it in a Stack, or save a copy. No login or download
          required to try it; sign in and your solved count and gig-themed badges are saved per grade.
        </p>

        <MathLessonsBrowser lessons={lessons} allLessonSlugs={allLessonSlugs} />

        <h2 className="mt-8 text-lg font-bold">How it works</h2>
        <ol className="flex flex-col gap-2 text-sm leading-relaxed text-white/70 sm:text-base">
          {MATH_STEPS.map((step, i) => (
            <li key={step.name} className="flex gap-3">
              <span className="font-mono text-yellow-400">{i + 1}.</span>
              <span>
                <span className="font-semibold text-white/90">{step.name}.</span> {step.text}
              </span>
            </li>
          ))}
        </ol>

        <div className="mt-6 flex flex-col gap-4">
          <h2 className="text-lg font-bold">Frequently asked questions</h2>
          <dl className="flex flex-col gap-4">
            {MATH_FAQ.map(({ q, a }) => (
              <div key={q} className="flex flex-col gap-1">
                <dt className="text-sm font-semibold text-white/90 sm:text-base">{q}</dt>
                <dd className="text-sm leading-relaxed text-white/70 sm:text-base">{a}</dd>
              </div>
            ))}
          </dl>
        </div>

        <nav className="mt-6 flex flex-wrap gap-x-4 gap-y-1 border-t border-white/10 pt-6 text-sm text-white/50">
          <Link href="/" className="transition hover:text-yellow-400">
            Drum machine
          </Link>
          <Link href="/rockwords" className="transition hover:text-yellow-400">
            RockWords
          </Link>
          <Link href="/school" className="transition hover:text-yellow-400">
            Drum School
          </Link>
          <Link href="/fractal-art" className="transition hover:text-yellow-400">
            Fractal Art
          </Link>
          <Link href="/about" className="transition hover:text-yellow-400">
            About
          </Link>
        </nav>
      </div>
    </div>
  );
}
