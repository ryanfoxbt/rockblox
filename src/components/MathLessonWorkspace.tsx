"use client";

import { useEffect, useState } from "react";
import { Editor } from "./Editor";
import { Confetti } from "./Confetti";
import { MathLessonAbout } from "./MathLessonAbout";
import type { BoardSlotData, ExtendedSlotLetter, SlotLetter, SlotMap } from "@/lib/board";
import type { MathChallenge } from "@/lib/mathSchool";
import { getTileById } from "@/lib/rhythm";
import type { StoredLine } from "@/lib/song";
import type { StackArrangement } from "@/lib/stack";
import { useMathProgress } from "@/lib/useMathProgress";
import { playSuccessSound } from "@/lib/successSound";
import { DEFAULT_KIT } from "@/lib/drumKits";

// Counts real hits (not rests) a target instrument has in a slot's lines —
// a tile can itself hold more than one hit (an eighth pair, a triplet run),
// so this is the total sound count, not the block count, matching how every
// challenge prompt talks about "hits." Sums across every line using that
// instrument in case the student added more than one.
function countHitsForInstrument(lines: StoredLine[], instrument: string): number {
  let total = 0;
  for (const line of lines) {
    if (line.instrument !== instrument) continue;
    for (const id of line.blocks) {
      if (!id) continue;
      const tile = getTileById(id);
      if (!tile) continue;
      for (const hit of tile.hits) {
        if (hit.type === "note") total++;
      }
    }
  }
  return total;
}

function targetMet(count: number, target: MathChallenge["targets"][number]): boolean {
  // An untouched, empty row always reads as 0 hits — never let that count
  // as a correct answer, even for a "fewer than N" target where 0 would
  // technically satisfy the inequality. Every real answer requires
  // actually building something.
  if (count === 0) return false;
  switch (target.comparison) {
    case "gt":
      return count > target.count;
    case "lt":
      return count < target.count;
    default:
      return count === target.count;
  }
}

function isSlotLetter(slot: ExtendedSlotLetter): slot is SlotLetter {
  return slot === "A" || slot === "B" || slot === "C" || slot === "D";
}

type Status = "unanswered" | "correct" | "incorrect";

interface NeighborLesson {
  slug: string;
  lessonNumber: number;
  title: string;
  mathSkill: string;
}

