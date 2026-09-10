"use client";

import Link from "next/link";
import { useMathProgress } from "@/lib/useMathProgress";
import { MATH_BADGES } from "@/lib/mathBadges";

interface ProgressLesson {
  slug: string;
  lessonNumber: number;
  title: string;
  mathSkill: string;
}

function statusFor(count: number): { label: string; className: string } {
  if (count === 0) return { label: "Not started", className: "text-white/30" };
  if (count === 4) return { label: "✓ Completed", className: "text-green-400" };
  return { label: `In progress · ${count}/4`, className: "text-yellow-400" };
}

// The live progress layer on /math — a client island (see MathLessonWorkspace
// for the matching per-lesson tracking) so the otherwise-static index page
// can show a returning visitor exactly where they left off: a total-solved
// summary, which badges are earned, and a per-lesson status badge (not
// started / in progress / completed) next to every row. `lessons` is this
// grade's published lessons (for the list); `allLessonSlugs` is every
// published lesson across every grade (what the badge totals are based on).
export function MathProgressOverview({
  grade,
  lessons,
  allLessonSlugs,
}: {
  grade: number;
  lessons: ProgressLesson[];
  allLessonSlugs: string[];
}) {
  const progress = useMathProgress(allLessonSlugs);
  const totalPossible = lessons.length * 4;

  return (
    <section className="mt-6">
      <h2 className="text-lg font-bold tracking-tight text-white/90">{`Grade ${grade}`}</h2>

      <div className="mt-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-white/80">
            <span className="font-bold text-yellow-400">{progress.totalSolved}</span> / {totalPossible} questions
            solved · <span className="font-bold text-yellow-400">{progress.lessonsCompleted}</span> lesson
            {progress.lessonsCompleted === 1 ? "" : "s"} completed
          </p>
          {!progress.signedIn && progress.totalSolved > 0 && (
            <span className="text-xs text-white/40">Sign in to save this for good</span>
          )}
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          {MATH_BADGES.map((badge) => {
            const earned = progress.badges.some((b) => b.id === badge.id);
            return (
              <span
                key={badge.id}
                title={`${badge.name} — ${badge.description}`}
                className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${
                  earned ? "border-yellow-400/40 bg-yellow-400/10 text-yellow-300" : "border-white/10 text-white/25"
                }`}
              >
                <span className={earned ? "" : "grayscale opacity-40"}>{badge.emoji}</span>
                {badge.name}
              </span>
            );
          })}
        </div>
      </div>

      <ul className="mt-3 flex flex-col gap-2">
        {lessons.map((lesson) => {
          const count = progress.lessonSolvedCount(lesson.slug);
          const status = statusFor(count);
          return (
            <li key={lesson.slug}>
              <Link
                href={`/math/${lesson.slug}`}
                className="flex items-center justify-between gap-4 rounded-md border border-white/10 bg-white/5 px-4 py-3 transition hover:border-yellow-400 hover:text-yellow-400"
              >
                <span>
                  <span className="text-white/30">{lesson.lessonNumber}.</span>{" "}
                  <span className="font-semibold">{lesson.title}</span>
                  <span className="block text-xs text-white/40">{lesson.mathSkill}</span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className={`text-xs font-semibold ${status.className}`}>{status.label}</span>
                  <span className="text-white/30">→</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
