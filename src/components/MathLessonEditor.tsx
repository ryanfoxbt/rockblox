"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SLOT_LETTERS, type SlotLetter } from "@/lib/board";
import type { BeatChallengeTarget, MathChallenge } from "@/lib/mathSchool";
import { ChallengeEditor, fieldClass } from "@/components/ChallengeEditor";

interface EditableLesson {
  slug: string;
  grade: number;
  lessonNumber: number;
  title: string;
  mathSkill: string;
  teaches: string;
  careerConnection: string | null;
  challenges: Record<SlotLetter, MathChallenge>;
  isPublished: boolean;
}

function cloneChallenges(c: Record<SlotLetter, MathChallenge>): Record<SlotLetter, MathChallenge> {
  const out = {} as Record<SlotLetter, MathChallenge>;
  for (const slot of SLOT_LETTERS) {
    out[slot] = { ...c[slot], targets: c[slot].targets.map((t) => ({ ...t })) };
  }
  return out;
}

// Full edit form for one lesson's title/skill/teaches plus every slot's
// question, answer target(s), and explanation (via ChallengeEditor) —
// PATCHes /api/math-admin/lessons/[slug] on Save. Gated to the math
// curriculum admin by the parent page (requireMathAdmin). Structural fields
// (slug, grade, lessonNumber) aren't editable here — see
// MathLessonCreator for building a new lesson from scratch instead.
export function MathLessonEditor({ lesson }: { lesson: EditableLesson }) {
  const router = useRouter();
  const [title, setTitle] = useState(lesson.title);
  const [mathSkill, setMathSkill] = useState(lesson.mathSkill);
  const [teaches, setTeaches] = useState(lesson.teaches);
  const [careerConnection, setCareerConnection] = useState(lesson.careerConnection ?? "");
  const [isPublished, setIsPublished] = useState(lesson.isPublished);
  const [challenges, setChallenges] = useState(() => cloneChallenges(lesson.challenges));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

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

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/math-admin/lessons/${lesson.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, mathSkill, teaches, careerConnection, challenges, isPublished }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Save failed");
      }
      setMessage({ kind: "ok", text: "Saved." });
      router.refresh();
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : "Save failed" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-2 pb-28">
      <div className="flex items-start justify-between gap-4">
        <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
          Grade {lesson.grade} <span className="text-yellow-400">Lesson {lesson.lessonNumber}</span>
        </h1>
        <button
          type="button"
          onClick={() => setIsPublished((p) => !p)}
          className={`mt-2 shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold transition ${
            isPublished
              ? "border-green-500/40 bg-green-500/10 text-green-300 hover:border-red-400 hover:text-red-300"
              : "border-white/10 bg-white/5 text-white/40 hover:border-yellow-400 hover:text-yellow-400"
          }`}
        >
          {isPublished ? "Published" : "Unpublished"}
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-3 rounded-lg border border-white/10 bg-white/5 p-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-white/50">Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={fieldClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-white/50">Math skill (Common Core label)</span>
          <input value={mathSkill} onChange={(e) => setMathSkill(e.target.value)} className={fieldClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-white/50">Teaches (shown under the lesson)</span>
          <textarea value={teaches} onChange={(e) => setTeaches(e.target.value)} rows={2} className={fieldClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-white/50">
            💡 Who uses this? (behind the light bulb icon — leave blank to hide it)
          </span>
          <textarea
            value={careerConnection}
            onChange={(e) => setCareerConnection(e.target.value)}
            rows={3}
            placeholder="e.g. Lumber traders and freight dispatchers solve this exact equation to figure out how many truckloads they need..."
            className={fieldClass}
          />
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
            onClick={save}
            disabled={saving}
            className="rounded-md bg-yellow-400 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-yellow-300 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
          {message && (
            <span className={`text-sm ${message.kind === "ok" ? "text-green-400" : "text-red-400"}`}>{message.text}</span>
          )}
        </div>
      </div>
    </div>
  );
}
