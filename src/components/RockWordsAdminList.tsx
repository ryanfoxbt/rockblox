"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { gradeByNumber, RW_GRADES } from "@/lib/rockWords";

interface AdminWordRow {
  id: number;
  grade: number;
  word: string;
  clue: string;
  isPublished: boolean;
}

// The admin word list at /rockwords/admin — same shape as MathAdminList: a
// clickable row with a trailing publish-toggle pill, plus a delete button
// (words have no downstream references to worry about, unlike a math
// lesson's progress rows, so a hard delete is safe here).
//
// One grade's worth of rows shown at a time behind a tab bar, rather than
// every grade's section rendered and expanded at once — with 13 grades
// (K through 12) instead of the original 3, a fully-expanded flat list
// would run to hundreds of rows on one page.
export function RockWordsAdminList({ initialWords }: { initialWords: AdminWordRow[] }) {
  const [words, setWords] = useState(initialWords);
  const [pending, setPending] = useState<number | null>(null);

  const countByGrade = useMemo(() => {
    const counts = new Map<number, number>();
    for (const word of words) counts.set(word.grade, (counts.get(word.grade) ?? 0) + 1);
    return counts;
  }, [words]);

  // Defaults to the first grade that actually has any words, so a fresh
  // database (or one where only later grades are seeded yet) doesn't open
  // on an empty tab.
  const [selectedGrade, setSelectedGrade] = useState<number>(
    () => RW_GRADES.find((g) => (countByGrade.get(g.grade) ?? 0) > 0)?.grade ?? RW_GRADES[0].grade
  );

  async function togglePublished(id: number, next: boolean) {
    setPending(id);
    setWords((prev) => prev.map((w) => (w.id === id ? { ...w, isPublished: next } : w)));
    try {
      const res = await fetch(`/api/rockwords-admin/words/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: next }),
      });
      if (!res.ok) throw new Error("failed");
    } catch {
      setWords((prev) => prev.map((w) => (w.id === id ? { ...w, isPublished: !next } : w)));
    } finally {
      setPending(null);
    }
  }

  async function remove(id: number) {
    setPending(id);
    try {
      const res = await fetch(`/api/rockwords-admin/words/${id}`, { method: "DELETE" });
      if (res.ok) setWords((prev) => prev.filter((w) => w.id !== id));
    } finally {
      setPending(null);
    }
  }

  const visibleWords = words.filter((w) => w.grade === selectedGrade);

  return (
    <div className="mt-6 flex flex-col gap-4">
      <div className="flex flex-wrap gap-1.5">
        {RW_GRADES.map((g) => (
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

      {visibleWords.length === 0 ? (
        <p className="rounded-md border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/40">
          No words yet for {gradeByNumber(selectedGrade)?.label ?? `Grade ${selectedGrade}`}.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visibleWords.map((word) => (
            <li key={word.id} className="group flex items-center gap-2 rounded-md border border-white/10 bg-white/5">
              <Link
                href={`/rockwords/admin/${word.id}`}
                className="min-w-0 flex-1 px-4 py-3 transition group-hover:text-yellow-400"
              >
                <span className="font-semibold uppercase">{word.word}</span>
                <span className="block text-xs font-normal text-white/40">{word.clue}</span>
              </Link>
              <div className="flex shrink-0 items-center gap-2 pr-4">
                <button
                  type="button"
                  disabled={pending === word.id}
                  onClick={() => togglePublished(word.id, !word.isPublished)}
                  className={`rounded-full border px-2 py-0.5 text-xs font-semibold transition disabled:opacity-50 ${
                    word.isPublished
                      ? "border-green-500/40 bg-green-500/10 text-green-300 hover:border-red-400 hover:text-red-300"
                      : "border-white/10 bg-white/5 text-white/40 hover:border-yellow-400 hover:text-yellow-400"
                  }`}
                >
                  {word.isPublished ? "Published" : "Unpublished"}
                </button>
                <button
                  type="button"
                  disabled={pending === word.id}
                  onClick={() => {
                    if (window.confirm(`Delete "${word.word}"? This can't be undone.`)) void remove(word.id);
                  }}
                  className="text-xs text-white/30 transition hover:text-red-400 disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