// RockBlocks Math's whole interactive layer is deliberately just this: the
// real, unmodified Editor (so play, kit, tempo, sheet music, drummer view,
// and Save a Copy all work exactly like they do everywhere else on the
// site), plus two floating buttons and a popover — not a second, rebuilt
// interface stacked above or below it. Every slot (A-D) is its own
// question, opens blank, and is graded independently; switching slots
// swaps which question the popover shows and resets the checked state.
// Progress (score, badges) is layered on top via useMathProgress: instant
// for everyone through localStorage, permanent once signed in.
export function MathLessonWorkspace({
  lesson,
  prev,
  next,
  total,
  initialSlot,
  allLessonSlugs,
}: {
  initialSlot?: ExtendedSlotLetter;
  lesson: {
    slug: string;
    grade: number;
    lessonNumber: number;
    title: string;
    mathSkill: string;
    teaches: string;
    challenges: Record<SlotLetter, MathChallenge>;
    slotA: BoardSlotData | null;
    slotB: BoardSlotData | null;
    slotC: BoardSlotData | null;
    slotD: BoardSlotData | null;
    stack: StackArrangement | null;
  };
  prev: NeighborLesson | null;
  next: NeighborLesson | null;
  total: number;
  allLessonSlugs: string[];
}) {
  const [snapshot, setSnapshot] = useState<SlotMap | null>(null);
  const [activeSlot, setActiveSlot] = useState<ExtendedSlotLetter>(initialSlot ?? "A");
  const [modalOpen, setModalOpen] = useState(false);
  const [status, setStatus] = useState<Status>("unanswered");
  const [attempts, setAttempts] = useState(0);
  const [confettiBurst, setConfettiBurst] = useState(0);

  const progress = useMathProgress(allLessonSlugs);

  function handleSnapshotChange(slots: SlotMap, slot: ExtendedSlotLetter) {
    setSnapshot(slots);
    setActiveSlot((prevSlot) => {
      if (slot === prevSlot) return prevSlot;
      setStatus("unanswered");
      setAttempts(0);
      return slot;
    });
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setModalOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const challenge = isSlotLetter(activeSlot) ? lesson.challenges[activeSlot] : lesson.challenges.A;
  const revealExplanation = status === "correct" || attempts >= 2;
  const lessonSolvedCount = progress.lessonSolvedCount(lesson.slug);

  function check() {
    const answerLines = snapshot?.[activeSlot]?.lines ?? [];
    const allMet = challenge.targets.every((t) => targetMet(countHitsForInstrument(answerLines, t.instrument), t));
    setStatus(allMet ? "correct" : "incorrect");
    if (allMet) {
      progress.markSolved(lesson.slug, activeSlot);
      setConfettiBurst((n) => n + 1);
      playSuccessSound(snapshot?.[activeSlot]?.kit ?? DEFAULT_KIT);
    } else {
      setAttempts((n) => n + 1);
    }
    setModalOpen(true);
  }

  return (
    <>
      <Editor
        board={{
          slug: lesson.slug,
          displayName: lesson.title,
          slots: { A: lesson.slotA, B: lesson.slotB, C: lesson.slotC, D: lesson.slotD },
          stack: lesson.stack,
          readOnly: true,
          basePath: `/math/${lesson.slug}`,
          subtitle: `Grade ${lesson.grade} Lesson ${lesson.lessonNumber}: ${lesson.title} — ${lesson.mathSkill}`,
        }}
        initialSlot={initialSlot}
        initialGridBeats={8}
        lessonNav={{
          prevHref: prev ? `/math/${prev.slug}` : null,
          nextHref: next ? `/math/${next.slug}` : null,
        }}
        onSnapshotChange={handleSnapshotChange}
      />

      {/* Reserves room below the last instrument row so the fixed
          progress/Question/Check Answer stack never sits on top of real,
          clickable beat blocks — without this it overlaps whichever row
          happens to land at the bottom of the page (e.g. Bass Drum, the
          Editor's default third line). The tile palette is a persistent
          left sidebar nearly the height of the viewport on desktop, so
          everything below lives in one right-anchored column — bottom-left
          isn't safe here the way it is on most pages. */}
      <div aria-hidden className="h-40 bg-slate-950" />

      <Confetti burstKey={confettiBurst} />

      {progress.justEarned && (
        <div
          className="fixed bottom-24 left-1/2 z-[70] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 cursor-pointer rounded-lg border border-yellow-400/50 bg-slate-800 px-4 py-3 text-center shadow-2xl"
          onClick={progress.dismissJustEarned}
        >
          <p className="text-2xl">{progress.justEarned.emoji}</p>
          <p className="mt-1 text-sm font-bold text-yellow-300">Badge earned: {progress.justEarned.name}!</p>
          <p className="text-xs text-white/50">{progress.justEarned.description}</p>
        </div>
      )}

      <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2">
        <span className="rounded-full border border-white/10 bg-slate-800/90 px-3 py-1 text-xs font-semibold text-white/70 shadow-lg backdrop-blur">
          🎯 Lesson: {lessonSolvedCount}/4 · 🥁 {progress.totalSolved} solved · {progress.badges.length} badge
          {progress.badges.length === 1 ? "" : "s"}
          {!progress.signedIn && progress.totalSolved > 0 && (
            <span className="ml-1 font-normal text-white/40">(sign in to save for good)</span>
          )}
        </span>
        {status === "correct" && (
          <span className="rounded-full border border-green-500/40 bg-green-500/10 px-3 py-1 text-xs font-semibold text-green-300">
            Slot {activeSlot} solved!
          </span>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="rounded-md border border-white/15 bg-slate-800 px-4 py-2 text-sm font-semibold text-white/80 shadow-lg transition hover:border-yellow-400 hover:text-yellow-400"
          >
            ❓ Question
          </button>
          <button
            type="button"
            onClick={check}
            className="rounded-md bg-yellow-400 px-4 py-2 text-sm font-bold text-slate-950 shadow-lg transition hover:bg-yellow-300"
          >
            ✓ Check Answer
          </button>
        </div>
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-white/10 bg-slate-900 p-6 text-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-sm font-bold uppercase tracking-wide text-yellow-400">Slot {activeSlot} Question</h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Close"
                className="text-white/40 transition hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="mt-3 text-sm leading-relaxed text-white/90">{challenge.prompt}</p>

            {status === "correct" && (
              <p className="mt-4 rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-300">
                <span className="font-bold">Yes! </span>
                {challenge.explanation}
              </p>
            )}
            {status === "incorrect" && !revealExplanation && (
              <p className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                Not quite — close this, count the hits you&rsquo;ve placed in Slot {activeSlot}, and try again.
              </p>
            )}
            {status === "incorrect" && revealExplanation && (
              <p className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                <span className="font-bold">Not quite. </span>
                {challenge.explanation}
              </p>
            )}

            <div className="mt-5 flex items-center gap-3">
              {status !== "correct" && (
                <button
                  type="button"
                  onClick={check}
                  className="rounded-md bg-yellow-400 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-yellow-300"
                >
                  Check Answer
                </button>
              )}
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-sm text-white/50 transition hover:text-white/80"
              >
                {status === "correct" ? "Keep playing" : "Close and keep building"}
              </button>
            </div>
          </div>
        </div>
      )}

      <MathLessonAbout
        lesson={{
          grade: lesson.grade,
          lessonNumber: lesson.lessonNumber,
          title: lesson.title,
          mathSkill: lesson.mathSkill,
          teaches: lesson.teaches,
        }}
        prev={prev}
        next={next}
        total={total}
      />
    </>
  );
}
