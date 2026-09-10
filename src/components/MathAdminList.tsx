"use client";

import { useState } from "react";
import Link from "next/link";

interface AdminLessonRow {
  slug: string;
  grade: number;
  lessonNumber: number;
  title: string;
  mathSkill: string;
  isPublished: boolean;
}

// The admin lesson list at /math/admin — styled to match the per-lesson rows
// on /math itself (MathProgressOverview): a clickable row with a trailing
// status pill and arrow, just with a publish toggle instead of a progress
// label. The toggle sits outside the row's Link so it can't create a nested
// <a>, but still lines up in the same trailing slot.
export function MathAdminList({ initialLessons }: { initialLessons: AdminLessonRow[] }) {
  const [lessons, setLessons] = useState(initialLessons);
  const [pending, setPending] = useState<string | null>(null);

  async function togglePublished(slug: string, next: boolean) {
    setPending(slug);
    setLessons((prev) => prev.map((l) => (l.slug === slug ? { ...l, isPublished: next } : l)));
    try {
      const res = await fetch(`/api/math-admin/lessons/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: next }),
      });
      if (!res.ok) throw new Error("failed");
    } catch {
      setLessons((prev) => prev.map((l) => (l.slug === slug ? { ...l, isPublished: !next } : l)));
    } finally {
      setPending(null);
    }
  }

  return (
    <ul className="mt-6 flex flex-col gap-2">
      {lessons.map((lesson) => (
        <li key={lesson.slug} className="group flex items-center gap-2 rounded-md border border-white/10 bg-white/5">
          <Link
            href={`/math/admin/${lesson.slug}`}
            className="min-w-0 flex-1 px-4 py-3 transition group-hover:text-yellow-400"
          >
            <span className="text-white/30">{lesson.lessonNumber}.</span> <span className="font-semibold">{lesson.title}</span>
            <span className="block text-xs font-normal text-white/40">{lesson.mathSkill}</span>
          </Link>
          <div className="flex shrink-0 items-center gap-3 pr-4">
            <button
              type="button"
              disabled={pending === lesson.slug}
              onClick={() => togglePublished(lesson.slug, !lesson.isPublished)}
              className={`rounded-full border px-2 py-0.5 text-xs font-semibold transition disabled:opacity-50 ${
                lesson.isPublished
                  ? "border-green-500/40 bg-green-500/10 text-green-300 hover:border-red-400 hover:text-red-300"
                  : "border-white/10 bg-white/5 text-white/40 hover:border-yellow-400 hover:text-yellow-400"
              }`}
            >
              {lesson.isPublished ? "Published" : "Unpublished"}
            </button>
            <Link href={`/math/admin/${lesson.slug}`} className="text-white/30 transition group-hover:text-yellow-400">
              →
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}
