"use client";

import { useState } from "react";
import Link from "next/link";
import { gradeByNumber } from "@/lib/rockWords";

interface AdminWordRow {
  id: number;
  grade: number;
  word: string;
  clue: string;
  isPublished: boolean;
}

// The admin word list at /rockwords/admin — same shape as MathAdminList: a
// clickable row grouped by grade with a trailing publish-toggle pill, plus a
// delete button (words have no downstream references to worry about,
// unlike a math lesson's progress rows, so a hard delete is safe here).
export function RockWordsAdminList({ initialWords }: { initialWords: AdminWordRow[] }) {
  const [words, setWords] = useState(initialWords);
  const [pending, setPending] = useState<number | null>(null);

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

  const gradeGroups = new Map<number, AdminWordRow[]>();
  for (const word of words) {
    const group = gradeGroups.get(word.grade) ?? [];
    group.push(word);
    gradeGroups.set(word.grade, group);
  }

  return (
    <div className="mt-6 flex flex-col gap-6">
      {[...gradeGroups.entries()].map(([grade, gradeWords]) => (
        <section key={grade}>
          <h2 className="text-xs font-bold uppercase tracking-wide text-white/40">
            {gradeByNumber(grade)?.label ?? `Grade ${grade}`}
          </h2>
          <ul className="mt-2 flex flex-col gap-2">
            {gradeWords.map((word) => (
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
        </section>
      ))}
    </div>
  );
}
