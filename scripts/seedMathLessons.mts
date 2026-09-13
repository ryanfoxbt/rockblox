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
// slot still opens with no hits placed anywhere, but its starter lines are
// built (via starterSlotForChallenge) to cover whatever instruments that
// slot's own challenge targets, on top of the Editor's normal three-piece
// starter — so a challenge reaching for a tom or a cymbal doesn't leave the
// student stuck adding drum pieces before they can start.
import { getDb } from "../src/db";
import { mathLessons } from "../src/db/schema";
import { MATH_LESSONS, standardMathStack, starterSlotForChallenge } from "../src/lib/mathSchool";

const db = getDb();

// Earlier passes used entirely different slugs and column shapes — rather
// than leave stale rows behind, clear the table before reseeding. Safe:
// this is this project's own recently-added, not-yet-launched content, not
// user data.
await db.delete(mathLessons);

for (const meta of MATH_LESSONS) {
  const stack = standardMathStack(meta.slug, meta.bpm);

  const row = {
    slug: meta.slug,
    grade: meta.grade,
    lessonNumber: meta.lessonNumber,
    title: meta.title,
    mathSkill: meta.mathSkill,
    teaches: meta.teaches,
    challenges: meta.challenges,
    slotA: starterSlotForChallenge(meta.bpm, meta.challenges.A),
    slotB: starterSlotForChallenge(meta.bpm, meta.challenges.B),
    slotC: starterSlotForChallenge(meta.bpm, meta.challenges.C),
    slotD: starterSlotForChallenge(meta.bpm, meta.challenges.D),
    stack,
  };

  await db
    .insert(mathLessons)
    .values(row)
    .onConflictDoUpdate({ target: mathLessons.slug, set: row });

  console.log(`Seeded /math/${meta.slug} (Grade ${meta.grade} Lesson ${meta.lessonNumber}: "${meta.title}")`);
}

console.log(`Done — seeded ${MATH_LESSONS.length} RockBlocks Math lessons.`);
