"use client";

import { useMemo, useState } from "react";
import { MATH_GRADES } from "@/lib/mathSchool";
import { MathProgressOverview } from "@/components/MathProgressOverview";

interface LessonRow {
  slug: string;
  grade: number;
  lessonNumber: number;
  title: string;
  mathSkill: string;
}

// The lesson browser on /math — same tab-bar-over-a-flat-list shape as
// RockWordsAdminList: one grade's lessons shown at a time behind a pill bar,
// rather than every grade's section rendered and expanded at once. With
// K-9 (10 grades x 24 lessons = 240 rows), a fully-expanded page was an
// enormous scroll for a visitor just looking for one grade.
export function MathLessonsBrowser({
  lessons,
  allLessonSlugs,
}: {
  lessons: LessonRow[];
  allLessonSlugs: string[];
}) {
  const countByGrade = useMemo(() => {
    const counts = new Map<number, number>();
    for (const lesson of lessons) counts.set(lesson.grade, (counts.get(lesson.grade) ?? 0) + 1);
    return counts;
  }, [lessons]);

  // Defaults to the first grade that actually has any published lessons, so
  // a grade still mid-rollout doesn't open on an empty tab.
  const [selectedGrade, setSelectedGrade] = useState<number>(
    () => MATH_GRADES.find((g) => (countByGrade.get(g.grade) ?? 0) > 0)?.grade ?? MATH_GRADES[0].grade
  );

  const visibleLessons = lessons.filter((l) => l.grade === selectedGrade);

  return (
    <div>
      <div className="mt-6 flex flex-wrap gap-1.5">
        {MATH_GRADES.map((g) => (
          <button
            key={g.grade}
            type="button"
            onClick={() => setSelectedGrade(g.grade)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
              selectedGrade === g.grade
                ? "border-yellow-400 bg-yellow-400/10 text-yellow-300"
                : "border-white/10 bg-white/5 text-white/50 hover:border-yellow-400 hover:text-yellow-400"
            }`}
          >
            {g.label} <span className="text-white/30">({countByGrade.get(g.grade) ?? 0})</span>
          </button>
        ))}
      </div>

      {visibleLessons.length === 0 ? (
        <p className="mt-6 rounded-md border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/40">
          No published lessons yet for{" "}
          {MATH_GRADES.find((g) => g.grade === selectedGrade)?.label ?? `Grade ${selectedGrade}`}.
        </p>
      ) : (
        <MathProgressOverview grade={selectedGrade} lessons={visibleLessons} allLessonSlugs={allLessonSlugs} />
      )}
    </div>
  );
}
