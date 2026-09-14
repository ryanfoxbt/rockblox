"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SLOT_LETTERS, type SlotLetter } from "@/lib/board";
import type { BeatChallengeTarget, MathChallenge } from "@/lib/mathSchool";
import { ChallengeEditor, emptyChallenge, fieldClass, numberFieldClass } from "@/components/ChallengeEditor";

function emptyChallenges(): Record<SlotLetter, MathChallenge> {
  const out = {} as Record<SlotLetter, MathChallenge>;
  for (const slot of SLOT_LETTERS) out[slot] = emptyChallenge();
  return out;
}

// Builds a brand-new lesson from scratch: grade, lesson number, and tempo up
// front (the only fields that can never be changed later — see
// MathLessonEditor, whose PATCH route deliberately excludes them), then the
// same title/skill/teaches fields and per-slot ChallengeEditor as the edit
// form. POSTs /api/math-admin/lessons; on success the slug comes back from
// the server (derived from grade + lesson number + title, see
// mathLessonSlug) and this redirects straight into MathLessonEditor for that
// new lesson so the admin lands somewhere they can keep refining it.
export function MathLessonCreator({ existing }: { existing: { grade: number; lessonNumber: number }[] }) {
  const router = useRouter();
  const [grade, setGrade] = useState(1);
  const [lessonNumber, setLessonNumber] = useState(
    () => 1 + Math.max(0, ...existing.filter((l) => l.grade === 1).map((l) => l.lessonNumber))
  );
  const [bpm, setBpm] = useState(84);
  const [title, setTitle] = useState("");
  const [mathSkill, setMathSkill] = useState("");
  const [teaches, setTeaches] = useState("");
  const [challenges, setChallenges] = useState(emptyChallenges);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function changeGrade(nextGrade: number) {
    setGrade(nextGrade);
    setLessonNumber(1 + Math.max(0, ...existing.filter((l) => l.grade === nextGrade).map((l) => l.lessonNumber)));
  }

  function updateChallengeText(slot: SlotLetter, field: "prompt" | "explanation", value: string) {
    setChallenges((prev) => ({ ...prev, [slot]: { ...prev[slot], [field]: value } }));
  }

  function updateTarget(slot: SlotLetter, index: number, patch: Partial<BeatChallengeTarget>) {
    setChallenges((prev) => {
      const targets = prev[slot].targets.map((t, i) => (i === index ? { ...t, ...patch } : t));
      return { ...prev, [slot]: { ...prev[slot], targets } };
    });
  }

  function addTarget(slot: SlotLetter) {
    setChallenges((prev) => ({
      ...prev,
      [slot]: { ...prev[slot], targets: [...prev[slot].targets, { instrument: "kick", count: 1 }] },
    }));
  }

  function removeTarget(slot: SlotLetter, index: number) {
    setChallenges((prev) => {
      if (prev[slot].targets.length <= 1) return prev;
      return { ...prev, [slot]: { ...prev[slot], targets: prev[slot].targets.filter((_, i) => i !== index) } };
    });
  }

  async function create() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/math-admin/lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grade, lessonNumber, bpm, title, mathSkill, teaches, challenges }),
      });
      const body = (await res.json().catch(() => null)) as { lesson?: { slug: string }; error?: string } | null;
      if (!res.ok || !body?.lesson) throw new Error(body?.error ?? "Create failed");
      router.push(`/math/admin/${body.lesson.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
      setSaving(false);
    }
  }

  return (
    <div className="mt-2 pb-28">
      <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
        New <span className="text-yellow-400">Lesson</span>
      </h1>
      <p className="mt-2 text-sm text-white/50">
        Starts unpublished — build it out and hit Publish on its own page once it&rsquo;s ready for{" "}
        <span className="text-white/70">/math</span>.
      </p>

      <div className="mt-4 flex flex-col gap-3 rounded-lg border border-white/10 bg-white/5 p-4">
        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-white/50">Grade</span>
            <input
              type="number"
              min={0}
              value={grade}
              onChange={(e) => changeGrade(Math.max(0, Number(e.target.value) || 0))}
              className={numberFieldClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-white/50">Lesson number</span>
            <input
              type="number"
              min={1}
              value={lessonNumber}
              onChange={(e) => setLessonNumber(Math.max(1, Number(e.target.value) || 1))}
              className={numberFieldClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-white/50">Tempo (bpm)</span>
            <input
              type="number"
              min={40}
              max={200}
              value={bpm}
              onChange={(e) => setBpm(Math.max(40, Math.min(200, Number(e.target.value) || 84)))}
              className={numberFieldClass}
            />
          </label>
        </div>
        <p className="text-xs text-white/40">
          Grade, lesson number, and tempo can&rsquo;t be changed once created — everything else can. Use grade 0 for
          Kindergarten.
        </p>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-white/50">Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Measuring Length with Units"
            className={fieldClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-white/50">Math skill (Common Core label)</span>
          <input
            value={mathSkill}
            onChange={(e) => setMathSkill(e.target.value)}
            placeholder="e.g. Measuring Length (2.MD.A.1)"
            className={fieldClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-white/50">Teaches (shown under the lesson)</span>
          <textarea value={teaches} onChange={(e) => setTeaches(e.target.value)} rows={2} className={fieldClass} />
        </label>
      </div>

      <div className="mt-6 flex flex-col gap-4">
        {SLOT_LETTERS.map((slot) => (
          <ChallengeEditor
            key={slot}
            slot={slot}
            challenge={challenges[slot]}
            onChangeText={(field, value) => updateChallengeText(slot, field, value)}
            onUpdateTarget={(index, patch) => updateTarget(slot, index, patch)}
            onAddTarget={() => addTarget(slot)}
            onRemoveTarget={(index) => removeTarget(slot, index)}
          />
        ))}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-slate-950/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <button
            type="button"
            onClick={create}
            disabled={saving || !title.trim() || !mathSkill.trim() || !teaches.trim()}
            className="rounded-md bg-yellow-400 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-yellow-300 disabled:opacity-50"
          >
            {saving ? "Creating…" : "Create lesson"}
          </button>
          {error && <span className="text-sm text-red-400">{error}</span>}
        </div>
      </div>
    </div>
  );
}
