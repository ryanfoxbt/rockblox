"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SLOT_LETTERS, type SlotLetter } from "@/lib/board";
import type { BeatChallengeTarget, MathChallenge } from "@/lib/mathSchool";
import { getInstrument, INSTRUMENTS, type InstrumentId } from "@/lib/instruments";

interface EditableLesson {
  slug: string;
  grade: number;
  lessonNumber: number;
  title: string;
  mathSkill: string;
  teaches: string;
  challenges: Record<SlotLetter, MathChallenge>;
  isPublished: boolean;
}

// The grid a lesson opens on (MathLessonWorkspace passes initialGridBeats=8,
// and MAX_BEATS itself is 8 — see src/lib/song.ts) — a target above this
// can still technically be built, but only by packing more than one hit
// into a block (eighth-note pairs, etc.), which isn't obvious at this grade.
// Surfaced here so whoever's editing catches it before publishing, rather
// than a student hitting a wall mid-lesson.
const MAX_GRID_BEATS = 8;

const COMPARISON_OPTIONS: { value: "eq" | "gt" | "lt"; label: string }[] = [
  { value: "eq", label: "exactly" },
  { value: "gt", label: "more than" },
  { value: "lt", label: "fewer than" },
];

const fieldClass = "rounded-md border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white";
const selectClass = "rounded-md border border-white/10 bg-slate-800 px-2 py-1.5 text-sm text-white";
// Hides the native number spinner (its light-chrome arrows clash with the
// dark theme everywhere else in the app) — inputs still accept the up/down
// arrow keys and scroll wheel, just without the ill-fitting widget.
const numberFieldClass =
  "w-20 rounded-md border border-white/10 bg-slate-800 px-2 py-1.5 text-sm text-white [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

function cloneChallenges(c: Record<SlotLetter, MathChallenge>): Record<SlotLetter, MathChallenge> {
  const out = {} as Record<SlotLetter, MathChallenge>;
  for (const slot of SLOT_LETTERS) {
    out[slot] = { ...c[slot], targets: c[slot].targets.map((t) => ({ ...t })) };
  }
  return out;
}

// Full edit form for one lesson's title/skill/teaches plus every slot's
// question, answer target(s), and explanation — PATCHes
// /api/math-admin/lessons/[slug] on Save. Gated to the math curriculum
// admin by the parent page (requireMathAdmin). Target rows mirror
// LineRow.tsx's instrument-row look (colored dot + select) so this reads as
// the same product, not a bolted-on backoffice tool.
export function MathLessonEditor({ lesson }: { lesson: EditableLesson }) {
  const router = useRouter();
  const [title, setTitle] = useState(lesson.title);
  const [mathSkill, setMathSkill] = useState(lesson.mathSkill);
  const [teaches, setTeaches] = useState(lesson.teaches);
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
        body: JSON.stringify({ title, mathSkill, teaches, challenges, isPublished }),
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
      </div>

      <div className="mt-6 flex flex-col gap-4">
        {SLOT_LETTERS.map((slot) => {
          const challenge = challenges[slot];
          return (
            <div key={slot} className="rounded-lg border border-white/10 bg-white/5 p-4">
              <h2 className="text-sm font-bold uppercase tracking-wide text-yellow-400">Slot {slot}</h2>

              <label className="mt-3 flex flex-col gap-1 text-sm">
                <span className="text-white/50">Question</span>
                <textarea
                  value={challenge.prompt}
                  onChange={(e) => updateChallengeText(slot, "prompt", e.target.value)}
                  rows={3}
                  className={fieldClass}
                />
              </label>

              <div className="mt-3 flex flex-col gap-2">
                <span className="text-sm text-white/50">Answer — build this many hits to pass</span>
                {challenge.targets.map((target, index) => (
                  <div key={index} className="flex flex-col gap-2 rounded-xl bg-white/5 p-3 md:flex-row md:flex-wrap md:items-center">
                    <div className="flex flex-1 flex-wrap items-center gap-2">
                      <span
                        className={`h-3 w-3 shrink-0 rounded-full ${getInstrument(target.instrument).color}`}
                        aria-hidden
                      />
                      <select
                        value={target.instrument}
                        onChange={(e) => updateTarget(slot, index, { instrument: e.target.value as InstrumentId })}
                        className={selectClass}
                      >
                        {INSTRUMENTS.map((inst) => (
                          <option key={inst.id} value={inst.id}>
                            {inst.name}
                          </option>
                        ))}
                      </select>
                      <select
                        value={target.comparison ?? "eq"}
                        onChange={(e) =>
                          updateTarget(slot, index, {
                            comparison: e.target.value === "eq" ? undefined : (e.target.value as "gt" | "lt"),
                          })
                        }
                        className={selectClass}
                      >
                        {COMPARISON_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={1}
                        value={target.count}
                        onChange={(e) => updateTarget(slot, index, { count: Math.max(1, Number(e.target.value) || 1) })}
                        className={numberFieldClass}
                      />
                      <span className="text-xs text-white/40">hits</span>
                      {challenge.targets.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeTarget(slot, index)}
                          className="ml-auto shrink-0 text-xs text-red-400 transition hover:text-red-300"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    {target.count > MAX_GRID_BEATS && (
                      <span className="text-xs text-amber-400">
                        ⚠ {target.count} is more than the {MAX_GRID_BEATS}-block grid — building it needs multiple
                        hits packed into some blocks (e.g. eighth-note pairs), which may not be obvious at this
                        grade.
                      </span>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addTarget(slot)}
                  className="self-start text-xs text-white/40 transition hover:text-yellow-400"
                >
                  + Add another instrument target
                </button>
              </div>

              <label className="mt-3 flex flex-col gap-1 text-sm">
                <span className="text-white/50">Explanation (shown after checking)</span>
                <textarea
                  value={challenge.explanation}
                  onChange={(e) => updateChallengeText(slot, "explanation", e.target.value)}
                  rows={2}
                  className={fieldClass}
                />
              </label>
            </div>
          );
        })}
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
            <span className={`text-sm ${message.kind === "ok" ? "text-green-400" : "text-red-400"}`}>
              {message.text}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
