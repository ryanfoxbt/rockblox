"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { NO_PASSWORD_MANAGER_ATTRS } from "@/lib/formAttrs";
import { RW_GRADES } from "@/lib/rockWords";

export interface RockWordsWordRecord {
  id: number;
  grade: number;
  word: string;
  clue: string;
  clueShownByDefault: boolean;
  isPublished: boolean;
}

// Shared create/edit form for one RockWords word. Grade is only settable at
// creation — a word's length has to match its grade's configured word
// length, so changing grade later would risk silently invalidating the word
// itself; simpler to delete and recreate than reconcile in place (mirrors
// PATCH /api/rockwords-admin/words/[id], which doesn't accept grade either).
export function RockWordsWordForm({ initial }: { initial?: RockWordsWordRecord }) {
  const router = useRouter();
  const isEdit = !!initial;
  const [grade, setGrade] = useState(initial?.grade ?? RW_GRADES[0].grade);
  const [word, setWord] = useState(initial?.word ?? "");
  const [clue, setClue] = useState(initial?.clue ?? "");
  const [clueShownByDefault, setClueShownByDefault] = useState(initial?.clueShownByDefault ?? false);
  const [isPublished, setIsPublished] = useState(initial?.isPublished ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const gradeConfig = RW_GRADES.find((g) => g.grade === grade)!;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = isEdit
        ? await fetch(`/api/rockwords-admin/words/${initial!.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ word, clue, clueShownByDefault, isPublished }),
          })
        : await fetch("/api/rockwords-admin/words", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ grade, word, clue, clueShownByDefault }),
          });
      const data = (await res.json().catch(() => null)) as { error?: string; word?: { id: number } } | null;
      if (!res.ok) {
        setError(data?.error ?? "Something went wrong — try again.");
        setSaving(false);
        return;
      }
      router.push(isEdit ? "/rockwords/admin" : `/rockwords/admin/${data!.word!.id}`);
      router.refresh();
    } catch {
      setError("Something went wrong — try again.");
      setSaving(false);
    }
  }

  return (
    <div className="mt-6 flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm text-white/70">
        Grade
        <select
          value={grade}
          disabled={isEdit}
          onChange={(e) => setGrade(Number(e.target.value))}
          className="rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          {RW_GRADES.map((g) => (
            <option key={g.grade} value={g.grade} className="bg-slate-900">
              {g.label} ({g.wordLength} letters)
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm text-white/70">
        Word ({gradeConfig.wordLength} letters)
        <input
          {...NO_PASSWORD_MANAGER_ATTRS}
          value={word}
          onChange={(e) => setWord(e.target.value.toLowerCase())}
          maxLength={gradeConfig.wordLength}
          placeholder={"a".repeat(gradeConfig.wordLength)}
          className="rounded-md border border-white/15 bg-white/5 px-3 py-2 font-mono text-sm uppercase text-white placeholder:text-white/30 focus:border-yellow-400 focus:outline-none"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-white/70">
        Clue
        <textarea
          {...NO_PASSWORD_MANAGER_ATTRS}
          value={clue}
          onChange={(e) => setClue(e.target.value)}
          rows={3}
          placeholder="A pet that says meow."
          className="resize-none rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-yellow-400 focus:outline-none"
        />
      </label>

      <label className="flex items-center gap-2 text-sm text-white/70">
        <input
          type="checkbox"
          checked={clueShownByDefault}
          onChange={(e) => setClueShownByDefault(e.target.checked)}
          className="accent-yellow-400"
        />
        Clue is already showing when a round starts (players can always toggle it either way)
      </label>

      {isEdit && (
        <label className="flex items-center gap-2 text-sm text-white/70">
          <input
            type="checkbox"
            checked={isPublished}
            onChange={(e) => setIsPublished(e.target.checked)}
            className="accent-yellow-400"
          />
          Published (visible in the live rotation)
        </label>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="button"
        onClick={save}
        disabled={saving || word.trim().length !== gradeConfig.wordLength || clue.trim().length === 0}
        className="w-full rounded-full bg-yellow-400 px-4 py-1.5 text-sm font-bold text-slate-900 transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {saving ? "Saving…" : isEdit ? "Save changes" : "Create word"}
      </button>
    </div>
  );
}
