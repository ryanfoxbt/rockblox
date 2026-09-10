// One-off / re-runnable seed for RockBlocks Math (/math) — a grade-aligned
// math curriculum where every lesson pairs a Common-Core math concept with a
// real, gradeable question per slot (see MathChallenge in
// src/lib/mathSchool.ts and src/components/MathLessonWorkspace.tsx, which
// grades whatever the student builds directly in that slot's own beat
// blocks, in the real Editor). See src/lib/mathSchool.ts for the matching
// index used by /math's list pages, and src/db/schema.ts for the
// `mathLessons` table shape.
//
// Third pass: every slot is now its own question the student answers by
// building a beat, rather than 3 read-only demo patterns plus one answer
// slot — so there's no demo StoredLine content left to seed at all. Every
// slot opens on the Editor's normal blank starter; only the metadata
// (challenges, a Stack arrangement) comes from the database.
import { getDb } from "../src/db";
import { mathLessons } from "../src/db/schema";
import type { SlotLetter } from "../src/lib/board";
import type { StackArrangement } from "../src/lib/stack";
import { MATH_LESSONS } from "../src/lib/mathSchool";

function stackId(slug: string, n: number): string {
  return `step-${slug}-${n}`;
}

// The shape every one of the 100 Drum School lessons converged on (6 groove
// steps, 2 fill/variation steps) — reused here so a lesson's Stack isn't
// just "repeat A forever." Since every slot is blank until the student
// builds it, a fresh visitor's Stack plays back whatever they've answered
// so far (silence for anything not yet built).
function standardSteps(slug: string): { id: string; slot: SlotLetter }[] {
  const seq: SlotLetter[] = ["A", "A", "B", "A", "C", "A", "B", "D"];
  return seq.map((s, i) => ({ id: stackId(slug, i + 1), slot: s }));
}

const db = getDb();

// Earlier passes used entirely different slugs and column shapes — rather
// than leave stale rows behind, clear the table before reseeding. Safe:
// this is this project's own recently-added, not-yet-launched content, not
// user data.
await db.delete(mathLessons);

for (const meta of MATH_LESSONS) {
  const stack: StackArrangement = {
    bpm: meta.bpm,
    steps: standardSteps(meta.slug),
    kitOverride: null,
  };

  const row = {
    slug: meta.slug,
    grade: meta.grade,
    lessonNumber: meta.lessonNumber,
    title: meta.title,
    mathSkill: meta.mathSkill,
    teaches: meta.teaches,
    challenges: meta.challenges,
    slotA: null,
    slotB: null,
    slotC: null,
    slotD: null,
    stack,
  };

  await db
    .insert(mathLessons)
    .values(row)
    .onConflictDoUpdate({ target: mathLessons.slug, set: row });

  console.log(`Seeded /math/${meta.slug} (Grade ${meta.grade} Lesson ${meta.lessonNumber}: "${meta.title}")`);
}

console.log(`Done — seeded ${MATH_LESSONS.length} RockBlocks Math lessons.`);
