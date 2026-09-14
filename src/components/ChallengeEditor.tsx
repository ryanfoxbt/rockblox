"use client";

import type { SlotLetter } from "@/lib/board";
import type { BeatChallengeTarget, MathChallenge } from "@/lib/mathSchool";
import { getInstrument, INSTRUMENTS, type InstrumentId } from "@/lib/instruments";

// The grid a lesson opens on (MathLessonWorkspace passes initialGridBeats=8,
// and MAX_BEATS itself is 8 — see src/lib/song.ts). Every prompt tells
// students to answer in quarter notes (one per block) so counting stays
// unambiguous, which caps a single-instrument target at 8 — above that, the
// only way to satisfy the target is to spread it across more than one
// instrument (an array in `instrument`, see BeatChallengeTarget), which
// raises the real cap to 8 per instrument in the target. Surfaced here so
// whoever's editing catches an impossible target before publishing, rather
// than a student hitting a wall mid-lesson.
export const MAX_GRID_BEATS = 8;

function instrumentsFor(target: BeatChallengeTarget): InstrumentId[] {
  return Array.isArray(target.instrument) ? target.instrument : [target.instrument];
}

export const COMPARISON_OPTIONS: { value: "eq" | "gt" | "lt"; label: string }[] = [
  { value: "eq", label: "exactly" },
  { value: "gt", label: "more than" },
  { value: "lt", label: "fewer than" },
];

export const fieldClass = "rounded-md border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white";
export const selectClass = "rounded-md border border-white/10 bg-slate-800 px-2 py-1.5 text-sm text-white";
// Hides the native number spinner (its light-chrome arrows clash with the
// dark theme everywhere else in the app) — inputs still accept the up/down
// arrow keys and scroll wheel, just without the ill-fitting widget.
export const numberFieldClass =
  "w-20 rounded-md border border-white/10 bg-slate-800 px-2 py-1.5 text-sm text-white [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

export function emptyChallenge(): MathChallenge {
  return { prompt: "", targets: [{ instrument: "kick", count: 1 }], explanation: "" };
}

// One slot's question/answer-target(s)/explanation form — the "Slot X" card.
// Shared by MathLessonEditor (editing an existing lesson) and
// MathLessonCreator (building a new one from scratch), so the two admin
// flows share one implementation of the actual authoring UI. Target rows
// mirror LineRow.tsx's instrument-row look (colored dot + select) so this
// reads as the same product, not a bolted-on backoffice tool.
export function ChallengeEditor({
  slot,
  challenge,
  onChangeText,
  onUpdateTarget,
  onAddTarget,
  onRemoveTarget,
}: {
  slot: SlotLetter;
  challenge: MathChallenge;
  onChangeText: (field: "prompt" | "explanation", value: string) => void;
  onUpdateTarget: (index: number, patch: Partial<BeatChallengeTarget>) => void;
  onAddTarget: () => void;
  onRemoveTarget: (index: number) => void;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
      <h2 className="text-sm font-bold uppercase tracking-wide text-yellow-400">Slot {slot}</h2>

      <label className="mt-3 flex flex-col gap-1 text-sm">
        <span className="text-white/50">Question</span>
        <textarea
          value={challenge.prompt}
          onChange={(e) => onChangeText("prompt", e.target.value)}
          rows={3}
          className={fieldClass}
        />
      </label>

      <div className="mt-3 flex flex-col gap-2">
        <span className="text-sm text-white/50">Answer — build this many quarter notes to pass</span>
        {challenge.targets.map((target, index) => {
          const instruments = instrumentsFor(target);
          const isSpread = instruments.length > 1;
          const cap = MAX_GRID_BEATS * instruments.length;
          return (
            <div key={index} className="flex flex-col gap-2 rounded-xl bg-white/5 p-3 md:flex-row md:flex-wrap md:items-center">
              <div className="flex flex-1 flex-wrap items-center gap-2">
                {isSpread ? (
                  <span className="flex items-center gap-1 rounded-md border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white/70">
                    {instruments.map((id) => (
                      <span key={id} className={`h-2.5 w-2.5 shrink-0 rounded-full ${getInstrument(id).color}`} aria-hidden />
                    ))}
                    Spread across {instruments.map((id) => getInstrument(id).name).join(", ")}
                  </span>
                ) : (
                  <>
                    <span className={`h-3 w-3 shrink-0 rounded-full ${getInstrument(instruments[0]).color}`} aria-hidden />
                    <select
                      value={instruments[0]}
                      onChange={(e) => onUpdateTarget(index, { instrument: e.target.value as InstrumentId })}
                      className={selectClass}
                    >
                      {INSTRUMENTS.map((inst) => (
                        <option key={inst.id} value={inst.id}>
                          {inst.name}
                        </option>
                      ))}
                    </select>
                  </>
                )}
                <select
                  value={target.comparison ?? "eq"}
                  onChange={(e) =>
                    onUpdateTarget(index, {
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
                  onChange={(e) => onUpdateTarget(index, { count: Math.max(1, Number(e.target.value) || 1) })}
                  className={numberFieldClass}
                />
                <span className="text-xs text-white/40">quarter notes</span>
                {challenge.targets.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onRemoveTarget(index)}
                    className="ml-auto shrink-0 text-xs text-red-400 transition hover:text-red-300"
                  >
                    Remove
                  </button>
                )}
              </div>
              {target.count > cap && (
                <span className="text-xs text-amber-400">
                  ⚠ {target.count} is more than {isSpread ? `these ${instruments.length} rows can hold (${cap})` : `one ${MAX_GRID_BEATS}-block row can hold`}{" "}
                  in quarter notes — split it across more instruments, or lower the target.
                </span>
              )}
            </div>
          );
        })}
        <button type="button" onClick={onAddTarget} className="self-start text-xs text-white/40 transition hover:text-yellow-400">
          + Add another instrument target
        </button>
      </div>

      <label className="mt-3 flex flex-col gap-1 text-sm">
        <span className="text-white/50">Explanation (shown after checking)</span>
        <textarea
          value={challenge.explanation}
          onChange={(e) => onChangeText("explanation", e.target.value)}
          rows={2}
          className={fieldClass}
        />
      </label>
    </div>
  );
}
