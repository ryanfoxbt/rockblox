import type { InstrumentId } from "@/lib/instruments";
import type { BoardSlotData, SlotLetter } from "@/lib/board";
import { DEFAULT_LINE_INSTRUMENTS, MAX_BEATS } from "@/lib/song";
import type { StackArrangement, StackStep } from "@/lib/stack";

// The curated /math library's index — metadata only (the actual beat data
// lives in the `math_lessons` table, seeded by scripts/seedMathLessons.mts).
// Kept as a plain array in code, not a query, so /math's list pages can
// render in order without a round trip. Mirrors drumSchool.ts, but each
// lesson pairs a grade-aligned math concept (`mathSkill`) with a drum
// pattern built to correlate with it, and lessons are scoped by `grade`
// instead of one flat curriculum.
//
// Second curriculum pass: every grade's 24 lessons are now anchored on a
// real Oregon Department of Education 2021 Math Standards question
// progression (researched fall-through-spring per grade, not just a
// Common-Core-domain weighting guess), replacing the first pass's
// Grade 1/2 content. Kindergarten is new. Slot A on every lesson is that
// grade's actual anchor question for that point in the year; slots B-D vary
// the numbers (and sometimes the instrument) on the same skill, the same
// convention the first pass established. Difficulty still climbs lesson to
// lesson, matching the researched fall -> winter -> early spring -> mid
// spring -> late spring progression. Kindergarten and Grade 1 lean on
// kick/snare/hihat, since one instrument per idea is the right amount of
// complexity for a five- or six-year-old; Grade 2 reaches further into the
// kit (toms, cymbals, rimshot) specifically where a problem has more than
// one real quantity in it — hundreds/tens/ones, an array's rows and total,
// a bar graph's categories — never as variety for its own sake.
export interface MathLesson {
  slug: string;
  grade: number;
  lessonNumber: number;
  title: string;
  mathSkill: string;
  teaches: string;
  // Suggested Stack tempo only now — every slot opens blank, so there's no
  // per-slot "demo bpm" anymore (see challenges below).
  bpm: number;
  // One real, checkable question per slot — all four slots are the
  // student's own answer canvases (no pre-built demo pattern anywhere
  // anymore), with B/C/D varying the numbers and instrument on the same
  // idea A introduces. See src/components/MathLessonWorkspace.tsx for the
  // client-side grading.
  challenges: Record<SlotLetter, MathChallenge>;
}

// One instrument (or, when an answer is too big for one 8-block row, a
// small set of instruments whose quarter notes are summed together) a
// slot's answer has to reach a specific count on — graded by counting
// actual placed quarter notes, not beat blocks. `instrument` as an array
// means "however you split this total across these rows is fine," not
// "build this many on each" — see countTargetHits in
// MathLessonWorkspace.tsx. `comparison` defaults to "eq"; "gt"/"lt" cover
// the handful of lessons that are fundamentally about which of two numbers
// is bigger rather than an exact total. (A count of 0 never satisfies any
// comparison, "lt" included — see targetMet in MathLessonWorkspace.tsx —
// so an untouched row can never pass by accident.)
//
// `blocksUsed`, when set, additionally requires the count to come from
// exactly this many non-empty blocks (rather than however many the student
// happens to use) — see countTargetBlocksUsed in MathLessonWorkspace.tsx.
// This is what turns a multiplication or division fact into rhythm
// directly: a block IS a group, and a beat block can itself hold more than
// one note (an eighth pair, a triplet run — see rhythm.ts's tile catalog,
// capped at 6 notes in one block), so "N blocks totaling M notes" is
// literally "N groups worth M altogether" — 6 × 2 = 12 becomes 6 blocks
// that add up to 12 notes, not necessarily 2 in each (the student is free
// to subdivide unevenly across those 6 blocks and still be right, same as
// the "any instrument" freedom below — the structure being taught is
// blocks-as-groups, not a rigid per-block count).
export interface BeatChallengeTarget {
  instrument: InstrumentId | InstrumentId[];
  count: number;
  comparison?: "eq" | "gt" | "lt";
  blocksUsed?: number;
}

// The three-piece kit every slot already opens with (see
// DEFAULT_LINE_INSTRUMENTS in song.ts) — used as a target's instrument list
// for "build a drum beat" questions (Grade 2 and up), where the point is
// letting the student choose where in the kit, and where in the row, an
// answer's hits land, rather than pinning them to one prescribed row.
// Grading (see isAnyKitPieceTarget in MathLessonWorkspace.tsx) treats a
// target whose instrument list matches this one by value as "anywhere in
// the kit, literally" — it counts every line the student built, not just
// these three — so reaching for a 4th, less common piece via "+ Add drum
// piece" in the Editor counts toward the total too, matching what every one
// of these prompts already promises ("build a drum beat," "anywhere in the
// kit"). A target naming its own specific instrument(s) instead (not this
// constant) still counts only those named rows — see BeatChallengeTarget.
export const ANY_KIT_PIECE: InstrumentId[] = ["kick", "snare", "hihatClosed"];

// A real, checkable question the student answers inside the real RockBlocks
// Editor itself, in that slot's beat blocks — with every normal feature
// available (drag-and-drop tiles, kit, tempo, sheet music, drummer view,
// save a copy), not by typing a number or picking from a list.
export interface MathChallenge {
  prompt: string;
  targets: BeatChallengeTarget[];
  explanation: string;
}

export interface MathGrade {
  grade: number;
  label: string;
}

// Kindergarten through Grade 9 exist today — index/list pages derive their
// grade sections from this, not a hardcoded grade string. Kindergarten is
// grade 0 (so it sorts first via asc(grade) everywhere) but is never shown
// as "Grade 0" — see gradeLabel below, which every page uses instead of
// interpolating `Grade ${grade}` directly.
export const MATH_GRADES: MathGrade[] = [
  { grade: 0, label: "Kindergarten" },
  { grade: 1, label: "Grade 1" },
  { grade: 2, label: "Grade 2" },
  { grade: 3, label: "Grade 3" },
  { grade: 4, label: "Grade 4" },
  { grade: 5, label: "Grade 5" },
  { grade: 6, label: "Grade 6" },
  { grade: 7, label: "Grade 7" },
  { grade: 8, label: "Grade 8" },
  { grade: 9, label: "Grade 9" },
];

// The human-facing name for a grade level — "Kindergarten" for grade 0,
// "Grade N" for everything else. Every page that used to interpolate
// `Grade ${grade}` directly now calls this instead, so Kindergarten reads
// correctly everywhere (titles, breadcrumbs, JSON-LD) without each call
// site special-casing grade 0 on its own.
export function gradeLabel(grade: number): string {
  return MATH_GRADES.find((g) => g.grade === grade)?.label ?? `Grade ${grade}`;
}

export const MATH_LESSONS: MathLesson[] = [
  // ============================================================
  // KINDERGARTEN — built from scratch around Oregon's actual K progression:
  // counting & number recognition to 10 (fall), counting to 20 and first
  // addition/subtraction (winter), addition/subtraction within 5 and
  // decomposing numbers (early spring), addition/subtraction within 10
  // (mid spring), teen numbers and shapes (late spring). Every lesson uses
  // just one or two instruments — kick, snare, and hi-hat closed almost
  // exclusively — since one clear instrument per idea is the right amount
  // of complexity at this age; two instruments show up only where the
  // skill itself is a comparison or a split (which group has more, ways to
  // make a number, tens vs. ones, counting a shape's sides).
  // ============================================================
  {
    slug: "math-g0-l01-counting-objects",
    grade: 0,
    lessonNumber: 1,
    title: "Counting Objects",
    mathSkill: "Counting Objects (K.CC.B.4)",
    teaches: "Every slot shows a group of pictures — count them one at a time and build that many quarter notes, one quarter note per thing you counted.",
    bpm: 70,
    challenges: {
      A: {
        prompt: "Count the apples: 🍎🍎🍎. Build a bass drum row with that many quarter notes.",
        targets: [{ instrument: "kick", count: 3 }],
        explanation: "1, 2, 3 — 3 apples means 3 quarter notes, one for each apple.",
      },
      B: {
        prompt: "Count the stars: ⭐⭐⭐⭐. Build a bass drum row with that many quarter notes.",
        targets: [{ instrument: "kick", count: 4 }],
        explanation: "1, 2, 3, 4 — 4 stars means 4 quarter notes.",
      },
      C: {
        prompt: "Count the drums: 🥁🥁. Build a bass drum row with that many quarter notes.",
        targets: [{ instrument: "kick", count: 2 }],
        explanation: "1, 2 — 2 drums means 2 quarter notes.",
      },
      D: {
        prompt: "Count the musical notes: 🎵🎵🎵🎵🎵. Build a bass drum row with that many quarter notes.",
        targets: [{ instrument: "kick", count: 5 }],
        explanation: "1, 2, 3, 4, 5 — 5 notes means 5 quarter notes.",
      },
    },
  },
  {
    slug: "math-g0-l02-what-comes-next",
    grade: 0,
    lessonNumber: 2,
    title: "What Comes Next?",
    mathSkill: "Counting Sequence (K.CC.A.2)",
    teaches: "Every slot asks what number comes right after another — say the counting sequence in your head and build that many quarter notes.",
    bpm: 70,
    challenges: {
      A: {
        prompt: "What number comes right after 4? Build a bass drum row with that many quarter notes.",
        targets: [{ instrument: "kick", count: 5 }],
        explanation: "4, 5 — 5 comes right after 4.",
      },
      B: {
        prompt: "What number comes right after 6? Build a snare drum row with that many quarter notes.",
        targets: [{ instrument: "snare", count: 7 }],
        explanation: "6, 7 — 7 comes right after 6.",
      },
      C: {
        prompt: "What number comes right after 2? Build a hi-hat row with that many quarter notes.",
        targets: [{ instrument: "hihatClosed", count: 3 }],
        explanation: "2, 3 — 3 comes right after 2.",
      },
      D: {
        prompt: "What number comes right after 7? Build a bass drum row with that many quarter notes.",
        targets: [{ instrument: "kick", count: 8 }],
        explanation: "7, 8 — 8 comes right after 7.",
      },
    },
  },
  {
    slug: "math-g0-l03-which-number-is-bigger",
    grade: 0,
    lessonNumber: 3,
    title: "Which Number Is Bigger?",
    mathSkill: "Comparing Numbers (K.CC.C.6)",
    teaches: "Every slot gives you two numbers — figure out which one is bigger, then build only that many quarter notes.",
    bpm: 70,
    challenges: {
      A: {
        prompt: "Which is bigger: 3 or 7? Build a snare drum row with the BIGGER number of quarter notes.",
        targets: [{ instrument: "snare", count: 7 }],
        explanation: "7 is bigger than 3, so you build 7 quarter notes.",
      },
      B: {
        prompt: "Which is bigger: 5 or 2? Build a hi-hat row with the BIGGER number of quarter notes.",
        targets: [{ instrument: "hihatClosed", count: 5 }],
        explanation: "5 is bigger than 2, so you build 5 quarter notes.",
      },
      C: {
        prompt: "Which is bigger: 4 or 8? Build a bass drum row with the BIGGER number of quarter notes.",
        targets: [{ instrument: "kick", count: 8 }],
        explanation: "8 is bigger than 4, so you build 8 quarter notes.",
      },
      D: {
        prompt: "Which is bigger: 6 or 1? Build a snare drum row with the BIGGER number of quarter notes.",
        targets: [{ instrument: "snare", count: 6 }],
        explanation: "6 is bigger than 1, so you build 6 quarter notes.",
      },
    },
  },
  {
    slug: "math-g0-l04-missing-numbers-in-a-row",
    grade: 0,
    lessonNumber: 4,
    title: "Missing Numbers in a Row",
    mathSkill: "Counting Sequence to 10 (K.CC.A.1)",
    teaches: "Every slot is a counting sequence with one number missing — figure out what belongs there and build that many quarter notes.",
    bpm: 70,
    challenges: {
      A: {
        prompt: "Count in order: 1, 2, 3, __, 5. What number is missing? Build a hi-hat row with that many quarter notes.",
        targets: [{ instrument: "hihatClosed", count: 4 }],
        explanation: "1, 2, 3, 4, 5 — the missing number is 4.",
      },
      B: {
        prompt: "Count in order: 4, 5, __, 7, 8. What number is missing? Build a bass drum row with that many quarter notes.",
        targets: [{ instrument: "kick", count: 6 }],
        explanation: "4, 5, 6, 7, 8 — the missing number is 6.",
      },
      C: {
        prompt: "Count in order: 6, 7, __, 9, 10. What number is missing? Build a snare drum row with that many quarter notes.",
        targets: [{ instrument: "snare", count: 8 }],
        explanation: "6, 7, 8, 9, 10 — the missing number is 8.",
      },
      D: {
        prompt: "Count in order: 2, __, 4, 5, 6. What number is missing? Build a hi-hat row with that many quarter notes.",
        targets: [{ instrument: "hihatClosed", count: 3 }],
        explanation: "2, 3, 4, 5, 6 — the missing number is 3.",
      },
    },
  },
  {
    slug: "math-g0-l05-counting-bigger-groups",
    grade: 0,
    lessonNumber: 5,
    title: "Counting Bigger Groups",
    mathSkill: "Counting Objects to 10 (K.CC.B.5)",
    teaches: "Every slot shows a bigger group than Lesson 1 did — the same one-at-a-time counting, just more of them.",
    bpm: 70,
    challenges: {
      A: {
        prompt: "Count the stars: ⭐⭐⭐⭐⭐⭐. Build a bass drum row with that many quarter notes.",
        targets: [{ instrument: "kick", count: 6 }],
        explanation: "Counting one at a time: 1, 2, 3, 4, 5, 6 — 6 stars.",
      },
      B: {
        prompt: "Count the moons: 🌙🌙🌙🌙🌙🌙🌙. Build a snare drum row with that many quarter notes.",
        targets: [{ instrument: "snare", count: 7 }],
        explanation: "1, 2, 3, 4, 5, 6, 7 — 7 moons.",
      },
      C: {
        prompt: "Count the suns: ☀️☀️☀️☀️☀️☀️☀️☀️. Build a hi-hat row with that many quarter notes.",
        targets: [{ instrument: "hihatClosed", count: 8 }],
        explanation: "1, 2, 3, 4, 5, 6, 7, 8 — 8 suns.",
      },
      D: {
        prompt: "Count the hearts: ❤️❤️❤️❤️❤️. Build a bass drum row with that many quarter notes.",
        targets: [{ instrument: "kick", count: 5 }],
        explanation: "1, 2, 3, 4, 5 — 5 hearts.",
      },
    },
  },
  {
    slug: "math-g0-l06-what-comes-before",
    grade: 0,
    lessonNumber: 6,
    title: "What Comes Before?",
    mathSkill: "Counting Sequence (K.CC.A.2)",
    teaches: "Every slot asks what number comes right before another — the counting sequence works backward here, not forward.",
    bpm: 70,
    challenges: {
      A: {
        prompt:
          "What number comes right before 10? Build a drum beat with that many quarter notes in all — spread them across the bass and snare rows.",
        targets: [{ instrument: ["kick", "snare"], count: 9 }],
        explanation: "8, 9, 10 — 9 comes right before 10.",
      },
      B: {
        prompt: "What number comes right before 6? Build a snare drum row with that many quarter notes.",
        targets: [{ instrument: "snare", count: 5 }],
        explanation: "4, 5, 6 — 5 comes right before 6.",
      },
      C: {
        prompt: "What number comes right before 8? Build a hi-hat row with that many quarter notes.",
        targets: [{ instrument: "hihatClosed", count: 7 }],
        explanation: "6, 7, 8 — 7 comes right before 8.",
      },
      D: {
        prompt: "What number comes right before 4? Build a bass drum row with that many quarter notes.",
        targets: [{ instrument: "kick", count: 3 }],
        explanation: "2, 3, 4 — 3 comes right before 4.",
      },
    },
  },
  {
    slug: "math-g0-l07-counting-backward",
    grade: 0,
    lessonNumber: 7,
    title: "Counting Backward",
    mathSkill: "Counting Backward (K.CC.A.2)",
    teaches: "Every slot has you count backward a few steps from a starting number — land on the right number and build that many quarter notes.",
    bpm: 72,
    challenges: {
      A: {
        prompt: "Count backward from 5: 5, 4, 3. What number do you land on after 2 backward steps? Build a snare drum row with that many quarter notes.",
        targets: [{ instrument: "snare", count: 3 }],
        explanation: "5, 4, 3 — two steps back from 5 lands on 3.",
      },
      B: {
        prompt: "Count backward from 7: 7, 6, 5, 4. What number do you land on after 3 backward steps? Build a hi-hat row with that many quarter notes.",
        targets: [{ instrument: "hihatClosed", count: 4 }],
        explanation: "7, 6, 5, 4 — three steps back from 7 lands on 4.",
      },
      C: {
        prompt: "Count backward from 10: 10, 9, 8. What number do you land on after 2 backward steps? Build a bass drum row with that many quarter notes.",
        targets: [{ instrument: "kick", count: 8 }],
        explanation: "10, 9, 8 — two steps back from 10 lands on 8.",
      },
      D: {
        prompt: "Count backward from 6: 6, 5, 4, 3. What number do you land on after 3 backward steps? Build a snare drum row with that many quarter notes.",
        targets: [{ instrument: "snare", count: 3 }],
        explanation: "6, 5, 4, 3 — three steps back from 6 lands on 3.",
      },
    },
  },
  {
    slug: "math-g0-l08-which-group-has-more",
    grade: 0,
    lessonNumber: 8,
    title: "Which Group Has More?",
    mathSkill: "Comparing Groups (K.CC.C.6)",
    teaches: "Every slot gives you two groups to build, on two different instruments — build both, then notice which row has more quarter notes.",
    bpm: 72,
    challenges: {
      A: {
        prompt: "Build a bass drum row with 4 quarter notes and a snare drum row with 2 quarter notes. Which row has more?",
        targets: [
          { instrument: "kick", count: 4 },
          { instrument: "snare", count: 2 },
        ],
        explanation: "4 is more than 2 — the bass drum row has more quarter notes.",
      },
      B: {
        prompt: "Build a snare drum row with 3 quarter notes and a bass drum row with 5 quarter notes. Which row has more?",
        targets: [
          { instrument: "snare", count: 3 },
          { instrument: "kick", count: 5 },
        ],
        explanation: "5 is more than 3 — the bass drum row has more quarter notes.",
      },
      C: {
        prompt: "Build a hi-hat row with 6 quarter notes and a bass drum row with 4 quarter notes. Which row has more?",
        targets: [
          { instrument: "hihatClosed", count: 6 },
          { instrument: "kick", count: 4 },
        ],
        explanation: "6 is more than 4 — the hi-hat row has more quarter notes.",
      },
      D: {
        prompt: "Build a snare drum row with 7 quarter notes and a hi-hat row with 2 quarter notes. Which row has more?",
        targets: [
          { instrument: "snare", count: 7 },
          { instrument: "hihatClosed", count: 2 },
        ],
        explanation: "7 is more than 2 — the snare drum row has more quarter notes.",
      },
    },
  },
  {
    slug: "math-g0-l09-adding-one-more",
    grade: 0,
    lessonNumber: 9,
    title: "Adding One More",
    mathSkill: "Addition Word Problems (K.OA.A.2)",
    teaches: "Every slot is a tiny word problem — you start with some, get a few more, and build the new total.",
    bpm: 72,
    challenges: {
      A: {
        prompt: "You have 2 crayons. A friend gives you 1 more. How many crayons do you have now? Build a hi-hat row with that many quarter notes.",
        targets: [{ instrument: "hihatClosed", count: 3 }],
        explanation: "2 and 1 more makes 3.",
      },
      B: {
        prompt: "You have 3 stickers. A friend gives you 2 more. How many stickers do you have now? Build a bass drum row with that many quarter notes.",
        targets: [{ instrument: "kick", count: 5 }],
        explanation: "3 and 2 more makes 5.",
      },
      C: {
        prompt: "You have 4 blocks. A friend gives you 1 more. How many blocks do you have now? Build a snare drum row with that many quarter notes.",
        targets: [{ instrument: "snare", count: 5 }],
        explanation: "4 and 1 more makes 5.",
      },
      D: {
        prompt: "You have 1 marble. A friend gives you 3 more. How many marbles do you have now? Build a hi-hat row with that many quarter notes.",
        targets: [{ instrument: "hihatClosed", count: 4 }],
        explanation: "1 and 3 more makes 4.",
      },
    },
  },
  {
    slug: "math-g0-l10-take-away-how-many-are-left",
    grade: 0,
    lessonNumber: 10,
    title: "Take Away: How Many Are Left?",
    mathSkill: "Subtraction Word Problems (K.OA.A.2)",
    teaches: "Every slot starts with a group and takes some away — build only what's left.",
    bpm: 72,
    challenges: {
      A: {
        prompt: "There are 5 ducks in a pond. 2 swim away. How many ducks are left? Build a bass drum row with that many quarter notes.",
        targets: [{ instrument: "kick", count: 3 }],
        explanation: "5 take away 2 leaves 3.",
      },
      B: {
        prompt: "There are 6 birds in a tree. 1 flies away. How many birds are left? Build a snare drum row with that many quarter notes.",
        targets: [{ instrument: "snare", count: 5 }],
        explanation: "6 take away 1 leaves 5.",
      },
      C: {
        prompt: "There are 8 fish in a tank. 3 swim away. How many fish are left? Build a hi-hat row with that many quarter notes.",
        targets: [{ instrument: "hihatClosed", count: 5 }],
        explanation: "8 take away 3 leaves 5.",
      },
      D: {
        prompt: "There are 4 frogs on a log. 2 hop away. How many frogs are left? Build a bass drum row with that many quarter notes.",
        targets: [{ instrument: "kick", count: 2 }],
        explanation: "4 take away 2 leaves 2.",
      },
    },
  },
  {
    slug: "math-g0-l11-adding-within-5",
    grade: 0,
    lessonNumber: 11,
    title: "Adding Within 5",
    mathSkill: "Fluently Add Within 5 (K.OA.A.5)",
    teaches: "Every slot is a quick addition fact that adds up to 5 or less — build the total in one row.",
    bpm: 74,
    challenges: {
      A: {
        prompt: "2 + 2 = ? Build a snare drum row with the total number of quarter notes.",
        targets: [{ instrument: "snare", count: 4 }],
        explanation: "2 + 2 = 4.",
      },
      B: {
        prompt: "1 + 3 = ? Build a hi-hat row with the total number of quarter notes.",
        targets: [{ instrument: "hihatClosed", count: 4 }],
        explanation: "1 + 3 = 4.",
      },
      C: {
        prompt: "3 + 2 = ? Build a bass drum row with the total number of quarter notes.",
        targets: [{ instrument: "kick", count: 5 }],
        explanation: "3 + 2 = 5.",
      },
      D: {
        prompt: "0 + 4 = ? Build a snare drum row with the total number of quarter notes.",
        targets: [{ instrument: "snare", count: 4 }],
        explanation: "0 + 4 = 4 — adding 0 changes nothing.",
      },
    },
  },
  {
    slug: "math-g0-l12-subtracting-within-5",
    grade: 0,
    lessonNumber: 12,
    title: "Subtracting Within 5",
    mathSkill: "Fluently Subtract Within 5 (K.OA.A.5)",
    teaches: "Every slot is a quick subtraction fact starting at 5 or less — build what's left in one row.",
    bpm: 74,
    challenges: {
      A: {
        prompt: "4 - 1 = ? Build a hi-hat row with what's left, in quarter notes.",
        targets: [{ instrument: "hihatClosed", count: 3 }],
        explanation: "4 - 1 = 3.",
      },
      B: {
        prompt: "5 - 2 = ? Build a bass drum row with what's left, in quarter notes.",
        targets: [{ instrument: "kick", count: 3 }],
        explanation: "5 - 2 = 3.",
      },
      C: {
        prompt: "3 - 1 = ? Build a snare drum row with what's left, in quarter notes.",
        targets: [{ instrument: "snare", count: 2 }],
        explanation: "3 - 1 = 2.",
      },
      D: {
        prompt: "5 - 4 = ? Build a hi-hat row with what's left, in quarter notes.",
        targets: [{ instrument: "hihatClosed", count: 1 }],
        explanation: "5 - 4 = 1.",
      },
    },
  },
  {
    slug: "math-g0-l13-addition-word-problems-within-5",
    grade: 0,
    lessonNumber: 13,
    title: "Addition Word Problems Within 5",
    mathSkill: "Addition Word Problems (K.OA.A.2)",
    teaches: "Every slot is the same idea as Lesson 11's facts, but wrapped in a tiny story — a drummer plays some quarter notes, then a few more join in.",
    bpm: 74,
    challenges: {
      A: {
        prompt: "A drummer plays 3 quarter notes, then 1 more. How many quarter notes in all? Build a bass drum row with that many quarter notes.",
        targets: [{ instrument: "kick", count: 4 }],
        explanation: "3 + 1 = 4.",
      },
      B: {
        prompt: "A drummer plays 2 quarter notes, then 2 more. How many quarter notes in all? Build a snare drum row with that many quarter notes.",
        targets: [{ instrument: "snare", count: 4 }],
        explanation: "2 + 2 = 4.",
      },
      C: {
        prompt: "A drummer plays 1 quarter note, then 4 more. How many quarter notes in all? Build a hi-hat row with that many quarter notes.",
        targets: [{ instrument: "hihatClosed", count: 5 }],
        explanation: "1 + 4 = 5.",
      },
      D: {
        prompt: "A drummer plays 4 quarter notes, then 1 more. How many quarter notes in all? Build a bass drum row with that many quarter notes.",
        targets: [{ instrument: "kick", count: 5 }],
        explanation: "4 + 1 = 5.",
      },
    },
  },
  {
    slug: "math-g0-l14-ways-to-make-5",
    grade: 0,
    lessonNumber: 14,
    title: "Ways to Make 5",
    mathSkill: "Decomposing Numbers (K.OA.A.3)",
    teaches: "Every slot gives you a number and asks for one way to split it into two parts — build both parts, on two different instruments.",
    bpm: 74,
    challenges: {
      A: {
        prompt: "Show one way to make 5: build a bass drum row with 4 quarter notes and a snare drum row with 1 quarter note.",
        targets: [
          { instrument: "kick", count: 4 },
          { instrument: "snare", count: 1 },
        ],
        explanation: "4 and 1 make 5 (4+1=5) — one way to break 5 into two parts.",
      },
      B: {
        prompt: "Show a different way to make 5: build a bass drum row with 3 quarter notes and a snare drum row with 2 quarter notes.",
        targets: [
          { instrument: "kick", count: 3 },
          { instrument: "snare", count: 2 },
        ],
        explanation: "3 and 2 also make 5 (3+2=5) — there's more than one way.",
      },
      C: {
        prompt: "Show one way to make 6: build a hi-hat row with 5 quarter notes and a bass drum row with 1 quarter note.",
        targets: [
          { instrument: "hihatClosed", count: 5 },
          { instrument: "kick", count: 1 },
        ],
        explanation: "5 and 1 make 6 (5+1=6).",
      },
      D: {
        prompt: "Show a different way to make 6: build a hi-hat row with 4 quarter notes and a bass drum row with 2 quarter notes.",
        targets: [
          { instrument: "hihatClosed", count: 4 },
          { instrument: "kick", count: 2 },
        ],
        explanation: "4 and 2 also make 6 (4+2=6).",
      },
    },
  },
  {
    slug: "math-g0-l15-subtraction-word-problems-within-5",
    grade: 0,
    lessonNumber: 15,
    title: "Subtraction Word Problems Within 5",
    mathSkill: "Subtraction Word Problems (K.OA.A.2)",
    teaches: "Every slot is the same idea as Lesson 12's facts, wrapped in a tiny story — some quarter notes play, then a few of them stop.",
    bpm: 74,
    challenges: {
      A: {
        prompt: "A drummer plays 5 quarter notes, then stops 3 of them. How many quarter notes are left? Build a snare drum row with what's left, in quarter notes.",
        targets: [{ instrument: "snare", count: 2 }],
        explanation: "5 - 3 = 2.",
      },
      B: {
        prompt: "A drummer plays 4 quarter notes, then stops 2 of them. How many quarter notes are left? Build a hi-hat row with what's left, in quarter notes.",
        targets: [{ instrument: "hihatClosed", count: 2 }],
        explanation: "4 - 2 = 2.",
      },
      C: {
        prompt: "A drummer plays 5 quarter notes, then stops 1 of them. How many quarter notes are left? Build a bass drum row with what's left, in quarter notes.",
        targets: [{ instrument: "kick", count: 4 }],
        explanation: "5 - 1 = 4.",
      },
      D: {
        prompt: "A drummer plays 3 quarter notes, then stops 2 of them. How many quarter notes are left? Build a snare drum row with what's left, in quarter notes.",
        targets: [{ instrument: "snare", count: 1 }],
        explanation: "3 - 2 = 1.",
      },
    },
  },
  {
    slug: "math-g0-l16-adding-within-10",
    grade: 0,
    lessonNumber: 16,
    title: "Adding Within 10",
    mathSkill: "Addition Within 10 (K.OA.A.2)",
    teaches: "Every slot is an addition fact bigger than Lesson 11's — the numbers are bigger, but adding them works the same way.",
    bpm: 76,
    challenges: {
      A: {
        prompt:
          "6 + 3 = ? Build a drum beat with the total number of quarter notes. Tip: you can spread them across the bass and snare rows.",
        targets: [{ instrument: ["kick", "snare"], count: 9 }],
        explanation: "6 + 3 = 9.",
      },
      B: {
        prompt: "4 + 4 = ? Build a snare drum row with the total number of quarter notes.",
        targets: [{ instrument: "snare", count: 8 }],
        explanation: "4 + 4 = 8.",
      },
      C: {
        prompt: "5 + 3 = ? Build a hi-hat row with the total number of quarter notes.",
        targets: [{ instrument: "hihatClosed", count: 8 }],
        explanation: "5 + 3 = 8.",
      },
      D: {
        prompt:
          "7 + 2 = ? Build a drum beat with the total number of quarter notes. Tip: you can spread them across the bass and snare rows.",
        targets: [{ instrument: ["kick", "snare"], count: 9 }],
        explanation: "7 + 2 = 9.",
      },
    },
  },
  {
    slug: "math-g0-l17-subtracting-within-10",
    grade: 0,
    lessonNumber: 17,
    title: "Subtracting Within 10",
    mathSkill: "Subtraction Within 10 (K.OA.A.2)",
    teaches: "Every slot is a subtraction fact starting bigger than Lesson 12's — build what's left in one row.",
    bpm: 76,
    challenges: {
      A: {
        prompt: "8 - 5 = ? Build a hi-hat row with what's left, in quarter notes.",
        targets: [{ instrument: "hihatClosed", count: 3 }],
        explanation: "8 - 5 = 3.",
      },
      B: {
        prompt: "9 - 4 = ? Build a bass drum row with what's left, in quarter notes.",
        targets: [{ instrument: "kick", count: 5 }],
        explanation: "9 - 4 = 5.",
      },
      C: {
        prompt: "7 - 3 = ? Build a snare drum row with what's left, in quarter notes.",
        targets: [{ instrument: "snare", count: 4 }],
        explanation: "7 - 3 = 4.",
      },
      D: {
        prompt: "10 - 6 = ? Build a hi-hat row with what's left, in quarter notes.",
        targets: [{ instrument: "hihatClosed", count: 4 }],
        explanation: "10 - 6 = 4.",
      },
    },
  },
  {
    slug: "math-g0-l18-subtraction-word-problems-within-10",
    grade: 0,
    lessonNumber: 18,
    title: "Subtraction Word Problems Within 10",
    mathSkill: "Subtraction Word Problems (K.OA.A.2)",
    teaches: "Every slot is a bigger take-away story than Lesson 10's — build only what's left.",
    bpm: 76,
    challenges: {
      A: {
        prompt: "There are 7 bees buzzing around a flower. 3 fly away. How many bees are left? Build a bass drum row with that many quarter notes.",
        targets: [{ instrument: "kick", count: 4 }],
        explanation: "7 - 3 = 4.",
      },
      B: {
        prompt: "There are 9 ants on a log. 4 crawl away. How many ants are left? Build a snare drum row with that many quarter notes.",
        targets: [{ instrument: "snare", count: 5 }],
        explanation: "9 - 4 = 5.",
      },
      C: {
        prompt: "There are 6 ladybugs on a leaf. 2 fly away. How many ladybugs are left? Build a hi-hat row with that many quarter notes.",
        targets: [{ instrument: "hihatClosed", count: 4 }],
        explanation: "6 - 2 = 4.",
      },
      D: {
        prompt: "There are 10 butterflies in a garden. 6 fly away. How many butterflies are left? Build a bass drum row with that many quarter notes.",
        targets: [{ instrument: "kick", count: 4 }],
        explanation: "10 - 6 = 4.",
      },
    },
  },
  {
    slug: "math-g0-l19-doubling-numbers",
    grade: 0,
    lessonNumber: 19,
    title: "Doubling Numbers",
    mathSkill: "Doubles Within 10 (K.OA.A.5)",
    teaches: "Every slot doubles a number — adds it to itself. Build the total in one row.",
    bpm: 76,
    challenges: {
      A: {
        prompt: "4 + 4 = ? Build a bass drum row with the total number of quarter notes.",
        targets: [{ instrument: "kick", count: 8 }],
        explanation: "4 + 4 = 8 — a double.",
      },
      B: {
        prompt: "3 + 3 = ? Build a snare drum row with the total number of quarter notes.",
        targets: [{ instrument: "snare", count: 6 }],
        explanation: "3 + 3 = 6 — a double.",
      },
      C: {
        prompt:
          "5 + 5 = ? Build a drum beat with the total number of quarter notes. Tip: you can spread them across the hi-hat and snare rows.",
        targets: [{ instrument: ["hihatClosed", "snare"], count: 10 }],
        explanation: "5 + 5 = 10 — a double.",
      },
      D: {
        prompt: "2 + 2 = ? Build a bass drum row with the total number of quarter notes.",
        targets: [{ instrument: "kick", count: 4 }],
        explanation: "2 + 2 = 4 — a double.",
      },
    },
  },
  {
    slug: "math-g0-l20-more-subtracting-within-10",
    grade: 0,
    lessonNumber: 20,
    title: "More Subtracting Within 10",
    mathSkill: "Subtraction Within 10 (K.OA.A.2)",
    teaches: "Every slot is one more round of subtraction within 10 — build what's left in one row.",
    bpm: 76,
    challenges: {
      A: {
        prompt: "9 - 6 = ? Build a snare drum row with what's left, in quarter notes.",
        targets: [{ instrument: "snare", count: 3 }],
        explanation: "9 - 6 = 3.",
      },
      B: {
        prompt: "8 - 3 = ? Build a hi-hat row with what's left, in quarter notes.",
        targets: [{ instrument: "hihatClosed", count: 5 }],
        explanation: "8 - 3 = 5.",
      },
      C: {
        prompt: "10 - 7 = ? Build a bass drum row with what's left, in quarter notes.",
        targets: [{ instrument: "kick", count: 3 }],
        explanation: "10 - 7 = 3.",
      },
      D: {
        prompt: "9 - 5 = ? Build a snare drum row with what's left, in quarter notes.",
        targets: [{ instrument: "snare", count: 4 }],
        explanation: "9 - 5 = 4.",
      },
    },
  },
  {
    slug: "math-g0-l21-making-teen-numbers",
    grade: 0,
    lessonNumber: 21,
    title: "Making Teen Numbers",
    mathSkill: "Composing Teen Numbers (K.NBT.A.1)",
    teaches: "Every slot adds a small number onto 10 — any number from 11 to 19 is a 'teen' number made from 10 plus some ones.",
    bpm: 78,
    challenges: {
      A: {
        prompt:
          "10 + 5 = ? It's a teen number — too big for one row! Build a drum beat with the total number of quarter notes, spread across the bass and snare rows.",
        targets: [{ instrument: ["kick", "snare"], count: 15 }],
        explanation: "10 + 5 = 15 — any number from 11 to 19 is a 'teen' number.",
      },
      B: {
        prompt:
          "10 + 3 = ? Build a drum beat with the total number of quarter notes, spread across the snare and bass rows.",
        targets: [{ instrument: ["snare", "kick"], count: 13 }],
        explanation: "10 + 3 = 13.",
      },
      C: {
        prompt:
          "10 + 6 = ? Build a drum beat with the total number of quarter notes, spread across the hi-hat and snare rows.",
        targets: [{ instrument: ["hihatClosed", "snare"], count: 16 }],
        explanation: "10 + 6 = 16.",
      },
      D: {
        prompt:
          "10 + 2 = ? Build a drum beat with the total number of quarter notes, spread across the bass and hi-hat rows.",
        targets: [{ instrument: ["kick", "hihatClosed"], count: 12 }],
        explanation: "10 + 2 = 12.",
      },
    },
  },
  {
    slug: "math-g0-l22-teen-numbers-tens-and-ones",
    grade: 0,
    lessonNumber: 22,
    title: "Teen Numbers: Tens and Ones",
    mathSkill: "Tens and Ones (K.NBT.A.1)",
    teaches: "Every slot gives you a teen number — build a bass drum row of quarter notes for its ten (always just 1 quarter note) and a hi-hat row of quarter notes for its ones.",
    bpm: 78,
    challenges: {
      A: {
        prompt: "14 is made of 1 ten and how many ones? Build a bass drum row of quarter notes for the ten and a hi-hat row of quarter notes for the ones.",
        targets: [
          { instrument: "kick", count: 1 },
          { instrument: "hihatClosed", count: 4 },
        ],
        explanation: "14 = 1 ten (10) + 4 ones — every teen number is 1 ten plus some ones.",
      },
      B: {
        prompt: "17 is made of 1 ten and how many ones? Build a bass drum row of quarter notes for the ten and a hi-hat row of quarter notes for the ones.",
        targets: [
          { instrument: "kick", count: 1 },
          { instrument: "hihatClosed", count: 7 },
        ],
        explanation: "17 = 1 ten + 7 ones.",
      },
      C: {
        prompt: "12 is made of 1 ten and how many ones? Build a bass drum row of quarter notes for the ten and a hi-hat row of quarter notes for the ones.",
        targets: [
          { instrument: "kick", count: 1 },
          { instrument: "hihatClosed", count: 2 },
        ],
        explanation: "12 = 1 ten + 2 ones.",
      },
      D: {
        prompt: "18 is made of 1 ten and how many ones? Build a bass drum row of quarter notes for the ten and a hi-hat row of quarter notes for the ones.",
        targets: [
          { instrument: "kick", count: 1 },
          { instrument: "hihatClosed", count: 8 },
        ],
        explanation: "18 = 1 ten + 8 ones.",
      },
    },
  },
  {
    slug: "math-g0-l23-counting-by-tens",
    grade: 0,
    lessonNumber: 23,
    title: "Counting by Tens",
    mathSkill: "Counting by Tens (K.CC.A.1)",
    teaches: "Every slot is a counting-by-10s sequence with one number missing — since the missing number itself is too big to build, build how many TENS it is instead.",
    bpm: 78,
    challenges: {
      A: {
        prompt: "Count by 10s: 10, 20, __, 40, 50. The missing number is how many tens? Build a hi-hat row with that many quarter notes.",
        targets: [{ instrument: "hihatClosed", count: 3 }],
        explanation: "10, 20, 30, 40, 50 — the missing number is 30, which is 3 tens.",
      },
      B: {
        prompt: "Count by 10s: 10, __, 30, 40. The missing number is how many tens? Build a bass drum row with that many quarter notes.",
        targets: [{ instrument: "kick", count: 2 }],
        explanation: "10, 20, 30, 40 — the missing number is 20, which is 2 tens.",
      },
      C: {
        prompt: "Count by 10s: 20, 30, 40, __, 60. The missing number is how many tens? Build a snare drum row with that many quarter notes.",
        targets: [{ instrument: "snare", count: 5 }],
        explanation: "20, 30, 40, 50, 60 — the missing number is 50, which is 5 tens.",
      },
      D: {
        prompt: "Count by 10s: __, 20, 30. The missing number is how many tens? Build a hi-hat row with that many quarter notes.",
        targets: [{ instrument: "hihatClosed", count: 1 }],
        explanation: "10, 20, 30 — the missing number is 10, which is 1 ten.",
      },
    },
  },
  {
    slug: "math-g0-l24-shapes-counting-sides",
    grade: 0,
    lessonNumber: 24,
    title: "Shapes: Counting Sides",
    mathSkill: "Comparing Shapes (K.G.A.2, K.G.B.4)",
    teaches: "Every slot names two shapes — count each one's sides (or corners) on its own instrument, then notice which shape has more.",
    bpm: 78,
    challenges: {
      A: {
        prompt: "A triangle has how many sides? Build a snare drum row with that many quarter notes. A square has how many sides? Build a bass drum row with that many quarter notes.",
        targets: [
          { instrument: "snare", count: 3 },
          { instrument: "kick", count: 4 },
        ],
        explanation: "A triangle has 3 sides; a square has 4 — the square has more.",
      },
      B: {
        prompt: "A pentagon has how many sides? Build a hi-hat row with that many quarter notes. A hexagon has how many sides? Build a bass drum row with that many quarter notes.",
        targets: [
          { instrument: "hihatClosed", count: 5 },
          { instrument: "kick", count: 6 },
        ],
        explanation: "A pentagon has 5 sides; a hexagon has 6 — the hexagon has more.",
      },
      C: {
        prompt: "A square has how many corners? Build a bass drum row with that many quarter notes. A triangle has how many corners? Build a snare drum row with that many quarter notes.",
        targets: [
          { instrument: "kick", count: 4 },
          { instrument: "snare", count: 3 },
        ],
        explanation: "A square has 4 corners; a triangle has 3 — the square has more corners too.",
      },
      D: {
        prompt: "A hexagon has how many sides? Build a hi-hat row with that many quarter notes. A triangle has how many sides? Build a snare drum row with that many quarter notes.",
        targets: [
          { instrument: "hihatClosed", count: 6 },
          { instrument: "snare", count: 3 },
        ],
        explanation: "A hexagon has 6 sides; a triangle has 3 — the hexagon has more.",
      },
    },
  },

  // ============================================================
  // GRADE 1 — anchored on Oregon's actual Grade 1 progression: counting
  // to 20/100 and addition/subtraction within 10 (fall), addition/
  // subtraction within 20 and fact families (winter), place value and
  // comparing two-digit numbers (early spring), adding two-digit numbers
  // and word problems (mid spring), time, measurement, and fractions of
  // shapes (late spring). Mostly kick/snare/hi-hat, with a tom-based
  // three-instrument lesson for comparing lengths, where three real
  // quantities (short/medium/long) are genuinely in play.
  // ============================================================
  {
    slug: "math-g1-l01-counting-sequence-to-20",
    grade: 1,
    lessonNumber: 1,
    title: "Counting Sequence to 20",
    mathSkill: "Counting Sequence (1.NBT.A.1)",
    teaches: "Every slot is a counting sequence up to 20 with one number missing — figure out what belongs and build that many quarter notes.",
    bpm: 78,
    challenges: {
      A: {
        prompt: "Count in order: 1, 2, 3, __, 5, 6. What number is missing? Build a bass drum row with that many quarter notes.",
        targets: [{ instrument: "kick", count: 4 }],
        explanation: "1, 2, 3, 4, 5, 6 — the missing number is 4.",
      },
      B: {
        prompt:
          "Count in order: 7, 8, __, 10, 11. What number is missing? Build a drum beat with that many quarter notes, spread across the snare and bass rows.",
        targets: [{ instrument: ["snare", "kick"], count: 9 }],
        explanation: "7, 8, 9, 10, 11 — the missing number is 9.",
      },
      C: {
        prompt:
          "Count in order: 10, 11, __, 13, 14. What number is missing? Build a drum beat with that many quarter notes, spread across the hi-hat and snare rows.",
        targets: [{ instrument: ["hihatClosed", "snare"], count: 12 }],
        explanation: "10, 11, 12, 13, 14 — the missing number is 12.",
      },
      D: {
        prompt:
          "Count in order: 13, __, 15, 16. What number is missing? Build a drum beat with that many quarter notes, spread across the bass and hi-hat rows.",
        targets: [{ instrument: ["kick", "hihatClosed"], count: 14 }],
        explanation: "13, 14, 15, 16 — the missing number is 14.",
      },
    },
  },
  {
    slug: "math-g1-l02-addition-facts-within-10",
    grade: 1,
    lessonNumber: 2,
    title: "Addition Facts Within 10",
    mathSkill: "Addition Facts (1.OA.C.6)",
    teaches: "Every slot is a quick addition fact within 10 — build the total in one row.",
    bpm: 78,
    challenges: {
      A: {
        prompt: "5 + 3 = ? Build a bass drum row with the total number of quarter notes.",
        targets: [{ instrument: "kick", count: 8 }],
        explanation: "5 + 3 = 8.",
      },
      B: {
        prompt: "4 + 3 = ? Build a snare drum row with the total number of quarter notes.",
        targets: [{ instrument: "snare", count: 7 }],
        explanation: "4 + 3 = 7.",
      },
      C: {
        prompt:
          "6 + 4 = ? Build a drum beat with the total number of quarter notes, spread across the hi-hat and bass rows.",
        targets: [{ instrument: ["hihatClosed", "kick"], count: 10 }],
        explanation: "6 + 4 = 10.",
      },
      D: {
        prompt: "3 + 3 = ? Build a bass drum row with the total number of quarter notes.",
        targets: [{ instrument: "kick", count: 6 }],
        explanation: "3 + 3 = 6.",
      },
    },
  },
  {
    slug: "math-g1-l03-the-number-after",
    grade: 1,
    lessonNumber: 3,
    title: "The Number After",
    mathSkill: "Counting Sequence to 120 (1.NBT.A.1)",
    teaches: "Every slot asks what comes right after a two-digit number — since the answer is too big for one row, build its tens and ones separately.",
    bpm: 78,
    challenges: {
      A: {
        prompt: "What number comes right after 45? Build a bass drum row of quarter notes for its tens and a hi-hat row of quarter notes for its ones.",
        targets: [
          { instrument: "kick", count: 4 },
          { instrument: "hihatClosed", count: 6 },
        ],
        explanation: "45, 46 — 46 is 4 tens and 6 ones.",
      },
      B: {
        prompt: "What number comes right after 57? Build a bass drum row of quarter notes for its tens and a hi-hat row of quarter notes for its ones.",
        targets: [
          { instrument: "kick", count: 5 },
          { instrument: "hihatClosed", count: 8 },
        ],
        explanation: "57, 58 — 58 is 5 tens and 8 ones.",
      },
      C: {
        prompt: "What number comes right after 52? Build a bass drum row of quarter notes for its tens and a hi-hat row of quarter notes for its ones.",
        targets: [
          { instrument: "kick", count: 5 },
          { instrument: "hihatClosed", count: 3 },
        ],
        explanation: "52, 53 — 53 is 5 tens and 3 ones.",
      },
      D: {
        prompt: "What number comes right after 77? Build a bass drum row of quarter notes for its tens and a hi-hat row of quarter notes for its ones.",
        targets: [
          { instrument: "kick", count: 7 },
          { instrument: "hihatClosed", count: 8 },
        ],
        explanation: "77, 78 — 78 is 7 tens and 8 ones.",
      },
    },
  },
  {
    slug: "math-g1-l04-subtraction-facts-within-10",
    grade: 1,
    lessonNumber: 4,
    title: "Subtraction Facts Within 10",
    mathSkill: "Subtraction Facts (1.OA.C.6)",
    teaches: "Every slot is a quick subtraction fact within 10 — build what's left in one row.",
    bpm: 78,
    challenges: {
      A: {
        prompt: "9 - 4 = ? Build a bass drum row with what's left, in quarter notes.",
        targets: [{ instrument: "kick", count: 5 }],
        explanation: "9 - 4 = 5.",
      },
      B: {
        prompt: "8 - 6 = ? Build a snare drum row with what's left, in quarter notes.",
        targets: [{ instrument: "snare", count: 2 }],
        explanation: "8 - 6 = 2.",
      },
      C: {
        prompt: "10 - 3 = ? Build a hi-hat row with what's left, in quarter notes.",
        targets: [{ instrument: "hihatClosed", count: 7 }],
        explanation: "10 - 3 = 7.",
      },
      D: {
        prompt: "7 - 5 = ? Build a bass drum row with what's left, in quarter notes.",
        targets: [{ instrument: "kick", count: 2 }],
        explanation: "7 - 5 = 2.",
      },
    },
  },
  {
    slug: "math-g1-l05-skip-counting-by-10s-to-100",
    grade: 1,
    lessonNumber: 5,
    title: "Skip Counting by 10s to 100",
    mathSkill: "Counting by Tens (1.NBT.A.1)",
    teaches: "Every slot is a counting-by-10s sequence with one number missing — build how many TENS that missing number is, not the number itself.",
    bpm: 78,
    challenges: {
      A: {
        prompt: "Count by 10s: 10, 20, 30, __, 50, 60, 70. The missing number is how many tens? Build a snare drum row with that many quarter notes.",
        targets: [{ instrument: "snare", count: 4 }],
        explanation: "10, 20, 30, 40, 50, 60, 70 — the missing number is 40, which is 4 tens.",
      },
      B: {
        prompt: "Count by 10s: 20, 30, __, 50, 60. The missing number is how many tens? Build a hi-hat row with that many quarter notes.",
        targets: [{ instrument: "hihatClosed", count: 4 }],
        explanation: "20, 30, 40, 50, 60 — the missing number is 40, which is 4 tens.",
      },
      C: {
        prompt: "Count by 10s: 50, 60, 70, __, 90, 100. The missing number is how many tens? Build a bass drum row with that many quarter notes.",
        targets: [{ instrument: "kick", count: 8 }],
        explanation: "50, 60, 70, 80, 90, 100 — the missing number is 80, which is 8 tens.",
      },
      D: {
        prompt: "Count by 10s: __, 20, 30, 40. The missing number is how many tens? Build a snare drum row with that many quarter notes.",
        targets: [{ instrument: "snare", count: 1 }],
        explanation: "10, 20, 30, 40 — the missing number is 10, which is 1 ten.",
      },
    },
  },
  {
    slug: "math-g1-l06-addition-within-20",
    grade: 1,
    lessonNumber: 6,
    title: "Addition Within 20",
    mathSkill: "Add Within 20 (1.OA.C.6)",
    teaches: "Every slot is an addition fact just over 10 — one good strategy is bridging through 10: split the second number so the first part rounds up to 10, then add what's left.",
    bpm: 80,
    challenges: {
      A: {
        prompt:
          "8 + 6 = ? (Hint: 8 + 2 makes 10, then add what's left of the 6.) Build a drum beat with the total number of quarter notes, spread across the bass and snare rows.",
        targets: [{ instrument: ["kick", "snare"], count: 14 }],
        explanation: "8+6 = 8+2+4 = 10+4 = 14 — bridging through 10 turns a hard fact into two easy ones.",
      },
      B: {
        prompt:
          "9 + 4 = ? (Hint: 9 + 1 makes 10, then add what's left of the 4.) Build a drum beat with the total number of quarter notes, spread across the snare and hi-hat rows.",
        targets: [{ instrument: ["snare", "hihatClosed"], count: 13 }],
        explanation: "9+4 = 9+1+3 = 10+3 = 13.",
      },
      C: {
        prompt:
          "7 + 6 = ? (Hint: 7 + 3 makes 10, then add what's left of the 6.) Build a drum beat with the total number of quarter notes, spread across the hi-hat and bass rows.",
        targets: [{ instrument: ["hihatClosed", "kick"], count: 13 }],
        explanation: "7+6 = 7+3+3 = 10+3 = 13.",
      },
      D: {
        prompt:
          "5 + 9 = ? (Hint: 5 + 5 makes 10, then add what's left of the 9.) Build a drum beat with the total number of quarter notes, spread across the bass and snare rows.",
        targets: [{ instrument: ["kick", "snare"], count: 14 }],
        explanation: "5+9 = 5+5+4 = 10+4 = 14.",
      },
    },
  },
  {
    slug: "math-g1-l07-subtraction-within-20",
    grade: 1,
    lessonNumber: 7,
    title: "Subtraction Within 20",
    mathSkill: "Subtract Within 20 (1.OA.C.6)",
    teaches: "Every slot is a subtraction fact starting just over 10 — build what's left in one row.",
    bpm: 80,
    challenges: {
      A: {
        prompt: "14 - 7 = ? Build a hi-hat row with what's left, in quarter notes.",
        targets: [{ instrument: "hihatClosed", count: 7 }],
        explanation: "14 - 7 = 7.",
      },
      B: {
        prompt: "16 - 9 = ? Build a bass drum row with what's left, in quarter notes.",
        targets: [{ instrument: "kick", count: 7 }],
        explanation: "16 - 9 = 7.",
      },
      C: {
        prompt: "13 - 5 = ? Build a snare drum row with what's left, in quarter notes.",
        targets: [{ instrument: "snare", count: 8 }],
        explanation: "13 - 5 = 8.",
      },
      D: {
        prompt: "15 - 8 = ? Build a hi-hat row with what's left, in quarter notes.",
        targets: [{ instrument: "hihatClosed", count: 7 }],
        explanation: "15 - 8 = 7.",
      },
    },
  },
  {
    slug: "math-g1-l08-missing-addend",
    grade: 1,
    lessonNumber: 8,
    title: "Missing Addend",
    mathSkill: "Unknown Numbers in Equations (1.OA.D.8)",
    teaches: "Every slot hides one number in an addition equation — figure out what it has to be, then build that many quarter notes.",
    bpm: 80,
    challenges: {
      A: {
        prompt: "7 + ? = 12. Build a bass drum row with as many quarter notes as the missing number.",
        targets: [{ instrument: "kick", count: 5 }],
        explanation: "7 + 5 = 12, so the missing number is 5.",
      },
      B: {
        prompt: "9 + ? = 15. Build a snare drum row with as many quarter notes as the missing number.",
        targets: [{ instrument: "snare", count: 6 }],
        explanation: "9 + 6 = 15, so the missing number is 6.",
      },
      C: {
        prompt: "? + 5 = 13. Build a hi-hat row with as many quarter notes as the missing number.",
        targets: [{ instrument: "hihatClosed", count: 8 }],
        explanation: "8 + 5 = 13, so the missing number is 8 — the unknown can be the first addend too.",
      },
      D: {
        prompt: "? + 8 = 14. Build a bass drum row with as many quarter notes as the missing number.",
        targets: [{ instrument: "kick", count: 6 }],
        explanation: "6 + 8 = 14, so the missing number is 6.",
      },
    },
  },
  {
    slug: "math-g1-l09-adding-three-numbers",
    grade: 1,
    lessonNumber: 9,
    title: "Adding Three Numbers",
    mathSkill: "Adding Three Numbers (1.OA.A.2)",
    teaches: "Every slot adds three numbers, one after another — add them in any order, one at a time, and build the total.",
    bpm: 80,
    challenges: {
      A: {
        prompt:
          "3 + 5 + 2 = ? Build a drum beat with the total number of quarter notes, spread across the bass and snare rows.",
        targets: [{ instrument: ["kick", "snare"], count: 10 }],
        explanation: "3 + 5 + 2 = 10 — add them one at a time, in any order.",
      },
      B: {
        prompt:
          "4 + 2 + 3 = ? Build a drum beat with the total number of quarter notes, spread across the snare and hi-hat rows.",
        targets: [{ instrument: ["snare", "hihatClosed"], count: 9 }],
        explanation: "4 + 2 + 3 = 9.",
      },
      C: {
        prompt:
          "1 + 6 + 2 = ? Build a drum beat with the total number of quarter notes, spread across the hi-hat and bass rows.",
        targets: [{ instrument: ["hihatClosed", "kick"], count: 9 }],
        explanation: "1 + 6 + 2 = 9.",
      },
      D: {
        prompt:
          "2 + 5 + 4 = ? Build a drum beat with the total number of quarter notes, spread across the bass and snare rows.",
        targets: [{ instrument: ["kick", "snare"], count: 11 }],
        explanation: "2 + 5 + 4 = 11.",
      },
    },
  },
  {
    slug: "math-g1-l10-fact-families",
    grade: 1,
    lessonNumber: 10,
    title: "Fact Families",
    mathSkill: "Related Facts (1.OA.B.4)",
    teaches: "Every slot gives you an addition fact, then asks about its related subtraction fact — build the two parts that make up the whole, on two different instruments.",
    bpm: 80,
    challenges: {
      A: {
        prompt: "If 6 + 7 = 13, what is 13 - 7? Build a bass drum row with 6 quarter notes and a snare drum row with 7 quarter notes — the two parts of the 6, 7, 13 fact family.",
        targets: [
          { instrument: "kick", count: 6 },
          { instrument: "snare", count: 7 },
        ],
        explanation: "13 - 7 = 6 — the same three numbers work for addition and subtraction (6+7=13, 7+6=13, 13-7=6, 13-6=7).",
      },
      B: {
        prompt: "If 8 + 7 = 15, what is 15 - 8? Build a bass drum row with 8 quarter notes and a snare drum row with 7 quarter notes — the two parts of the 8, 7, 15 fact family.",
        targets: [
          { instrument: "kick", count: 8 },
          { instrument: "snare", count: 7 },
        ],
        explanation: "15 - 8 = 7 — 8 and 7 are the fact family's two parts.",
      },
      C: {
        prompt: "If 5 + 6 = 11, what is 11 - 5? Build a bass drum row with 5 quarter notes and a snare drum row with 6 quarter notes — the two parts of the 5, 6, 11 fact family.",
        targets: [
          { instrument: "kick", count: 5 },
          { instrument: "snare", count: 6 },
        ],
        explanation: "11 - 5 = 6 — 5 and 6 are the fact family's two parts.",
      },
      D: {
        prompt: "If 6 + 8 = 14, what is 14 - 6? Build a bass drum row with 6 quarter notes and a snare drum row with 8 quarter notes — the two parts of the 6, 8, 14 fact family.",
        targets: [
          { instrument: "kick", count: 6 },
          { instrument: "snare", count: 8 },
        ],
        explanation: "14 - 6 = 8 — 6 and 8 are the fact family's two parts.",
      },
    },
  },
  {
    slug: "math-g1-l11-place-value-tens-and-ones",
    grade: 1,
    lessonNumber: 11,
    title: "Place Value: Tens and Ones",
    mathSkill: "Place Value (1.NBT.B.2)",
    teaches: "Every slot gives you a two-digit number — build its tens on the bass drum and its ones on the hi-hat, the same two rows every time.",
    bpm: 84,
    challenges: {
      A: {
        prompt: "34 has how many tens and ones? Build a bass drum row of quarter notes for the tens and a hi-hat row of quarter notes for the ones.",
        targets: [
          { instrument: "kick", count: 3 },
          { instrument: "hihatClosed", count: 4 },
        ],
        explanation: "34 = 3 tens (30) + 4 ones.",
      },
      B: {
        prompt: "52 has how many tens and ones? Build a bass drum row of quarter notes for the tens and a hi-hat row of quarter notes for the ones.",
        targets: [
          { instrument: "kick", count: 5 },
          { instrument: "hihatClosed", count: 2 },
        ],
        explanation: "52 = 5 tens (50) + 2 ones.",
      },
      C: {
        prompt: "67 has how many tens and ones? Build a bass drum row of quarter notes for the tens and a hi-hat row of quarter notes for the ones.",
        targets: [
          { instrument: "kick", count: 6 },
          { instrument: "hihatClosed", count: 7 },
        ],
        explanation: "67 = 6 tens (60) + 7 ones.",
      },
      D: {
        prompt: "28 has how many tens and ones? Build a bass drum row of quarter notes for the tens and a hi-hat row of quarter notes for the ones.",
        targets: [
          { instrument: "kick", count: 2 },
          { instrument: "hihatClosed", count: 8 },
        ],
        explanation: "28 = 2 tens (20) + 8 ones.",
      },
    },
  },
  {
    slug: "math-g1-l12-comparing-two-digit-numbers",
    grade: 1,
    lessonNumber: 12,
    title: "Comparing Two-Digit Numbers",
    mathSkill: "Comparing Numbers (1.NBT.B.3)",
    teaches: "Every slot gives you two numbers to compare — since they have different tens digits, the tens digit alone tells you which is bigger. Build a row that would beat, or lose to, the other number's tens.",
    bpm: 84,
    challenges: {
      A: {
        prompt: "Compare 47 and 52. 52 has 5 tens, 47 has 4 tens. Build a snare drum row with MORE than 4 quarter notes, so your number's tens would beat 47's.",
        targets: [{ instrument: "snare", count: 4, comparison: "gt" }],
        explanation: "52 has more tens than 47 (5 vs. 4), so 52 is greater. 5 or more quarter notes here beats 47.",
      },
      B: {
        prompt: "Compare 63 and 58. 63 has 6 tens, 58 has 5 tens. Build a hi-hat row with MORE than 5 quarter notes, so your number's tens would beat 58's.",
        targets: [{ instrument: "hihatClosed", count: 5, comparison: "gt" }],
        explanation: "63 has more tens than 58 (6 vs. 5), so 63 is greater. 6 or more quarter notes here beats 58.",
      },
      C: {
        prompt: "Compare 24 and 31. 31 has 3 tens, 24 has 2 tens. Build a bass drum row with FEWER than 3 quarter notes, so your number's tens would lose to 31's.",
        targets: [{ instrument: "kick", count: 3, comparison: "lt" }],
        explanation: "24 has fewer tens than 31 (2 vs. 3), so 24 is less. 1 or 2 quarter notes here loses to 31.",
      },
      D: {
        prompt: "Compare 89 and 76. 89 has 8 tens, 76 has 7 tens. Build a snare drum row with MORE than 7 quarter notes, so your number's tens would beat 76's.",
        targets: [{ instrument: "snare", count: 7, comparison: "gt" }],
        explanation: "89 has more tens than 76 (8 vs. 7), so 89 is greater. 8 or more quarter notes here beats 76.",
      },
    },
  },
  {
    slug: "math-g1-l13-adding-tens-and-ones",
    grade: 1,
    lessonNumber: 13,
    title: "Adding Tens and Ones",
    mathSkill: "Add Within 100 (1.NBT.C.4)",
    teaches: "Every slot adds a multiple of ten to a single-digit number — build the result's tens and ones, the same two rows every time.",
    bpm: 84,
    challenges: {
      A: {
        prompt: "20 + 5 = ? Build a bass drum row of quarter notes for the tens and a hi-hat row of quarter notes for the ones of the total.",
        targets: [
          { instrument: "kick", count: 2 },
          { instrument: "hihatClosed", count: 5 },
        ],
        explanation: "20 + 5 = 25 — 2 tens and 5 ones.",
      },
      B: {
        prompt: "30 + 4 = ? Build a bass drum row of quarter notes for the tens and a hi-hat row of quarter notes for the ones of the total.",
        targets: [
          { instrument: "kick", count: 3 },
          { instrument: "hihatClosed", count: 4 },
        ],
        explanation: "30 + 4 = 34 — 3 tens and 4 ones.",
      },
      C: {
        prompt: "60 + 7 = ? Build a bass drum row of quarter notes for the tens and a hi-hat row of quarter notes for the ones of the total.",
        targets: [
          { instrument: "kick", count: 6 },
          { instrument: "hihatClosed", count: 7 },
        ],
        explanation: "60 + 7 = 67 — 6 tens and 7 ones.",
      },
      D: {
        prompt: "40 + 2 = ? Build a bass drum row of quarter notes for the tens and a hi-hat row of quarter notes for the ones of the total.",
        targets: [
          { instrument: "kick", count: 4 },
          { instrument: "hihatClosed", count: 2 },
        ],
        explanation: "40 + 2 = 42 — 4 tens and 2 ones.",
      },
    },
  },
  {
    slug: "math-g1-l14-building-numbers-from-tens-and-ones",
    grade: 1,
    lessonNumber: 14,
    title: "Building Numbers from Tens and Ones",
    mathSkill: "Place Value (1.NBT.B.2)",
    teaches: "Every slot works backward from Lesson 11 — you're given the tens and ones, and you build the number they make.",
    bpm: 84,
    challenges: {
      A: {
        prompt: "6 tens and 3 ones make what number? Build a bass drum row with 6 quarter notes for the tens and a hi-hat row with 3 quarter notes for the ones.",
        targets: [
          { instrument: "kick", count: 6 },
          { instrument: "hihatClosed", count: 3 },
        ],
        explanation: "6 tens (60) + 3 ones = 63.",
      },
      B: {
        prompt: "4 tens and 7 ones make what number? Build a bass drum row with 4 quarter notes for the tens and a hi-hat row with 7 quarter notes for the ones.",
        targets: [
          { instrument: "kick", count: 4 },
          { instrument: "hihatClosed", count: 7 },
        ],
        explanation: "4 tens (40) + 7 ones = 47.",
      },
      C: {
        prompt: "8 tens and 1 one make what number? Build a bass drum row with 8 quarter notes for the tens and a hi-hat row with 1 quarter note for the ones.",
        targets: [
          { instrument: "kick", count: 8 },
          { instrument: "hihatClosed", count: 1 },
        ],
        explanation: "8 tens (80) + 1 one = 81.",
      },
      D: {
        prompt: "5 tens and 8 ones make what number? Build a bass drum row with 5 quarter notes for the tens and a hi-hat row with 8 quarter notes for the ones.",
        targets: [
          { instrument: "kick", count: 5 },
          { instrument: "hihatClosed", count: 8 },
        ],
        explanation: "5 tens (50) + 8 ones = 58.",
      },
    },
  },
  {
    slug: "math-g1-l15-ten-more",
    grade: 1,
    lessonNumber: 15,
    title: "Ten More",
    mathSkill: "Ten More / Ten Less (1.NBT.C.5)",
    teaches: "Every slot asks for ten more or ten less than a number — only the tens digit changes, so build the new tens and the same ones.",
    bpm: 84,
    challenges: {
      A: {
        prompt: "68 + 10 = ? Build a bass drum row of quarter notes for the new tens and a hi-hat row of quarter notes for the ones.",
        targets: [
          { instrument: "kick", count: 7 },
          { instrument: "hihatClosed", count: 8 },
        ],
        explanation: "10 more than 68 is 78 — the tens go from 6 to 7, the ones stay at 8.",
      },
      B: {
        prompt: "45 - 10 = ? Build a bass drum row of quarter notes for the new tens and a hi-hat row of quarter notes for the ones.",
        targets: [
          { instrument: "kick", count: 3 },
          { instrument: "hihatClosed", count: 5 },
        ],
        explanation: "10 less than 45 is 35 — the tens go from 4 to 3, the ones stay at 5.",
      },
      C: {
        prompt: "72 + 10 = ? Build a bass drum row of quarter notes for the new tens and a hi-hat row of quarter notes for the ones.",
        targets: [
          { instrument: "kick", count: 8 },
          { instrument: "hihatClosed", count: 2 },
        ],
        explanation: "10 more than 72 is 82 — the tens go from 7 to 8, the ones stay at 2.",
      },
      D: {
        prompt: "56 - 10 = ? Build a bass drum row of quarter notes for the new tens and a hi-hat row of quarter notes for the ones.",
        targets: [
          { instrument: "kick", count: 4 },
          { instrument: "hihatClosed", count: 6 },
        ],
        explanation: "10 less than 56 is 46 — the tens go from 5 to 4, the ones stay at 6.",
      },
    },
  },
  {
    slug: "math-g1-l16-adding-within-100",
    grade: 1,
    lessonNumber: 16,
    title: "Adding Within 100",
    mathSkill: "Add Within 100 (1.NBT.C.4)",
    teaches: "Every slot adds a small number onto a two-digit number without changing the tens — just build the new ones total.",
    bpm: 86,
    challenges: {
      A: {
        prompt: "23 + 5 = ? The tens don't change — just add the ones. Build a hi-hat row with the new ones total, in quarter notes.",
        targets: [{ instrument: "hihatClosed", count: 8 }],
        explanation: "The 2 tens stay put; just add the ones: 3 + 5 = 8, so 23 + 5 = 28.",
      },
      B: {
        prompt: "31 + 6 = ? The tens don't change — just add the ones. Build a hi-hat row with the new ones total, in quarter notes.",
        targets: [{ instrument: "hihatClosed", count: 7 }],
        explanation: "The 3 tens stay put; just add the ones: 1 + 6 = 7, so 31 + 6 = 37.",
      },
      C: {
        prompt: "42 + 3 = ? The tens don't change — just add the ones. Build a hi-hat row with the new ones total, in quarter notes.",
        targets: [{ instrument: "hihatClosed", count: 5 }],
        explanation: "The 4 tens stay put; just add the ones: 2 + 3 = 5, so 42 + 3 = 45.",
      },
      D: {
        prompt: "54 + 2 = ? The tens don't change — just add the ones. Build a hi-hat row with the new ones total, in quarter notes.",
        targets: [{ instrument: "hihatClosed", count: 6 }],
        explanation: "The 5 tens stay put; just add the ones: 4 + 2 = 6, so 54 + 2 = 56.",
      },
    },
  },
  {
    slug: "math-g1-l17-subtraction-word-problems-within-20",
    grade: 1,
    lessonNumber: 17,
    title: "Subtraction Word Problems Within 20",
    mathSkill: "Subtraction Word Problems (1.OA.A.1)",
    teaches: "Every slot is its own subtraction word problem — read it, then build only what's left.",
    bpm: 86,
    challenges: {
      A: {
        prompt: "There are 14 birds in a tree. 8 fly away. How many birds are left? Build a bass drum row with that many quarter notes.",
        targets: [{ instrument: "kick", count: 6 }],
        explanation: "14 - 8 = 6.",
      },
      B: {
        prompt: "There are 16 kids on the playground. 9 go inside. How many kids are left outside? Build a snare drum row with that many quarter notes.",
        targets: [{ instrument: "snare", count: 7 }],
        explanation: "16 - 9 = 7.",
      },
      C: {
        prompt:
          "There are 15 balloons at a party. 6 pop. How many balloons are left? Build a drum beat with that many quarter notes, spread across the hi-hat and bass rows.",
        targets: [{ instrument: ["hihatClosed", "kick"], count: 9 }],
        explanation: "15 - 6 = 9.",
      },
      D: {
        prompt: "There are 12 crayons in a box. 5 break. How many unbroken crayons are left? Build a bass drum row with that many quarter notes.",
        targets: [{ instrument: "kick", count: 7 }],
        explanation: "12 - 5 = 7.",
      },
    },
  },
  {
    slug: "math-g1-l18-addition-word-problems-within-20",
    grade: 1,
    lessonNumber: 18,
    title: "Addition Word Problems Within 20",
    mathSkill: "Addition Word Problems (1.OA.A.1)",
    teaches: "Every slot is its own addition word problem — read it, then build the new total.",
    bpm: 86,
    challenges: {
      A: {
        prompt:
          "Sam has 9 stickers. He gets 6 more. How many stickers does Sam have now? Build a drum beat with that many quarter notes, spread across the bass and snare rows.",
        targets: [{ instrument: ["kick", "snare"], count: 15 }],
        explanation: "9 + 6 = 15.",
      },
      B: {
        prompt:
          "Sam has 8 marbles. He gets 5 more. How many marbles does Sam have now? Build a drum beat with that many quarter notes, spread across the snare and hi-hat rows.",
        targets: [{ instrument: ["snare", "hihatClosed"], count: 13 }],
        explanation: "8 + 5 = 13.",
      },
      C: {
        prompt:
          "There are 6 apples in a basket. 9 more are added. How many apples are in the basket now? Build a drum beat with that many quarter notes, spread across the hi-hat and bass rows.",
        targets: [{ instrument: ["hihatClosed", "kick"], count: 15 }],
        explanation: "6 + 9 = 15.",
      },
      D: {
        prompt:
          "There are 9 crayons in a box. 4 more are added. How many crayons are in the box now? Build a drum beat with that many quarter notes, spread across the bass and snare rows.",
        targets: [{ instrument: ["kick", "snare"], count: 13 }],
        explanation: "9 + 4 = 13.",
      },
    },
  },
  {
    slug: "math-g1-l19-adding-two-digit-numbers",
    grade: 1,
    lessonNumber: 19,
    title: "Adding Two-Digit Numbers",
    mathSkill: "Add Within 100 (1.NBT.C.4)",
    teaches: "Every slot adds two two-digit numbers where the second one has no ones — the ones stay the same, so just add the tens.",
    bpm: 86,
    challenges: {
      A: {
        prompt: "45 + 30 = ? Build a bass drum row of quarter notes for the tens and a hi-hat row of quarter notes for the ones of the total.",
        targets: [
          { instrument: "kick", count: 7 },
          { instrument: "hihatClosed", count: 5 },
        ],
        explanation: "45 + 30 = 75 — the ones stay at 5, and the tens add: 4 + 3 = 7.",
      },
      B: {
        prompt: "52 + 20 = ? Build a bass drum row of quarter notes for the tens and a hi-hat row of quarter notes for the ones of the total.",
        targets: [
          { instrument: "kick", count: 7 },
          { instrument: "hihatClosed", count: 2 },
        ],
        explanation: "52 + 20 = 72 — the ones stay at 2, and the tens add: 5 + 2 = 7.",
      },
      C: {
        prompt: "51 + 30 = ? Build a bass drum row of quarter notes for the tens and a hi-hat row of quarter notes for the ones of the total.",
        targets: [
          { instrument: "kick", count: 8 },
          { instrument: "hihatClosed", count: 1 },
        ],
        explanation: "51 + 30 = 81 — the ones stay at 1, and the tens add: 5 + 3 = 8.",
      },
      D: {
        prompt: "24 + 40 = ? Build a bass drum row of quarter notes for the tens and a hi-hat row of quarter notes for the ones of the total.",
        targets: [
          { instrument: "kick", count: 6 },
          { instrument: "hihatClosed", count: 4 },
        ],
        explanation: "24 + 40 = 64 — the ones stay at 4, and the tens add: 2 + 4 = 6.",
      },
    },
  },
  {
    slug: "math-g1-l20-bridging-through-ten-to-subtract",
    grade: 1,
    lessonNumber: 20,
    title: "Bridging Through 10 to Subtract",
    mathSkill: "Subtract Within 20 (1.OA.C.6)",
    teaches: "Every slot is a subtraction fact that dips below an even ten — bridge down to 10 first, then subtract what's left, and build what remains.",
    bpm: 86,
    challenges: {
      A: {
        prompt: "17 - 9 = ? (Hint: 17 - 7 gets you down to 10, then subtract what's left of the 9.) Build a hi-hat row with what's left, in quarter notes.",
        targets: [{ instrument: "hihatClosed", count: 8 }],
        explanation: "17-9 = 17-7-2 = 10-2 = 8 — bridging down through 10 works for subtraction too.",
      },
      B: {
        prompt: "15 - 7 = ? (Hint: 15 - 5 gets you down to 10, then subtract what's left of the 7.) Build a bass drum row with what's left, in quarter notes.",
        targets: [{ instrument: "kick", count: 8 }],
        explanation: "15-7 = 15-5-2 = 10-2 = 8.",
      },
      C: {
        prompt: "13 - 6 = ? (Hint: 13 - 3 gets you down to 10, then subtract what's left of the 6.) Build a snare drum row with what's left, in quarter notes.",
        targets: [{ instrument: "snare", count: 7 }],
        explanation: "13-6 = 13-3-3 = 10-3 = 7.",
      },
      D: {
        prompt: "16 - 8 = ? (Hint: 16 - 6 gets you down to 10, then subtract what's left of the 8.) Build a hi-hat row with what's left, in quarter notes.",
        targets: [{ instrument: "hihatClosed", count: 8 }],
        explanation: "16-8 = 16-6-2 = 10-2 = 8.",
      },
    },
  },
  {
    slug: "math-g1-l21-telling-time-to-the-hour",
    grade: 1,
    lessonNumber: 21,
    title: "Telling Time to the Hour",
    mathSkill: "Telling Time (1.MD.B.3)",
    teaches: "Every slot describes a clock's hour and minute hands at exactly the hour — read the hour hand and build that many quarter notes.",
    bpm: 88,
    challenges: {
      A: {
        prompt: "The hour hand points to 3 and the minute hand points to 12. What time is it? Build a bass drum row of quarter notes for the hour.",
        targets: [{ instrument: "kick", count: 3 }],
        explanation: "Hour hand on 3, minute hand on 12, means 3:00.",
      },
      B: {
        prompt: "The hour hand points to 7 and the minute hand points to 12. What time is it? Build a snare drum row of quarter notes for the hour.",
        targets: [{ instrument: "snare", count: 7 }],
        explanation: "Hour hand on 7, minute hand on 12, means 7:00.",
      },
      C: {
        prompt:
          "The hour hand points to 11 and the minute hand points to 12. What time is it? Build the hour in quarter notes, spread across the hi-hat and snare rows.",
        targets: [{ instrument: ["hihatClosed", "snare"], count: 11 }],
        explanation: "Hour hand on 11, minute hand on 12, means 11:00.",
      },
      D: {
        prompt: "The hour hand points to 5 and the minute hand points to 12. What time is it? Build a bass drum row of quarter notes for the hour.",
        targets: [{ instrument: "kick", count: 5 }],
        explanation: "Hour hand on 5, minute hand on 12, means 5:00.",
      },
    },
  },
  {
    slug: "math-g1-l22-comparing-lengths",
    grade: 1,
    lessonNumber: 22,
    title: "Comparing Lengths",
    mathSkill: "Ordering by Length (1.MD.A.1)",
    teaches: "Every slot gives you three objects of different lengths — build one row per object (short on the high tom, medium on the mid tom, long on the low tom) so the three rows show the order.",
    bpm: 88,
    challenges: {
      A: {
        prompt: "You have three pencils: a short one, a medium one, and a long one. Build a high tom row with 3 quarter notes for the short pencil, a mid tom row with 5 quarter notes for the medium pencil, and a low tom row with 7 quarter notes for the long pencil.",
        targets: [
          { instrument: "highTom", count: 3 },
          { instrument: "midTom", count: 5 },
          { instrument: "lowTom", count: 7 },
        ],
        explanation: "3 < 5 < 7 — from shortest to longest: short, medium, long.",
      },
      B: {
        prompt: "You have a short crayon, a medium crayon, and a long crayon. Build a high tom row with 2 quarter notes for the short one, a mid tom row with 4 quarter notes for the medium one, and a low tom row with 6 quarter notes for the long one.",
        targets: [
          { instrument: "highTom", count: 2 },
          { instrument: "midTom", count: 4 },
          { instrument: "lowTom", count: 6 },
        ],
        explanation: "2 < 4 < 6 — shortest to longest.",
      },
      C: {
        prompt: "You have a short ribbon, a medium ribbon, and a long ribbon. Build a high tom row with 3 quarter notes for the short one, a mid tom row with 6 quarter notes for the medium one, and a low tom row with 8 quarter notes for the long one.",
        targets: [
          { instrument: "highTom", count: 3 },
          { instrument: "midTom", count: 6 },
          { instrument: "lowTom", count: 8 },
        ],
        explanation: "3 < 6 < 8 — shortest to longest.",
      },
      D: {
        prompt: "You have a short pencil, a medium pencil, and a long pencil. Build a high tom row with 1 quarter note for the short one, a mid tom row with 3 quarter notes for the medium one, and a low tom row with 5 quarter notes for the long one.",
        targets: [
          { instrument: "highTom", count: 1 },
          { instrument: "midTom", count: 3 },
          { instrument: "lowTom", count: 5 },
        ],
        explanation: "1 < 3 < 5 — shortest to longest.",
      },
    },
  },
  {
    slug: "math-g1-l23-fractions-halves",
    grade: 1,
    lessonNumber: 23,
    title: "Fractions: Halves",
    mathSkill: "Partitioning into Halves (1.G.A.3)",
    teaches: "Every slot splits something into 2 equal shares — halves are always 2 pieces, no matter what you split.",
    bpm: 88,
    challenges: {
      A: {
        prompt: "If you cut a pizza into 2 equal pieces, what do we call each piece, and how many pieces are there? Build a bass drum row with that many quarter notes.",
        targets: [{ instrument: "kick", count: 2 }],
        explanation: "Splitting into 2 equal shares makes halves — 2 pieces.",
      },
      B: {
        prompt: "If you cut a sandwich into 2 equal pieces (halves), how many pieces are there? Build a snare drum row with that many quarter notes.",
        targets: [{ instrument: "snare", count: 2 }],
        explanation: "Halves means 2 equal pieces.",
      },
      C: {
        prompt: "If you cut a brownie into 2 equal pieces (halves), how many pieces are there? Build a hi-hat row with that many quarter notes.",
        targets: [{ instrument: "hihatClosed", count: 2 }],
        explanation: "Halves means 2 equal pieces.",
      },
      D: {
        prompt: "If you cut a granola bar into 2 equal pieces (halves), how many pieces are there? Build a bass drum row with that many quarter notes.",
        targets: [{ instrument: "kick", count: 2 }],
        explanation: "Halves means 2 equal pieces.",
      },
    },
  },
  {
    slug: "math-g1-l24-shapes-and-fourths",
    grade: 1,
    lessonNumber: 24,
    title: "Shapes and Fourths",
    mathSkill: "Shapes & Equal Shares (1.G.A.2, 1.G.A.3)",
    teaches: "Every slot connects a square's own sides or corners to fourths — splitting something into 4 equal shares always makes 4 pieces, the same 4 a square already has.",
    bpm: 88,
    challenges: {
      A: {
        prompt: "A square has how many sides? Build a bass drum row with that many quarter notes.",
        targets: [{ instrument: "kick", count: 4 }],
        explanation: "A square has 4 sides — one quarter note for each.",
      },
      B: {
        prompt: "A square has how many corners? Build a snare drum row with that many quarter notes.",
        targets: [{ instrument: "snare", count: 4 }],
        explanation: "A square has 4 corners.",
      },
      C: {
        prompt: "If you split a pan of brownies into 4 equal pieces (fourths), how many pieces are there? Build a hi-hat row with that many quarter notes.",
        targets: [{ instrument: "hihatClosed", count: 4 }],
        explanation: "Splitting into 4 equal shares makes fourths, also called quarters — 4 pieces.",
      },
      D: {
        prompt: "A square has 4 sides, and splitting something into fourths also makes 4 pieces — same number, two different reasons. Build a bass drum row with 4 quarter notes for the sides, and a snare drum row with 4 quarter notes for the fourths.",
        targets: [
          { instrument: "kick", count: 4 },
          { instrument: "snare", count: 4 },
        ],
        explanation: "A square's 4 sides and a shape's 4 fourths are both just the number 4, showing up in two different math ideas.",
      },
    },
  },

  // ============================================================
  // GRADE 2 — anchored on Oregon's actual Grade 2 progression: fluent
  // addition/subtraction within 20 and skip counting (fall), addition/
  // subtraction within 100, odd/even, and arrays (winter), place value to
  // 1000 and comparing three-digit numbers (early spring), addition/
  // subtraction within 1000, two-step problems, and money (mid spring),
  // time, measurement, data, and fractions (late spring). This is where
  // the kit opens up the most: any answer with more than one digit gets
  // split hundreds/tens/ones across three instruments, and a handful of
  // lessons (arrays, measurement differences, bar graphs) use three
  // instruments because the problem itself has three real, separate
  // quantities in it — not for variety's own sake.
  // ============================================================
  {
    slug: "math-g2-l01-addition-facts-within-20",
    grade: 2,
    lessonNumber: 1,
    title: "Addition Facts Within 20",
    mathSkill: "Fluency Within 20 (2.OA.B.2)",
    teaches: "Every slot is a fast addition fact within 20 — since the total is often too big for one row, build a drum beat with the total spread across the kit however you like.",
    bpm: 86,
    challenges: {
      A: {
        prompt: "7 + 8 = ? Build a drum beat with the total number of quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 15 }],
        explanation: "7 + 8 = 15.",
      },
      B: {
        prompt: "9 + 5 = ? Build a drum beat with the total number of quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 14 }],
        explanation: "9 + 5 = 14.",
      },
      C: {
        prompt: "8 + 8 = ? Build a drum beat with the total number of quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 16 }],
        explanation: "8 + 8 = 16.",
      },
      D: {
        prompt: "7 + 6 = ? Build a drum beat with the total number of quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 13 }],
        explanation: "7 + 6 = 13.",
      },
    },
  },
  {
    slug: "math-g2-l02-subtraction-facts-within-20",
    grade: 2,
    lessonNumber: 2,
    title: "Subtraction Facts Within 20",
    mathSkill: "Fluency Within 20 (2.OA.B.2)",
    teaches: "Every slot is a fast subtraction fact within 20 — build what's left, anywhere in the kit.",
    bpm: 86,
    challenges: {
      A: {
        prompt: "15 - 6 = ? Build a drum beat with what's left, in quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 9 }],
        explanation: "15 - 6 = 9.",
      },
      B: {
        prompt: "12 - 4 = ? Build a drum beat with what's left, in quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 8 }],
        explanation: "12 - 4 = 8.",
      },
      C: {
        prompt: "17 - 8 = ? Build a drum beat with what's left, in quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 9 }],
        explanation: "17 - 8 = 9.",
      },
      D: {
        prompt: "11 - 3 = ? Build a drum beat with what's left, in quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 8 }],
        explanation: "11 - 3 = 8.",
      },
    },
  },
  {
    slug: "math-g2-l03-skip-counting-by-5s",
    grade: 2,
    lessonNumber: 3,
    title: "Skip Counting by 5s",
    mathSkill: "Counting Patterns (2.NBT.A.2)",
    teaches: "Every slot is a counting-by-5s sequence with one number missing — build how many FIVES that missing number is, not the number itself, anywhere in the kit.",
    bpm: 86,
    challenges: {
      A: {
        prompt: "Count by 5s: 5, 10, 15, __, 25, 30. The missing number is how many fives? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 4 }],
        explanation: "5, 10, 15, 20, 25, 30 — the missing number is 20, which is 4 fives.",
      },
      B: {
        prompt: "Count by 5s: 5, 10, __, 20, 25. The missing number is how many fives? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 3 }],
        explanation: "5, 10, 15, 20, 25 — the missing number is 15, which is 3 fives.",
      },
      C: {
        prompt: "Count by 5s: 15, 20, 25, __, 35. The missing number is how many fives? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 6 }],
        explanation: "15, 20, 25, 30, 35 — the missing number is 30, which is 6 fives.",
      },
      D: {
        prompt: "Count by 5s: __, 10, 15, 20. The missing number is how many fives? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 1 }],
        explanation: "5, 10, 15, 20 — the missing number is 5, which is 1 five.",
      },
    },
  },
  {
    slug: "math-g2-l04-ten-more-mentally",
    grade: 2,
    lessonNumber: 4,
    title: "Ten More, Mentally",
    mathSkill: "Mentally Add/Subtract 10 (2.NBT.B.8)",
    teaches: "Every slot adds 10 to a two-digit number — only the tens digit changes, so build the new tens and ones.",
    bpm: 86,
    challenges: {
      A: {
        prompt: "What is 10 more than 47? Build a bass drum row of quarter notes for the tens and a hi-hat row of quarter notes for the ones.",
        targets: [
          { instrument: "kick", count: 5 },
          { instrument: "hihatClosed", count: 7 },
        ],
        explanation: "10 more than 47 is 57 — 5 tens and 7 ones.",
      },
      B: {
        prompt: "What is 10 more than 73? Build a bass drum row of quarter notes for the tens and a hi-hat row of quarter notes for the ones.",
        targets: [
          { instrument: "kick", count: 8 },
          { instrument: "hihatClosed", count: 3 },
        ],
        explanation: "10 more than 73 is 83 — 8 tens and 3 ones.",
      },
      C: {
        prompt: "What is 10 more than 24? Build a bass drum row of quarter notes for the tens and a hi-hat row of quarter notes for the ones.",
        targets: [
          { instrument: "kick", count: 3 },
          { instrument: "hihatClosed", count: 4 },
        ],
        explanation: "10 more than 24 is 34 — 3 tens and 4 ones.",
      },
      D: {
        prompt: "What is 10 more than 66? Build a bass drum row of quarter notes for the tens and a hi-hat row of quarter notes for the ones.",
        targets: [
          { instrument: "kick", count: 7 },
          { instrument: "hihatClosed", count: 6 },
        ],
        explanation: "10 more than 66 is 76 — 7 tens and 6 ones.",
      },
    },
  },
  {
    slug: "math-g2-l05-place-value-hundreds-tens-ones",
    grade: 2,
    lessonNumber: 5,
    title: "Place Value: Hundreds, Tens, Ones",
    mathSkill: "Place Value (2.NBT.A.1)",
    teaches: "Every slot gives you a number by its hundreds, tens, and ones — build all three, one instrument per place.",
    bpm: 86,
    challenges: {
      A: {
        prompt: "3 hundreds, 2 tens, 5 ones make what number? Build a bass drum row of quarter notes for the hundreds, a snare row of quarter notes for the tens, and a hi-hat row of quarter notes for the ones.",
        targets: [
          { instrument: "kick", count: 3 },
          { instrument: "snare", count: 2 },
          { instrument: "hihatClosed", count: 5 },
        ],
        explanation: "3 hundreds (300) + 2 tens (20) + 5 ones = 325.",
      },
      B: {
        prompt: "4 hundreds, 7 tens, 1 one make what number? Build a bass drum row of quarter notes for the hundreds, a snare row of quarter notes for the tens, and a hi-hat row of quarter notes for the ones.",
        targets: [
          { instrument: "kick", count: 4 },
          { instrument: "snare", count: 7 },
          { instrument: "hihatClosed", count: 1 },
        ],
        explanation: "4 hundreds (400) + 7 tens (70) + 1 one = 471.",
      },
      C: {
        prompt: "2 hundreds, 6 tens, 8 ones make what number? Build a bass drum row of quarter notes for the hundreds, a snare row of quarter notes for the tens, and a hi-hat row of quarter notes for the ones.",
        targets: [
          { instrument: "kick", count: 2 },
          { instrument: "snare", count: 6 },
          { instrument: "hihatClosed", count: 8 },
        ],
        explanation: "2 hundreds (200) + 6 tens (60) + 8 ones = 268.",
      },
      D: {
        prompt: "6 hundreds, 3 tens, 8 ones make what number? Build a bass drum row of quarter notes for the hundreds, a snare row of quarter notes for the tens, and a hi-hat row of quarter notes for the ones.",
        targets: [
          { instrument: "kick", count: 6 },
          { instrument: "snare", count: 3 },
          { instrument: "hihatClosed", count: 8 },
        ],
        explanation: "6 hundreds (600) + 3 tens (30) + 8 ones = 638.",
      },
    },
  },
  {
    slug: "math-g2-l06-adding-within-100",
    grade: 2,
    lessonNumber: 6,
    title: "Adding Within 100",
    mathSkill: "Add Within 100 (2.NBT.B.5)",
    teaches: "Every slot adds two two-digit numbers — the total is too big for one row, so build its tens and ones.",
    bpm: 88,
    challenges: {
      A: {
        prompt: "33 + 25 = ? Build a bass drum row of quarter notes for the tens and a hi-hat row of quarter notes for the ones of the total.",
        targets: [
          { instrument: "kick", count: 5 },
          { instrument: "hihatClosed", count: 8 },
        ],
        explanation: "33 + 25 = 58 — 5 tens and 8 ones.",
      },
      B: {
        prompt: "48 + 27 = ? Build a bass drum row of quarter notes for the tens and a hi-hat row of quarter notes for the ones of the total.",
        targets: [
          { instrument: "kick", count: 7 },
          { instrument: "hihatClosed", count: 5 },
        ],
        explanation: "48 + 27 = 75 — 7 tens and 5 ones.",
      },
      C: {
        prompt: "46 + 38 = ? Build a bass drum row of quarter notes for the tens and a hi-hat row of quarter notes for the ones of the total.",
        targets: [
          { instrument: "kick", count: 8 },
          { instrument: "hihatClosed", count: 4 },
        ],
        explanation: "46 + 38 = 84 — 8 tens and 4 ones.",
      },
      D: {
        prompt: "38 + 29 = ? Build a bass drum row of quarter notes for the tens and a hi-hat row of quarter notes for the ones of the total.",
        targets: [
          { instrument: "kick", count: 6 },
          { instrument: "hihatClosed", count: 7 },
        ],
        explanation: "38 + 29 = 67 — 6 tens and 7 ones.",
      },
    },
  },
  {
    slug: "math-g2-l07-subtracting-within-100",
    grade: 2,
    lessonNumber: 7,
    title: "Subtracting Within 100",
    mathSkill: "Subtract Within 100 (2.NBT.B.5)",
    teaches: "Every slot subtracts two two-digit numbers — build what's left as tens and ones.",
    bpm: 88,
    challenges: {
      A: {
        prompt: "68 - 23 = ? Build a bass drum row of quarter notes for the tens and a hi-hat row of quarter notes for the ones of what's left.",
        targets: [
          { instrument: "kick", count: 4 },
          { instrument: "hihatClosed", count: 5 },
        ],
        explanation: "68 - 23 = 45 — 4 tens and 5 ones.",
      },
      B: {
        prompt: "74 - 28 = ? Build a bass drum row of quarter notes for the tens and a hi-hat row of quarter notes for the ones of what's left.",
        targets: [
          { instrument: "kick", count: 4 },
          { instrument: "hihatClosed", count: 6 },
        ],
        explanation: "74 - 28 = 46 — 4 tens and 6 ones.",
      },
      C: {
        prompt: "95 - 58 = ? Build a bass drum row of quarter notes for the tens and a hi-hat row of quarter notes for the ones of what's left.",
        targets: [
          { instrument: "kick", count: 3 },
          { instrument: "hihatClosed", count: 7 },
        ],
        explanation: "95 - 58 = 37 — 3 tens and 7 ones.",
      },
      D: {
        prompt: "63 - 19 = ? Build a bass drum row of quarter notes for the tens and a hi-hat row of quarter notes for the ones of what's left.",
        targets: [
          { instrument: "kick", count: 4 },
          { instrument: "hihatClosed", count: 4 },
        ],
        explanation: "63 - 19 = 44 — 4 tens and 4 ones.",
      },
    },
  },
  {
    slug: "math-g2-l08-odd-and-even-numbers",
    grade: 2,
    lessonNumber: 8,
    title: "Odd and Even Numbers",
    mathSkill: "Odd and Even Numbers (2.OA.C.3)",
    teaches: "Every slot gives you an even number — show it's even by splitting it into two EQUAL groups on two different instruments.",
    bpm: 88,
    challenges: {
      A: {
        prompt: "Is 14 even? An even number splits into two equal groups. Build a bass drum row and a snare drum row with 7 quarter notes each to show 14 = 7 + 7.",
        targets: [
          { instrument: "kick", count: 7 },
          { instrument: "snare", count: 7 },
        ],
        explanation: "14 is even because it splits evenly into two equal groups: 7 + 7 = 14.",
      },
      B: {
        prompt: "Is 16 even? Build a bass drum row and a snare drum row with 8 quarter notes each to show 16 = 8 + 8.",
        targets: [
          { instrument: "kick", count: 8 },
          { instrument: "snare", count: 8 },
        ],
        explanation: "16 is even: 8 + 8 = 16.",
      },
      C: {
        prompt: "Is 12 even? Build a bass drum row and a snare drum row with 6 quarter notes each to show 12 = 6 + 6.",
        targets: [
          { instrument: "kick", count: 6 },
          { instrument: "snare", count: 6 },
        ],
        explanation: "12 is even: 6 + 6 = 12.",
      },
      D: {
        prompt: "Is 10 even? Build a bass drum row and a snare drum row with 5 quarter notes each to show 10 = 5 + 5.",
        targets: [
          { instrument: "kick", count: 5 },
          { instrument: "snare", count: 5 },
        ],
        explanation: "10 is even: 5 + 5 = 10 — every even number splits into two equal groups; an odd number always has one left over.",
      },
    },
  },
  {
    slug: "math-g2-l09-repeated-addition-and-arrays",
    grade: 2,
    lessonNumber: 9,
    title: "Repeated Addition & Arrays",
    mathSkill: "Repeated Addition & Arrays (2.OA.C.4)",
    teaches: "Every slot arranges equal rows of something — the number of rows is how many BLOCKS you use; build the total across exactly that many blocks, one block per row, the same amount added over and over.",
    bpm: 88,
    challenges: {
      A: {
        prompt:
          "A teacher arranges 4 rows of chairs, with 3 chairs in each row. Build a drum beat using exactly 4 blocks that add up to 12 notes in all — one block per row.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 12, blocksUsed: 4 }],
        explanation: "4 rows means 3 added 4 times: 3+3+3+3 = 12 — 4 blocks (the rows) holding 12 notes in all. Repeated addition is the start of multiplication.",
      },
      B: {
        prompt:
          "A drummer arranges 3 rows of cymbals, with 5 cymbals in each row. Build a drum beat using exactly 3 blocks that add up to 15 notes in all — one block per row.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 15, blocksUsed: 3 }],
        explanation: "3 rows means 5 added 3 times: 5+5+5 = 15 — 3 blocks holding 15 notes in all.",
      },
      C: {
        prompt:
          "A gardener plants 2 rows of flowers, with 6 flowers in each row. Build a drum beat using exactly 2 blocks that add up to 12 notes in all — one block per row.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 12, blocksUsed: 2 }],
        explanation: "2 rows means 6 added 2 times: 6+6 = 12 — 2 blocks holding 12 notes in all.",
      },
      D: {
        prompt:
          "A drummer arranges 5 rows of tambourines, with 3 tambourines in each row. Build a drum beat using exactly 5 blocks that add up to 15 notes in all — one block per row.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 15, blocksUsed: 5 }],
        explanation: "5 rows means 3 added 5 times: 3+3+3+3+3 = 15 — 5 blocks holding 15 notes in all.",
      },
    },
  },
  {
    slug: "math-g2-l10-subtraction-word-problems-within-100",
    grade: 2,
    lessonNumber: 10,
    title: "Subtraction Word Problems Within 100",
    mathSkill: "Subtraction Word Problems (2.OA.A.1)",
    teaches: "Every slot is its own subtraction word problem — the answer is too big for one row, so build its tens and ones.",
    bpm: 88,
    challenges: {
      A: {
        prompt: "A farmer has 56 apples and sells 19. How many apples are left? Build a bass drum row of quarter notes for the tens and a hi-hat row of quarter notes for the ones.",
        targets: [
          { instrument: "kick", count: 3 },
          { instrument: "hihatClosed", count: 7 },
        ],
        explanation: "56 - 19 = 37 — 3 tens and 7 ones.",
      },
      B: {
        prompt: "A store has 84 shirts and sells 27. How many shirts are left? Build a bass drum row of quarter notes for the tens and a hi-hat row of quarter notes for the ones.",
        targets: [
          { instrument: "kick", count: 5 },
          { instrument: "hihatClosed", count: 7 },
        ],
        explanation: "84 - 27 = 57 — 5 tens and 7 ones.",
      },
      C: {
        prompt: "A library has 73 books checked out and 46 get returned. How many are still checked out? Build a bass drum row of quarter notes for the tens and a hi-hat row of quarter notes for the ones.",
        targets: [
          { instrument: "kick", count: 2 },
          { instrument: "hihatClosed", count: 7 },
        ],
        explanation: "73 - 46 = 27 — 2 tens and 7 ones.",
      },
      D: {
        prompt: "A bakery makes 62 muffins and sells 38. How many muffins are left? Build a bass drum row of quarter notes for the tens and a hi-hat row of quarter notes for the ones.",
        targets: [
          { instrument: "kick", count: 2 },
          { instrument: "hihatClosed", count: 4 },
        ],
        explanation: "62 - 38 = 24 — 2 tens and 4 ones.",
      },
    },
  },
  {
    slug: "math-g2-l11-comparing-three-digit-numbers",
    grade: 2,
    lessonNumber: 11,
    title: "Comparing Three-Digit Numbers",
    mathSkill: "Comparing Numbers (2.NBT.A.4)",
    teaches: "Every slot gives you two numbers with the same hundreds digit — since the hundreds tie, the tens digit decides which is bigger. Build your answer anywhere in the kit.",
    bpm: 88,
    challenges: {
      A: {
        prompt: "Compare 342 and 324. Both have 3 hundreds, so the tens decide: 342 has 4 tens, 324 has 2 tens. Build a drum beat with MORE than 2 quarter notes, so your number's tens would beat 324's.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 2, comparison: "gt" }],
        explanation: "342 has more tens than 324 (4 vs. 2), so 342 is greater.",
      },
      B: {
        prompt: "Compare 521 and 567. Both have 5 hundreds, so the tens decide: 567 has 6 tens, 521 has 2 tens. Build a drum beat with FEWER than 6 quarter notes, so your number's tens would lose to 567's.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 6, comparison: "lt" }],
        explanation: "521 has fewer tens than 567 (2 vs. 6), so 521 is less.",
      },
      C: {
        prompt: "Compare 418 and 463. Both have 4 hundreds, so the tens decide: 463 has 6 tens, 418 has 1 ten. Build a drum beat with MORE than 1 quarter note, so your number's tens would beat 418's.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 1, comparison: "gt" }],
        explanation: "463 has more tens than 418 (6 vs. 1), so 463 is greater.",
      },
      D: {
        prompt: "Compare 732 and 719. Both have 7 hundreds, so the tens decide: 732 has 3 tens, 719 has 1 ten. Build a drum beat with FEWER than 3 quarter notes, so your number's tens would lose to 732's.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 3, comparison: "lt" }],
        explanation: "719 has fewer tens than 732 (1 vs. 3), so 719 is less.",
      },
    },
  },
  {
    slug: "math-g2-l12-hundred-more-mentally",
    grade: 2,
    lessonNumber: 12,
    title: "A Hundred More, Mentally",
    mathSkill: "Mentally Add/Subtract 100 (2.NBT.B.8)",
    teaches: "Every slot adds 100 to a three-digit number — just bump the hundreds digit up by 1 and keep the tens and ones the same.",
    bpm: 88,
    challenges: {
      A: {
        prompt: "What is 100 more than 256? Build a bass drum row of quarter notes for the hundreds, a snare row of quarter notes for the tens, and a hi-hat row of quarter notes for the ones.",
        targets: [
          { instrument: "kick", count: 3 },
          { instrument: "snare", count: 5 },
          { instrument: "hihatClosed", count: 6 },
        ],
        explanation: "100 more than 256 is 356 — the hundreds go from 2 to 3, the tens and ones stay the same.",
      },
      B: {
        prompt: "What is 100 more than 483? Build a bass drum row of quarter notes for the hundreds, a snare row of quarter notes for the tens, and a hi-hat row of quarter notes for the ones.",
        targets: [
          { instrument: "kick", count: 5 },
          { instrument: "snare", count: 8 },
          { instrument: "hihatClosed", count: 3 },
        ],
        explanation: "100 more than 483 is 583 — the hundreds go from 4 to 5.",
      },
      C: {
        prompt: "What is 100 more than 124? Build a bass drum row of quarter notes for the hundreds, a snare row of quarter notes for the tens, and a hi-hat row of quarter notes for the ones.",
        targets: [
          { instrument: "kick", count: 2 },
          { instrument: "snare", count: 2 },
          { instrument: "hihatClosed", count: 4 },
        ],
        explanation: "100 more than 124 is 224 — the hundreds go from 1 to 2.",
      },
      D: {
        prompt: "What is 100 more than 647? Build a bass drum row of quarter notes for the hundreds, a snare row of quarter notes for the tens, and a hi-hat row of quarter notes for the ones.",
        targets: [
          { instrument: "kick", count: 7 },
          { instrument: "snare", count: 4 },
          { instrument: "hihatClosed", count: 7 },
        ],
        explanation: "100 more than 647 is 747 — the hundreds go from 6 to 7.",
      },
    },
  },
  {
    slug: "math-g2-l13-building-three-digit-numbers",
    grade: 2,
    lessonNumber: 13,
    title: "Building Three-Digit Numbers",
    mathSkill: "Place Value (2.NBT.A.1)",
    teaches: "Every slot works backward from Lesson 5 — you're given the hundreds, tens, and ones, and you build the number they make.",
    bpm: 90,
    challenges: {
      A: {
        prompt: "4 hundreds, 6 tens, 8 ones make what number? Build a bass drum row of quarter notes for the hundreds, a snare row of quarter notes for the tens, and a hi-hat row of quarter notes for the ones.",
        targets: [
          { instrument: "kick", count: 4 },
          { instrument: "snare", count: 6 },
          { instrument: "hihatClosed", count: 8 },
        ],
        explanation: "4 hundreds (400) + 6 tens (60) + 8 ones = 468.",
      },
      B: {
        prompt: "7 hundreds, 2 tens, 5 ones make what number? Build a bass drum row of quarter notes for the hundreds, a snare row of quarter notes for the tens, and a hi-hat row of quarter notes for the ones.",
        targets: [
          { instrument: "kick", count: 7 },
          { instrument: "snare", count: 2 },
          { instrument: "hihatClosed", count: 5 },
        ],
        explanation: "7 hundreds (700) + 2 tens (20) + 5 ones = 725.",
      },
      C: {
        prompt: "5 hundreds, 8 tens, 2 ones make what number? Build a bass drum row of quarter notes for the hundreds, a snare row of quarter notes for the tens, and a hi-hat row of quarter notes for the ones.",
        targets: [
          { instrument: "kick", count: 5 },
          { instrument: "snare", count: 8 },
          { instrument: "hihatClosed", count: 2 },
        ],
        explanation: "5 hundreds (500) + 8 tens (80) + 2 ones = 582.",
      },
      D: {
        prompt: "3 hundreds, 4 tens, 6 ones make what number? Build a bass drum row of quarter notes for the hundreds, a snare row of quarter notes for the tens, and a hi-hat row of quarter notes for the ones.",
        targets: [
          { instrument: "kick", count: 3 },
          { instrument: "snare", count: 4 },
          { instrument: "hihatClosed", count: 6 },
        ],
        explanation: "3 hundreds (300) + 4 tens (40) + 6 ones = 346.",
      },
    },
  },
  {
    slug: "math-g2-l14-adding-a-hundred",
    grade: 2,
    lessonNumber: 14,
    title: "Adding a Hundred",
    mathSkill: "Add Within 1000 (2.NBT.B.7)",
    teaches: "Every slot is an addition equation of a three-digit number plus 100 — build the result across hundreds, tens, and ones.",
    bpm: 90,
    challenges: {
      A: {
        prompt: "275 + 100 = ? Build a bass drum row of quarter notes for the hundreds, a snare row of quarter notes for the tens, and a hi-hat row of quarter notes for the ones.",
        targets: [
          { instrument: "kick", count: 3 },
          { instrument: "snare", count: 7 },
          { instrument: "hihatClosed", count: 5 },
        ],
        explanation: "275 + 100 = 375 — 3 hundreds, 7 tens, 5 ones.",
      },
      B: {
        prompt: "418 + 100 = ? Build a bass drum row of quarter notes for the hundreds, a snare row of quarter notes for the tens, and a hi-hat row of quarter notes for the ones.",
        targets: [
          { instrument: "kick", count: 5 },
          { instrument: "snare", count: 1 },
          { instrument: "hihatClosed", count: 8 },
        ],
        explanation: "418 + 100 = 518 — 5 hundreds, 1 ten, 8 ones.",
      },
      C: {
        prompt: "562 + 100 = ? Build a bass drum row of quarter notes for the hundreds, a snare row of quarter notes for the tens, and a hi-hat row of quarter notes for the ones.",
        targets: [
          { instrument: "kick", count: 6 },
          { instrument: "snare", count: 6 },
          { instrument: "hihatClosed", count: 2 },
        ],
        explanation: "562 + 100 = 662 — 6 hundreds, 6 tens, 2 ones.",
      },
      D: {
        prompt: "248 + 100 = ? Build a bass drum row of quarter notes for the hundreds, a snare row of quarter notes for the tens, and a hi-hat row of quarter notes for the ones.",
        targets: [
          { instrument: "kick", count: 3 },
          { instrument: "snare", count: 4 },
          { instrument: "hihatClosed", count: 8 },
        ],
        explanation: "248 + 100 = 348 — 3 hundreds, 4 tens, 8 ones.",
      },
    },
  },
  {
    slug: "math-g2-l15-skip-counting-by-100s",
    grade: 2,
    lessonNumber: 15,
    title: "Skip Counting by 100s",
    mathSkill: "Counting Patterns (2.NBT.A.2)",
    teaches: "Every slot is a counting-by-100s sequence with one number missing — build how many HUNDREDS that missing number is, anywhere in the kit.",
    bpm: 90,
    challenges: {
      A: {
        prompt: "Count by 100s: 100, 200, __, 400, 500. The missing number is how many hundreds? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 3 }],
        explanation: "100, 200, 300, 400, 500 — the missing number is 300, which is 3 hundreds.",
      },
      B: {
        prompt: "Count by 100s: 200, 300, __, 500, 600. The missing number is how many hundreds? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 4 }],
        explanation: "200, 300, 400, 500, 600 — the missing number is 400, which is 4 hundreds.",
      },
      C: {
        prompt: "Count by 100s: 400, 500, __, 700, 800. The missing number is how many hundreds? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 6 }],
        explanation: "400, 500, 600, 700, 800 — the missing number is 600, which is 6 hundreds.",
      },
      D: {
        prompt: "Count by 100s: __, 200, 300. The missing number is how many hundreds? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 1 }],
        explanation: "100, 200, 300 — the missing number is 100, which is 1 hundred.",
      },
    },
  },
  {
    slug: "math-g2-l16-adding-within-1000",
    grade: 2,
    lessonNumber: 16,
    title: "Adding Within 1000",
    mathSkill: "Add Within 1000 (2.NBT.B.7)",
    teaches: "Every slot adds two three-digit numbers — the total is too big for one row, so build it across hundreds, tens, and ones.",
    bpm: 90,
    challenges: {
      A: {
        prompt: "455 + 213 = ? Build a bass drum row of quarter notes for the hundreds, a snare row of quarter notes for the tens, and a hi-hat row of quarter notes for the ones.",
        targets: [
          { instrument: "kick", count: 6 },
          { instrument: "snare", count: 6 },
          { instrument: "hihatClosed", count: 8 },
        ],
        explanation: "455 + 213 = 668 — 6 hundreds, 6 tens, 8 ones.",
      },
      B: {
        prompt: "327 + 541 = ? Build a bass drum row of quarter notes for the hundreds, a snare row of quarter notes for the tens, and a hi-hat row of quarter notes for the ones.",
        targets: [
          { instrument: "kick", count: 8 },
          { instrument: "snare", count: 6 },
          { instrument: "hihatClosed", count: 8 },
        ],
        explanation: "327 + 541 = 868 — 8 hundreds, 6 tens, 8 ones.",
      },
      C: {
        prompt: "214 + 364 = ? Build a bass drum row of quarter notes for the hundreds, a snare row of quarter notes for the tens, and a hi-hat row of quarter notes for the ones.",
        targets: [
          { instrument: "kick", count: 5 },
          { instrument: "snare", count: 7 },
          { instrument: "hihatClosed", count: 8 },
        ],
        explanation: "214 + 364 = 578 — 5 hundreds, 7 tens, 8 ones.",
      },
      D: {
        prompt: "432 + 256 = ? Build a bass drum row of quarter notes for the hundreds, a snare row of quarter notes for the tens, and a hi-hat row of quarter notes for the ones.",
        targets: [
          { instrument: "kick", count: 6 },
          { instrument: "snare", count: 8 },
          { instrument: "hihatClosed", count: 8 },
        ],
        explanation: "432 + 256 = 688 — 6 hundreds, 8 tens, 8 ones.",
      },
    },
  },
  {
    slug: "math-g2-l17-subtracting-within-1000",
    grade: 2,
    lessonNumber: 17,
    title: "Subtracting Within 1000",
    mathSkill: "Subtract Within 1000 (2.NBT.B.7)",
    teaches: "Every slot subtracts two three-digit numbers — build what's left across hundreds, tens, and ones.",
    bpm: 90,
    challenges: {
      A: {
        prompt: "728 - 315 = ? Build a bass drum row of quarter notes for the hundreds, a snare row of quarter notes for the tens, and a hi-hat row of quarter notes for the ones of what's left.",
        targets: [
          { instrument: "kick", count: 4 },
          { instrument: "snare", count: 1 },
          { instrument: "hihatClosed", count: 3 },
        ],
        explanation: "728 - 315 = 413 — 4 hundreds, 1 ten, 3 ones.",
      },
      B: {
        prompt: "869 - 427 = ? Build a bass drum row of quarter notes for the hundreds, a snare row of quarter notes for the tens, and a hi-hat row of quarter notes for the ones of what's left.",
        targets: [
          { instrument: "kick", count: 4 },
          { instrument: "snare", count: 4 },
          { instrument: "hihatClosed", count: 2 },
        ],
        explanation: "869 - 427 = 442 — 4 hundreds, 4 tens, 2 ones.",
      },
      C: {
        prompt: "654 - 231 = ? Build a bass drum row of quarter notes for the hundreds, a snare row of quarter notes for the tens, and a hi-hat row of quarter notes for the ones of what's left.",
        targets: [
          { instrument: "kick", count: 4 },
          { instrument: "snare", count: 2 },
          { instrument: "hihatClosed", count: 3 },
        ],
        explanation: "654 - 231 = 423 — 4 hundreds, 2 tens, 3 ones.",
      },
      D: {
        prompt: "593 - 271 = ? Build a bass drum row of quarter notes for the hundreds, a snare row of quarter notes for the tens, and a hi-hat row of quarter notes for the ones of what's left.",
        targets: [
          { instrument: "kick", count: 3 },
          { instrument: "snare", count: 2 },
          { instrument: "hihatClosed", count: 2 },
        ],
        explanation: "593 - 271 = 322 — 3 hundreds, 2 tens, 2 ones.",
      },
    },
  },
  {
    slug: "math-g2-l18-money-counting-coins",
    grade: 2,
    lessonNumber: 18,
    title: "Money: Counting Coins",
    mathSkill: "Counting Money (2.MD.C.8)",
    teaches: "Every slot gives you a handful of coins — add up their value in cents, then build the tens and ones of that amount.",
    bpm: 90,
    challenges: {
      A: {
        prompt: "You have 1 quarter and 5 dimes. How many cents is that? Build a bass drum row of quarter notes for the tens and a hi-hat row of quarter notes for the ones.",
        targets: [
          { instrument: "kick", count: 7 },
          { instrument: "hihatClosed", count: 5 },
        ],
        explanation: "1 quarter (25 cents) + 5 dimes (50 cents) = 75 cents — 7 tens and 5 ones.",
      },
      B: {
        prompt: "You have 1 quarter and 4 dimes. How many cents is that? Build a bass drum row of quarter notes for the tens and a hi-hat row of quarter notes for the ones.",
        targets: [
          { instrument: "kick", count: 6 },
          { instrument: "hihatClosed", count: 5 },
        ],
        explanation: "1 quarter (25 cents) + 4 dimes (40 cents) = 65 cents — 6 tens and 5 ones.",
      },
      C: {
        prompt: "You have 3 quarters and 1 dime. How many cents is that? Build a bass drum row of quarter notes for the tens and a hi-hat row of quarter notes for the ones.",
        targets: [
          { instrument: "kick", count: 8 },
          { instrument: "hihatClosed", count: 5 },
        ],
        explanation: "3 quarters (75 cents) + 1 dime (10 cents) = 85 cents — 8 tens and 5 ones.",
      },
      D: {
        prompt: "You have 4 dimes and 3 nickels. How many cents is that? Build a bass drum row of quarter notes for the tens and a hi-hat row of quarter notes for the ones.",
        targets: [
          { instrument: "kick", count: 5 },
          { instrument: "hihatClosed", count: 5 },
        ],
        explanation: "4 dimes (40 cents) + 3 nickels (15 cents) = 55 cents — 5 tens and 5 ones.",
      },
    },
  },
  {
    slug: "math-g2-l19-adding-within-200",
    grade: 2,
    lessonNumber: 19,
    title: "Adding Within 200",
    mathSkill: "Add Within 1000 (2.NBT.B.7)",
    teaches: "Every slot adds a three-digit number and a two-digit number — build the total across whichever places actually have quarter notes (skip a place if it lands on exactly 0).",
    bpm: 90,
    challenges: {
      A: {
        prompt:
          "132 + 58 = ? Build a bass drum row of quarter notes for the hundreds, and the tens digit in quarter notes spread across the snare and hi-hat rows.",
        targets: [
          { instrument: "kick", count: 1 },
          { instrument: ["snare", "hihatClosed"], count: 9 },
        ],
        explanation: "132 + 58 = 190 — 1 hundred, 9 tens, and 0 ones (nothing to build for the ones this time).",
      },
      B: {
        prompt: "145 + 37 = ? Build a bass drum row of quarter notes for the hundreds, a snare row of quarter notes for the tens, and a hi-hat row of quarter notes for the ones.",
        targets: [
          { instrument: "kick", count: 1 },
          { instrument: "snare", count: 8 },
          { instrument: "hihatClosed", count: 2 },
        ],
        explanation: "145 + 37 = 182 — 1 hundred, 8 tens, 2 ones.",
      },
      C: {
        prompt: "126 + 49 = ? Build a bass drum row of quarter notes for the hundreds, a snare row of quarter notes for the tens, and a hi-hat row of quarter notes for the ones.",
        targets: [
          { instrument: "kick", count: 1 },
          { instrument: "snare", count: 7 },
          { instrument: "hihatClosed", count: 5 },
        ],
        explanation: "126 + 49 = 175 — 1 hundred, 7 tens, 5 ones.",
      },
      D: {
        prompt: "154 + 27 = ? Build a bass drum row of quarter notes for the hundreds, a snare row of quarter notes for the tens, and a hi-hat row of quarter notes for the ones.",
        targets: [
          { instrument: "kick", count: 1 },
          { instrument: "snare", count: 8 },
          { instrument: "hihatClosed", count: 1 },
        ],
        explanation: "154 + 27 = 181 — 1 hundred, 8 tens, 1 one.",
      },
    },
  },
  {
    slug: "math-g2-l20-subtracting-across-hundreds",
    grade: 2,
    lessonNumber: 20,
    title: "Subtracting Across Hundreds",
    mathSkill: "Subtract Within 1000 (2.NBT.B.7)",
    teaches: "Every slot subtracts from a round hundred — build what's left across hundreds, tens, and ones.",
    bpm: 90,
    challenges: {
      A: {
        prompt: "500 - 275 = ? Build a bass drum row of quarter notes for the hundreds, a snare row of quarter notes for the tens, and a hi-hat row of quarter notes for the ones of what's left.",
        targets: [
          { instrument: "kick", count: 2 },
          { instrument: "snare", count: 2 },
          { instrument: "hihatClosed", count: 5 },
        ],
        explanation: "500 - 275 = 225 — 2 hundreds, 2 tens, 5 ones.",
      },
      B: {
        prompt: "600 - 384 = ? Build a bass drum row of quarter notes for the hundreds, a snare row of quarter notes for the tens, and a hi-hat row of quarter notes for the ones of what's left.",
        targets: [
          { instrument: "kick", count: 2 },
          { instrument: "snare", count: 1 },
          { instrument: "hihatClosed", count: 6 },
        ],
        explanation: "600 - 384 = 216 — 2 hundreds, 1 ten, 6 ones.",
      },
      C: {
        prompt: "800 - 567 = ? Build a bass drum row of quarter notes for the hundreds, a snare row of quarter notes for the tens, and a hi-hat row of quarter notes for the ones of what's left.",
        targets: [
          { instrument: "kick", count: 2 },
          { instrument: "snare", count: 3 },
          { instrument: "hihatClosed", count: 3 },
        ],
        explanation: "800 - 567 = 233 — 2 hundreds, 3 tens, 3 ones.",
      },
      D: {
        prompt: "700 - 458 = ? Build a bass drum row of quarter notes for the hundreds, a snare row of quarter notes for the tens, and a hi-hat row of quarter notes for the ones of what's left.",
        targets: [
          { instrument: "kick", count: 2 },
          { instrument: "snare", count: 4 },
          { instrument: "hihatClosed", count: 2 },
        ],
        explanation: "700 - 458 = 242 — 2 hundreds, 4 tens, 2 ones.",
      },
    },
  },
  {
    slug: "math-g2-l21-telling-time-to-the-half-hour",
    grade: 2,
    lessonNumber: 21,
    title: "Telling Time to the Half Hour",
    mathSkill: "Telling Time (2.MD.C.7)",
    teaches: "Every slot describes a clock's hands — build the hour on the bass drum, and add 1 quarter note on the snare only if it's the half hour, not the hour exactly.",
    bpm: 90,
    challenges: {
      A: {
        prompt: "The hour hand is between 7 and 8, and the minute hand points to 6 — that's half past 7, or 7:30. Build a bass drum row of quarter notes for the hour (7), and a snare row with 1 quarter note to show it's the half hour.",
        targets: [
          { instrument: "kick", count: 7 },
          { instrument: "snare", count: 1 },
        ],
        explanation: "Hour hand between 7 and 8, minute hand on 6, means 7:30 — half past 7.",
      },
      B: {
        prompt: "The hour hand points exactly to 6, and the minute hand points to 12 — that's 6:00. Build a bass drum row of quarter notes for the hour.",
        targets: [{ instrument: "kick", count: 6 }],
        explanation: "Hour hand on 6, minute hand on 12, means 6:00 exactly — no half-hour marker needed.",
      },
      C: {
        prompt: "The hour hand is between 2 and 3, and the minute hand points to 6 — that's half past 2, or 2:30. Build a bass drum row of quarter notes for the hour (2), and a snare row with 1 quarter note to show it's the half hour.",
        targets: [
          { instrument: "kick", count: 2 },
          { instrument: "snare", count: 1 },
        ],
        explanation: "Hour hand between 2 and 3, minute hand on 6, means 2:30 — half past 2.",
      },
      D: {
        prompt: "The hour hand points exactly to 5, and the minute hand points to 12 — that's 5:00. Build a bass drum row of quarter notes for the hour.",
        targets: [{ instrument: "kick", count: 5 }],
        explanation: "Hour hand on 5, minute hand on 12, means 5:00 exactly.",
      },
    },
  },
  {
    slug: "math-g2-l22-comparing-lengths-and-differences",
    grade: 2,
    lessonNumber: 22,
    title: "Comparing Lengths & Finding the Difference",
    mathSkill: "Measurement Word Problems (2.MD.A.4)",
    teaches: "Every slot gives you two lengths — build both, on two different instruments, plus a third row with the difference between them.",
    bpm: 90,
    challenges: {
      A: {
        prompt: "A pencil is 7 inches long and a crayon is 3 inches long. Build a bass drum row of quarter notes for the pencil, a snare row of quarter notes for the crayon, and a hi-hat row of quarter notes for how much longer the pencil is.",
        targets: [
          { instrument: "kick", count: 7 },
          { instrument: "snare", count: 3 },
          { instrument: "hihatClosed", count: 4 },
        ],
        explanation: "7 - 3 = 4 — the pencil is 4 inches longer than the crayon.",
      },
      B: {
        prompt: "A marker is 8 inches long and an eraser is 3 inches long. Build a bass drum row of quarter notes for the marker, a snare row of quarter notes for the eraser, and a hi-hat row of quarter notes for the difference.",
        targets: [
          { instrument: "kick", count: 8 },
          { instrument: "snare", count: 3 },
          { instrument: "hihatClosed", count: 5 },
        ],
        explanation: "8 - 3 = 5 — the marker is 5 inches longer.",
      },
      C: {
        prompt: "A ribbon is 8 inches long and a bead is 1 inch long. Build a bass drum row of quarter notes for the ribbon, a snare row of quarter notes for the bead, and a hi-hat row of quarter notes for the difference.",
        targets: [
          { instrument: "kick", count: 8 },
          { instrument: "snare", count: 1 },
          { instrument: "hihatClosed", count: 7 },
        ],
        explanation: "8 - 1 = 7 — the ribbon is 7 inches longer.",
      },
      D: {
        prompt: "A pencil is 8 inches long and a crayon is 5 inches long. Build a bass drum row of quarter notes for the pencil, a snare row of quarter notes for the crayon, and a hi-hat row of quarter notes for the difference.",
        targets: [
          { instrument: "kick", count: 8 },
          { instrument: "snare", count: 5 },
          { instrument: "hihatClosed", count: 3 },
        ],
        explanation: "8 - 5 = 3 — the pencil is 3 inches longer.",
      },
    },
  },
  {
    slug: "math-g2-l23-fractions-thirds",
    grade: 2,
    lessonNumber: 23,
    title: "Fractions: Thirds",
    mathSkill: "Partitioning into Thirds (2.G.A.3)",
    teaches: "Every slot splits something into 3 equal shares — thirds are always 3 pieces, no matter what you split. Build that many quarter notes anywhere in the kit.",
    bpm: 90,
    challenges: {
      A: {
        prompt: "If you divide a rectangle into 3 equal parts, what do we call each part, and how many parts are there? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 3 }],
        explanation: "Splitting into 3 equal shares makes thirds — 3 pieces.",
      },
      B: {
        prompt: "If you divide a chocolate bar into 3 equal parts (thirds), how many parts are there? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 3 }],
        explanation: "Thirds means 3 equal parts.",
      },
      C: {
        prompt: "If you divide a garden bed into 3 equal parts (thirds), how many parts are there? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 3 }],
        explanation: "Thirds means 3 equal parts.",
      },
      D: {
        prompt: "If you divide a ribbon into 3 equal parts (thirds), how many parts are there? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 3 }],
        explanation: "Thirds means 3 equal parts.",
      },
    },
  },
  {
    slug: "math-g2-l24-reading-bar-graphs",
    grade: 2,
    lessonNumber: 24,
    title: "Reading Bar Graphs",
    mathSkill: "Representing & Interpreting Data (2.MD.D.10)",
    teaches: "Every slot describes a bar graph with three categories — build one row per category, matching its bar's height exactly.",
    bpm: 90,
    challenges: {
      A: {
        prompt: "A bar graph shows favorite fruits: Apples — 5, Bananas — 3, Grapes — 7. Build a bass drum row of quarter notes for apples, a snare row of quarter notes for bananas, and a hi-hat row of quarter notes for grapes.",
        targets: [
          { instrument: "kick", count: 5 },
          { instrument: "snare", count: 3 },
          { instrument: "hihatClosed", count: 7 },
        ],
        explanation: "Grapes had the most votes (7); grapes beat bananas by 7 - 3 = 4.",
      },
      B: {
        prompt: "A bar graph shows favorite pets: Dogs — 4, Cats — 6, Fish — 2. Build a bass drum row of quarter notes for dogs, a snare row of quarter notes for cats, and a hi-hat row of quarter notes for fish.",
        targets: [
          { instrument: "kick", count: 4 },
          { instrument: "snare", count: 6 },
          { instrument: "hihatClosed", count: 2 },
        ],
        explanation: "Cats had the most votes (6); cats beat fish by 6 - 2 = 4.",
      },
      C: {
        prompt: "A bar graph shows favorite colors: Red — 8, Blue — 5, Green — 3. Build a bass drum row of quarter notes for red, a snare row of quarter notes for blue, and a hi-hat row of quarter notes for green.",
        targets: [
          { instrument: "kick", count: 8 },
          { instrument: "snare", count: 5 },
          { instrument: "hihatClosed", count: 3 },
        ],
        explanation: "Red had the most votes (8); red beat green by 8 - 3 = 5.",
      },
      D: {
        prompt: "A bar graph shows favorite sports: Soccer — 6, Basketball — 8, Tennis — 4. Build a bass drum row of quarter notes for soccer, a snare row of quarter notes for basketball, and a hi-hat row of quarter notes for tennis.",
        targets: [
          { instrument: "kick", count: 6 },
          { instrument: "snare", count: 8 },
          { instrument: "hihatClosed", count: 4 },
        ],
        explanation: "Basketball had the most votes (8); basketball beat tennis by 8 - 4 = 4.",
      },
    },
  },

  // ============================================================
  // GRADE 3 — multiplication and division take over as the year's backbone
  // (equal groups and facts in the fall, fact families and rounding into
  // winter, fractions in early spring, time/area/perimeter/measurement/data
  // through mid and late spring), the real Common Core Grade 3 progression.
  // Answers lean harder into sounding like an actual groove than earlier
  // grades did: wherever a problem naturally splits into two or three real
  // parts (a sum's hundreds/tens/ones, a fact family's two factors, a
  // graph's separate categories), each part gets its own instrument instead
  // of one row of isolated hits — kick holding the steady pulse, snare
  // answering it, hi-hat filling in when a third part is needed. Still just
  // one idea and one clear instrument for single-fact lessons, the same
  // "simple where the skill itself is simple" rule every earlier grade
  // followed.
  // ============================================================
  {
    slug: "math-g3-l01-multiplication-as-equal-groups",
    grade: 3,
    lessonNumber: 1,
    title: "Multiplication as Equal Groups",
    mathSkill: "Multiplication as Equal Groups (3.OA.A.1)",
    teaches: "Every slot shows equal groups — the number of groups is how many BLOCKS you use, and the group size is about how many notes go in each one. Build the total across exactly that many blocks, anywhere in the kit, in any rhythm you like — a groove literally shaped like the multiplication.",
    bpm: 90,
    challenges: {
      A: {
        prompt: "3 groups of 2 apples each. How many apples in all? Build a drum beat using exactly 3 blocks that add up to 6 notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 6, blocksUsed: 3 }],
        explanation: "3 groups of 2 is 3 × 2 = 6 — 3 blocks (the groups) holding 6 notes in all.",
      },
      B: {
        prompt: "4 groups of 2 stars each. How many stars in all? Build a drum beat using exactly 4 blocks that add up to 8 notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 8, blocksUsed: 4 }],
        explanation: "4 groups of 2 is 4 × 2 = 8 — 4 blocks holding 8 notes in all.",
      },
      C: {
        prompt: "2 groups of 3 drums each. How many drums in all? Build a drum beat using exactly 2 blocks that add up to 6 notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 6, blocksUsed: 2 }],
        explanation: "2 groups of 3 is 2 × 3 = 6 — 2 blocks holding 6 notes in all.",
      },
      D: {
        prompt: "2 groups of 4 beads each. How many beads in all? Build a drum beat using exactly 2 blocks that add up to 8 notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 8, blocksUsed: 2 }],
        explanation: "2 groups of 4 is 2 × 4 = 8 — 2 blocks holding 8 notes in all.",
      },
    },
  },
  {
    slug: "math-g3-l02-multiplication-facts",
    grade: 3,
    lessonNumber: 2,
    title: "Multiplication Facts",
    mathSkill: "Multiplication Facts (3.OA.C.7)",
    teaches: "Every slot is a multiplication fact — the first number is how many BLOCKS you use, the second is about how many notes go in each one. Build the total across exactly that many blocks, anywhere in the kit.",
    bpm: 90,
    challenges: {
      A: {
        prompt: "4 × 2 = ? Build a drum beat using exactly 4 blocks that add up to 8 notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 8, blocksUsed: 4 }],
        explanation: "4 × 2 = 8 — 4 blocks holding 8 notes in all.",
      },
      B: {
        prompt: "3 × 2 = ? Build a drum beat using exactly 3 blocks that add up to 6 notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 6, blocksUsed: 3 }],
        explanation: "3 × 2 = 6 — 3 blocks holding 6 notes in all.",
      },
      C: {
        prompt: "5 × 3 = ? Build a drum beat using exactly 5 blocks that add up to 15 notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 15, blocksUsed: 5 }],
        explanation: "5 × 3 = 15 — 5 blocks holding 15 notes in all.",
      },
      D: {
        prompt: "2 × 4 = ? Build a drum beat using exactly 2 blocks that add up to 8 notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 8, blocksUsed: 2 }],
        explanation: "2 × 4 = 8 — 2 blocks holding 8 notes in all.",
      },
    },
  },
  {
    slug: "math-g3-l03-division-as-equal-groups",
    grade: 3,
    lessonNumber: 3,
    title: "Division as Equal Groups",
    mathSkill: "Division as Equal Groups (3.OA.A.2)",
    teaches: "Every slot splits a total into equal groups — the number of groups is how many BLOCKS you use (one per bag, cup, or friend); build the whole total across exactly that many blocks, however you like to subdivide within them.",
    bpm: 90,
    challenges: {
      A: {
        prompt: "12 cookies split evenly into 3 bags. How many cookies in each bag? Build a drum beat using exactly 3 blocks (one per bag) that add up to 12 notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 12, blocksUsed: 3 }],
        explanation: "12 ÷ 3 = 4 — 3 blocks (bags), 4 in each, 12 in all.",
      },
      B: {
        prompt: "15 stickers split evenly among 5 friends. How many stickers does each friend get? Build a drum beat using exactly 5 blocks (one per friend) that add up to 15 notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 15, blocksUsed: 5 }],
        explanation: "15 ÷ 5 = 3 — 5 blocks (friends), 3 in each, 15 in all.",
      },
      C: {
        prompt: "16 pencils split evenly into 4 cups. How many pencils in each cup? Build a drum beat using exactly 4 blocks (one per cup) that add up to 16 notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 16, blocksUsed: 4 }],
        explanation: "16 ÷ 4 = 4 — 4 blocks (cups), 4 in each, 16 in all.",
      },
      D: {
        prompt: "18 grapes split evenly into 3 bowls. How many grapes in each bowl? Build a drum beat using exactly 3 blocks (one per bowl) that add up to 18 notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 18, blocksUsed: 3 }],
        explanation: "18 ÷ 3 = 6 — 3 blocks (bowls), 6 in each, 18 in all.",
      },
    },
  },
  {
    slug: "math-g3-l04-multiplication-and-division-fact-families",
    grade: 3,
    lessonNumber: 4,
    title: "Multiplication & Division Fact Families",
    mathSkill: "Related Facts (3.OA.B.6)",
    teaches: "Every slot gives a multiplication fact, then asks for its related division fact — build the two factors on two different instruments, a steady pulse for one and an answering hit for the other, the two parts that make up the product.",
    bpm: 90,
    challenges: {
      A: {
        prompt: "If 4 × 3 = 12, what is 12 ÷ 3? Build a bass drum row with 4 quarter notes and a snare drum row with 3 quarter notes — the two factors of the 4, 3, 12 fact family.",
        targets: [
          { instrument: "kick", count: 4 },
          { instrument: "snare", count: 3 },
        ],
        explanation: "12 ÷ 3 = 4 — the same three numbers work for multiplication and division (4×3=12, 3×4=12, 12÷3=4, 12÷4=3).",
      },
      B: {
        prompt: "If 5 × 2 = 10, what is 10 ÷ 2? Build a bass drum row with 5 quarter notes and a snare drum row with 2 quarter notes.",
        targets: [
          { instrument: "kick", count: 5 },
          { instrument: "snare", count: 2 },
        ],
        explanation: "10 ÷ 2 = 5.",
      },
      C: {
        prompt: "If 6 × 3 = 18, what is 18 ÷ 3? Build a hi-hat row with 6 quarter notes and a bass drum row with 3 quarter notes.",
        targets: [
          { instrument: "hihatClosed", count: 6 },
          { instrument: "kick", count: 3 },
        ],
        explanation: "18 ÷ 3 = 6.",
      },
      D: {
        prompt: "If 7 × 2 = 14, what is 14 ÷ 2? Build a bass drum row with 7 quarter notes and a snare drum row with 2 quarter notes.",
        targets: [
          { instrument: "kick", count: 7 },
          { instrument: "snare", count: 2 },
        ],
        explanation: "14 ÷ 2 = 7.",
      },
    },
  },
  {
    slug: "math-g3-l05-rounding-to-the-nearest-ten",
    grade: 3,
    lessonNumber: 5,
    title: "Rounding to the Nearest Ten",
    mathSkill: "Rounding to the Nearest 10 (3.NBT.A.1)",
    teaches: "Every slot rounds a number to the nearest ten — since a rounded number is too big to count one at a time, build how many TENS it is instead, anywhere in the kit.",
    bpm: 90,
    challenges: {
      A: {
        prompt: "Round 34 to the nearest ten. How many tens is that? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 3 }],
        explanation: "34 rounds to 30, which is 3 tens.",
      },
      B: {
        prompt: "Round 68 to the nearest ten. How many tens is that? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 7 }],
        explanation: "68 rounds to 70, which is 7 tens.",
      },
      C: {
        prompt: "Round 22 to the nearest ten. How many tens is that? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 2 }],
        explanation: "22 rounds to 20, which is 2 tens.",
      },
      D: {
        prompt: "Round 55 to the nearest ten. How many tens is that? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 6 }],
        explanation: "55 rounds to 60 (round up at the halfway point), which is 6 tens.",
      },
    },
  },
  {
    slug: "math-g3-l06-rounding-to-the-nearest-hundred",
    grade: 3,
    lessonNumber: 6,
    title: "Rounding to the Nearest Hundred",
    mathSkill: "Rounding to the Nearest 100 (3.NBT.A.1)",
    teaches: "Every slot rounds a number to the nearest hundred — build how many HUNDREDS that rounded number is, anywhere in the kit.",
    bpm: 90,
    challenges: {
      A: {
        prompt: "Round 340 to the nearest hundred. How many hundreds is that? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 3 }],
        explanation: "340 rounds to 300, which is 3 hundreds.",
      },
      B: {
        prompt: "Round 680 to the nearest hundred. How many hundreds is that? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 7 }],
        explanation: "680 rounds to 700, which is 7 hundreds.",
      },
      C: {
        prompt: "Round 150 to the nearest hundred. How many hundreds is that? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 2 }],
        explanation: "150 rounds to 200 (round up at the halfway point), which is 2 hundreds.",
      },
      D: {
        prompt: "Round 420 to the nearest hundred. How many hundreds is that? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 4 }],
        explanation: "420 rounds to 400, which is 4 hundreds.",
      },
    },
  },
  {
    slug: "math-g3-l07-adding-within-1000",
    grade: 3,
    lessonNumber: 7,
    title: "Adding Within 1,000",
    mathSkill: "Add Within 1,000 (3.NBT.A.2)",
    teaches: "Every slot adds two numbers within 1,000 — since the sum is too big to build directly, build its hundreds, tens, and ones on three different instruments: kick holding the pulse, snare answering, hi-hat keeping steady time underneath.",
    bpm: 92,
    challenges: {
      A: {
        prompt: "213 + 154 = ? Build a bass drum row of quarter notes for the hundreds, a snare row for the tens, and a hi-hat row for the ones.",
        targets: [
          { instrument: "kick", count: 3 },
          { instrument: "snare", count: 6 },
          { instrument: "hihatClosed", count: 7 },
        ],
        explanation: "213 + 154 = 367 = 3 hundreds + 6 tens + 7 ones.",
      },
      B: {
        prompt: "341 + 232 = ? Build a bass drum row of quarter notes for the hundreds, a snare row for the tens, and a hi-hat row for the ones.",
        targets: [
          { instrument: "kick", count: 5 },
          { instrument: "snare", count: 7 },
          { instrument: "hihatClosed", count: 3 },
        ],
        explanation: "341 + 232 = 573 = 5 hundreds + 7 tens + 3 ones.",
      },
      C: {
        prompt: "125 + 143 = ? Build a bass drum row of quarter notes for the hundreds, a snare row for the tens, and a hi-hat row for the ones.",
        targets: [
          { instrument: "kick", count: 2 },
          { instrument: "snare", count: 6 },
          { instrument: "hihatClosed", count: 8 },
        ],
        explanation: "125 + 143 = 268 = 2 hundreds + 6 tens + 8 ones.",
      },
      D: {
        prompt: "431 + 124 = ? Build a bass drum row of quarter notes for the hundreds, a snare row for the tens, and a hi-hat row for the ones.",
        targets: [
          { instrument: "kick", count: 5 },
          { instrument: "snare", count: 5 },
          { instrument: "hihatClosed", count: 5 },
        ],
        explanation: "431 + 124 = 555 = 5 hundreds + 5 tens + 5 ones.",
      },
    },
  },
  {
    slug: "math-g3-l08-subtracting-within-1000",
    grade: 3,
    lessonNumber: 8,
    title: "Subtracting Within 1,000",
    mathSkill: "Subtract Within 1,000 (3.NBT.A.2)",
    teaches: "Every slot subtracts within 1,000 — build the difference's hundreds, tens, and ones on three different instruments.",
    bpm: 92,
    challenges: {
      A: {
        prompt: "578 - 245 = ? Build a bass drum row of quarter notes for the hundreds, a snare row for the tens, and a hi-hat row for the ones.",
        targets: [
          { instrument: "kick", count: 3 },
          { instrument: "snare", count: 3 },
          { instrument: "hihatClosed", count: 3 },
        ],
        explanation: "578 - 245 = 333 = 3 hundreds + 3 tens + 3 ones.",
      },
      B: {
        prompt: "864 - 522 = ? Build a bass drum row of quarter notes for the hundreds, a snare row for the tens, and a hi-hat row for the ones.",
        targets: [
          { instrument: "kick", count: 3 },
          { instrument: "snare", count: 4 },
          { instrument: "hihatClosed", count: 2 },
        ],
        explanation: "864 - 522 = 342 = 3 hundreds + 4 tens + 2 ones.",
      },
      C: {
        prompt: "786 - 432 = ? Build a bass drum row of quarter notes for the hundreds, a snare row for the tens, and a hi-hat row for the ones.",
        targets: [
          { instrument: "kick", count: 3 },
          { instrument: "snare", count: 5 },
          { instrument: "hihatClosed", count: 4 },
        ],
        explanation: "786 - 432 = 354 = 3 hundreds + 5 tens + 4 ones.",
      },
      D: {
        prompt: "927 - 504 = ? Build a bass drum row of quarter notes for the hundreds, a snare row for the tens, and a hi-hat row for the ones.",
        targets: [
          { instrument: "kick", count: 4 },
          { instrument: "snare", count: 2 },
          { instrument: "hihatClosed", count: 3 },
        ],
        explanation: "927 - 504 = 423 = 4 hundreds + 2 tens + 3 ones.",
      },
    },
  },
  {
    slug: "math-g3-l09-multiplying-by-multiples-of-ten",
    grade: 3,
    lessonNumber: 9,
    title: "Multiplying by Multiples of Ten",
    mathSkill: "Multiply by Multiples of 10 (3.NBT.A.3)",
    teaches: "Every slot multiplies a single digit by a multiple of ten — multiply the digits first, then remember the answer is that many TENS, and build how many tens it is, anywhere in the kit.",
    bpm: 92,
    challenges: {
      A: {
        prompt: "3 × 20 = ? Build a drum beat with how many TENS are in the answer.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 6 }],
        explanation: "3 × 20 = 3 × 2 tens = 6 tens (60).",
      },
      B: {
        prompt: "4 × 20 = ? Build a drum beat with how many TENS are in the answer.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 8 }],
        explanation: "4 × 20 = 4 × 2 tens = 8 tens (80).",
      },
      C: {
        prompt: "2 × 30 = ? Build a drum beat with how many TENS are in the answer.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 6 }],
        explanation: "2 × 30 = 2 × 3 tens = 6 tens (60).",
      },
      D: {
        prompt: "4 × 10 = ? Build a drum beat with how many TENS are in the answer.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 4 }],
        explanation: "4 × 10 = 4 tens (40).",
      },
    },
  },
  {
    slug: "math-g3-l10-two-step-word-problems",
    grade: 3,
    lessonNumber: 10,
    title: "Two-Step Word Problems",
    mathSkill: "Two-Step Word Problems (3.OA.D.8)",
    teaches: "Every slot takes two steps to solve — do the first operation, then use that answer for the second, and build the final total anywhere in the kit.",
    bpm: 92,
    challenges: {
      A: {
        prompt: "Maya has 3 bags of 4 marbles each. She gives away 5 marbles. How many marbles does she have left? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 7 }],
        explanation: "3 × 4 = 12, then 12 - 5 = 7.",
      },
      B: {
        prompt:
          "A shelf has 4 rows of 3 books each. 2 more books are added. How many books in all? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 14 }],
        explanation: "4 × 3 = 12, then 12 + 2 = 14.",
      },
      C: {
        prompt: "Tom buys 2 packs of 4 pencils each. He loses 3 pencils. How many pencils does he have left? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 5 }],
        explanation: "2 × 4 = 8, then 8 - 3 = 5.",
      },
      D: {
        prompt:
          "A garden has 3 rows of 4 flowers each. 3 more flowers are planted. How many flowers in all? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 15 }],
        explanation: "3 × 4 = 12, then 12 + 3 = 15.",
      },
    },
  },
  {
    slug: "math-g3-l11-properties-of-multiplication",
    grade: 3,
    lessonNumber: 11,
    title: "Properties of Multiplication",
    mathSkill: "Properties of Multiplication (3.OA.B.5)",
    teaches: "Every slot shows the same two numbers multiplied in a different order — multiplication gives the same answer either way (the commutative property), so build the shared product anywhere in the kit.",
    bpm: 92,
    challenges: {
      A: {
        prompt: "2 × 4 and 4 × 2 — both equal how many? Build a drum beat with that shared answer, in quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 8 }],
        explanation: "2×4=8 and 4×2=8 — multiplication order doesn't change the answer (the commutative property).",
      },
      B: {
        prompt: "3 × 2 and 2 × 3 — both equal how many? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 6 }],
        explanation: "3×2=6 and 2×3=6.",
      },
      C: {
        prompt: "4 × 2 and 2 × 4 — both equal how many? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 8 }],
        explanation: "4×2=8 and 2×4=8.",
      },
      D: {
        prompt: "1 × 6 and 6 × 1 — both equal how many? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 6 }],
        explanation: "1×6=6 and 6×1=6.",
      },
    },
  },
  {
    slug: "math-g3-l12-unit-fractions",
    grade: 3,
    lessonNumber: 12,
    title: "Unit Fractions",
    mathSkill: "Unit Fractions (3.NF.A.1)",
    teaches: "Every slot shows a shape split into equal parts — the denominator is how many equal parts make the whole; build that many quarter notes anywhere in the kit, one for each part.",
    bpm: 94,
    challenges: {
      A: {
        prompt: "A pizza is cut into 4 equal slices. How many equal parts make the whole pizza? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 4 }],
        explanation: "The denominator, 4, is how many equal parts make the whole.",
      },
      B: {
        prompt: "A candy bar is split into 6 equal pieces. How many equal parts make the whole bar? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 6 }],
        explanation: "The denominator, 6, is how many equal parts make the whole.",
      },
      C: {
        prompt: "A pan of brownies is cut into 8 equal squares. How many equal parts make the whole pan? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 8 }],
        explanation: "The denominator, 8, is how many equal parts make the whole.",
      },
      D: {
        prompt: "A garden is split into 3 equal sections. How many equal parts make the whole garden? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 3 }],
        explanation: "The denominator, 3, is how many equal parts make the whole.",
      },
    },
  },
  {
    slug: "math-g3-l13-fractions-on-a-number-line",
    grade: 3,
    lessonNumber: 13,
    title: "Fractions on a Number Line",
    mathSkill: "Fractions on a Number Line (3.NF.A.2)",
    teaches: "Every slot places a fraction on a number line split into equal parts — the numerator is how many of those equal steps you land on; build that many quarter notes anywhere in the kit.",
    bpm: 94,
    challenges: {
      A: {
        prompt: "On a number line split into 4 equal parts between 0 and 1, where does 3/4 land? Build a drum beat with that many quarter notes — the numerator.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 3 }],
        explanation: "3/4 lands after 3 of the 4 equal steps.",
      },
      B: {
        prompt: "On a number line split into 6 equal parts between 0 and 1, where does 5/6 land? Build a drum beat with that many quarter notes — the numerator.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 5 }],
        explanation: "5/6 lands after 5 of the 6 equal steps.",
      },
      C: {
        prompt: "On a number line split into 8 equal parts between 0 and 1, where does 7/8 land? Build a drum beat with that many quarter notes — the numerator.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 7 }],
        explanation: "7/8 lands after 7 of the 8 equal steps.",
      },
      D: {
        prompt: "On a number line split into 3 equal parts between 0 and 1, where does 2/3 land? Build a drum beat with that many quarter notes — the numerator.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 2 }],
        explanation: "2/3 lands after 2 of the 3 equal steps.",
      },
    },
  },
  {
    slug: "math-g3-l14-equivalent-fractions",
    grade: 3,
    lessonNumber: 14,
    title: "Equivalent Fractions",
    mathSkill: "Equivalent Fractions (3.NF.A.3a-b)",
    teaches: "Every slot shows two fractions that name the same amount — build each one's numerator on its own instrument, kick and snare answering each other, so you can see both point at the same amount.",
    bpm: 94,
    challenges: {
      A: {
        prompt: "1/2 and 2/4 name the same amount. Build a bass drum row with the numerator of 1/2 and a snare drum row with the numerator of 2/4.",
        targets: [
          { instrument: "kick", count: 1 },
          { instrument: "snare", count: 2 },
        ],
        explanation: "1/2 = 2/4 — both name the same amount, just cut into different-sized equal parts.",
      },
      B: {
        prompt: "2/3 and 4/6 name the same amount. Build a bass drum row with the numerator of 2/3 and a snare drum row with the numerator of 4/6.",
        targets: [
          { instrument: "kick", count: 2 },
          { instrument: "snare", count: 4 },
        ],
        explanation: "2/3 = 4/6.",
      },
      C: {
        prompt: "1/4 and 2/8 name the same amount. Build a hi-hat row with the numerator of 1/4 and a bass drum row with the numerator of 2/8.",
        targets: [
          { instrument: "hihatClosed", count: 1 },
          { instrument: "kick", count: 2 },
        ],
        explanation: "1/4 = 2/8.",
      },
      D: {
        prompt: "3/4 and 6/8 name the same amount. Build a snare drum row with the numerator of 3/4 and a hi-hat row with the numerator of 6/8.",
        targets: [
          { instrument: "snare", count: 3 },
          { instrument: "hihatClosed", count: 6 },
        ],
        explanation: "3/4 = 6/8.",
      },
    },
  },
  {
    slug: "math-g3-l15-comparing-fractions",
    grade: 3,
    lessonNumber: 15,
    title: "Comparing Fractions",
    mathSkill: "Comparing Fractions (3.NF.A.3d)",
    teaches: "Every slot compares two fractions that share a numerator or denominator — figure out which is bigger, then build only that fraction's numerator, anywhere in the kit.",
    bpm: 94,
    challenges: {
      A: {
        prompt: "Which is bigger: 3/8 or 5/8? Build a drum beat with the BIGGER fraction's numerator, in quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 5 }],
        explanation: "Same denominator, so compare numerators: 5/8 > 3/8.",
      },
      B: {
        prompt: "Which is bigger: 2/3 or 2/5? Build a drum beat with the BIGGER fraction's numerator, in quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 2 }],
        explanation: "Same numerator, so compare denominators: fewer, bigger pieces win — 2/3 > 2/5.",
      },
      C: {
        prompt: "Which is bigger: 4/6 or 4/8? Build a drum beat with the BIGGER fraction's numerator, in quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 4 }],
        explanation: "Same numerator — 4/6 > 4/8 (sixths are bigger pieces than eighths).",
      },
      D: {
        prompt: "Which is bigger: 3/4 or 1/4? Build a drum beat with the BIGGER fraction's numerator, in quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 3 }],
        explanation: "Same denominator — 3/4 > 1/4.",
      },
    },
  },
  {
    slug: "math-g3-l16-telling-time-to-the-minute",
    grade: 3,
    lessonNumber: 16,
    title: "Telling Time to the Minute",
    mathSkill: "Telling Time to the Minute (3.MD.A.1)",
    teaches: "Every slot gives a clock time — build the hour on the kick and the minutes past the hour, in groups of 5, on the hi-hat, one hit per five minutes.",
    bpm: 94,
    challenges: {
      A: {
        prompt: "The clock shows 3:15. Build a bass drum row with the hour, in quarter notes, and a hi-hat row with the minutes, in groups of 5.",
        targets: [
          { instrument: "kick", count: 3 },
          { instrument: "hihatClosed", count: 3 },
        ],
        explanation: "3:15 is 3 o'clock plus 15 minutes, which is 3 groups of 5.",
      },
      B: {
        prompt: "The clock shows 6:30. Build a bass drum row with the hour, in quarter notes, and a hi-hat row with the minutes, in groups of 5.",
        targets: [
          { instrument: "kick", count: 6 },
          { instrument: "hihatClosed", count: 6 },
        ],
        explanation: "6:30 is 6 o'clock plus 30 minutes, which is 6 groups of 5.",
      },
      C: {
        prompt: "The clock shows 2:40. Build a bass drum row with the hour, in quarter notes, and a hi-hat row with the minutes, in groups of 5.",
        targets: [
          { instrument: "kick", count: 2 },
          { instrument: "hihatClosed", count: 8 },
        ],
        explanation: "2:40 is 2 o'clock plus 40 minutes, which is 8 groups of 5.",
      },
      D: {
        prompt: "The clock shows 5:10. Build a bass drum row with the hour, in quarter notes, and a hi-hat row with the minutes, in groups of 5.",
        targets: [
          { instrument: "kick", count: 5 },
          { instrument: "hihatClosed", count: 2 },
        ],
        explanation: "5:10 is 5 o'clock plus 10 minutes, which is 2 groups of 5.",
      },
    },
  },
  {
    slug: "math-g3-l17-elapsed-time",
    grade: 3,
    lessonNumber: 17,
    title: "Elapsed Time",
    mathSkill: "Elapsed Time (3.MD.A.1)",
    teaches: "Every slot gives a start and end time — figure out how many minutes passed, then build that many in groups of 5, anywhere in the kit, one hit per five minutes gone by.",
    bpm: 94,
    challenges: {
      A: {
        prompt: "A movie starts at 2:00 and ends at 2:25. How many minutes long is it? Build a drum beat with that many groups of 5.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 5 }],
        explanation: "2:00 to 2:25 is 25 minutes = 5 groups of 5.",
      },
      B: {
        prompt: "Recess starts at 10:00 and ends at 10:15. How many minutes long is it? Build a drum beat with that many groups of 5.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 3 }],
        explanation: "10:00 to 10:15 is 15 minutes = 3 groups of 5.",
      },
      C: {
        prompt: "A class starts at 1:00 and ends at 1:40. How many minutes long is it? Build a drum beat with that many groups of 5.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 8 }],
        explanation: "1:00 to 1:40 is 40 minutes = 8 groups of 5.",
      },
      D: {
        prompt: "A game starts at 4:00 and ends at 4:20. How many minutes long is it? Build a drum beat with that many groups of 5.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 4 }],
        explanation: "4:00 to 4:20 is 20 minutes = 4 groups of 5.",
      },
    },
  },
  {
    slug: "math-g3-l18-area-counting-unit-squares",
    grade: 3,
    lessonNumber: 18,
    title: "Area: Counting Unit Squares",
    mathSkill: "Area by Counting Unit Squares (3.MD.C.5-6)",
    teaches: "Every slot shows a rectangle covered edge to edge by unit squares — count them one at a time (its area), and build that many quarter notes anywhere in the kit.",
    bpm: 94,
    challenges: {
      A: {
        prompt: "A rectangle is covered by 6 unit squares. What is its area? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 6 }],
        explanation: "Counting the unit squares one at a time gives an area of 6.",
      },
      B: {
        prompt: "A rectangle is covered by 8 unit squares. What is its area? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 8 }],
        explanation: "Counting the unit squares one at a time gives an area of 8.",
      },
      C: {
        prompt: "A rectangle is covered by 4 unit squares. What is its area? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 4 }],
        explanation: "Counting the unit squares one at a time gives an area of 4.",
      },
      D: {
        prompt: "A rectangle is covered by 7 unit squares. What is its area? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 7 }],
        explanation: "Counting the unit squares one at a time gives an area of 7.",
      },
    },
  },
  {
    slug: "math-g3-l19-area-multiplying-side-lengths",
    grade: 3,
    lessonNumber: 19,
    title: "Area: Multiplying Side Lengths",
    mathSkill: "Area = Length × Width (3.MD.C.7a)",
    teaches: "Every slot gives a rectangle's two side lengths — the length is how many BLOCKS you use, the width is about how many notes go in each one; multiply them to find the area, then build that total across exactly that many blocks.",
    bpm: 96,
    challenges: {
      A: {
        prompt: "A rectangle is 3 units long and 2 units wide. What is its area? Build a drum beat using exactly 3 blocks that add up to 6 notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 6, blocksUsed: 3 }],
        explanation: "Area = length × width = 3 × 2 = 6 — 3 blocks (the length), 2 notes in each (the width), 6 in all.",
      },
      B: {
        prompt: "A rectangle is 4 units long and 2 units wide. What is its area? Build a drum beat using exactly 4 blocks that add up to 8 notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 8, blocksUsed: 4 }],
        explanation: "Area = 4 × 2 = 8 — 4 blocks, 2 notes in each, 8 in all.",
      },
      C: {
        prompt: "A rectangle is 3 units long and 3 units wide. What is its area? Build a drum beat using exactly 3 blocks that add up to 9 notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 9, blocksUsed: 3 }],
        explanation: "Area = 3 × 3 = 9 — 3 blocks, 3 notes in each, 9 in all.",
      },
      D: {
        prompt: "A rectangle is 4 units long and 1 unit wide. What is its area? Build a drum beat using exactly 4 blocks that add up to 4 notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 4, blocksUsed: 4 }],
        explanation: "Area = 4 × 1 = 4 — 4 blocks, 1 note in each, 4 in all.",
      },
    },
  },
  {
    slug: "math-g3-l20-perimeter",
    grade: 3,
    lessonNumber: 20,
    title: "Perimeter",
    mathSkill: "Perimeter (3.MD.D.8)",
    teaches: "Every slot gives a rectangle's side lengths — add all four sides together (its perimeter), then build that many quarter notes anywhere in the kit.",
    bpm: 96,
    challenges: {
      A: {
        prompt: "A rectangle is 3 units long and 2 units wide. What is its perimeter? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 10 }],
        explanation: "Perimeter = 2 × (3 + 2) = 10.",
      },
      B: {
        prompt: "A rectangle is 4 units long and 2 units wide. What is its perimeter? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 12 }],
        explanation: "Perimeter = 2 × (4 + 2) = 12.",
      },
      C: {
        prompt: "A rectangle is 3 units long and 3 units wide. What is its perimeter? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 12 }],
        explanation: "Perimeter = 2 × (3 + 3) = 12.",
      },
      D: {
        prompt: "A rectangle is 4 units long and 3 units wide. What is its perimeter? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 14 }],
        explanation: "Perimeter = 2 × (4 + 3) = 14.",
      },
    },
  },
  {
    slug: "math-g3-l21-liquid-volume-and-mass",
    grade: 3,
    lessonNumber: 21,
    title: "Liquid Volume and Mass",
    mathSkill: "Liquid Volume and Mass (3.MD.A.2)",
    teaches: "Every slot adds or compares liquid volume or mass in whole units — build the total in quarter notes, one per unit, anywhere in the kit.",
    bpm: 96,
    challenges: {
      A: {
        prompt: "A bottle holds 3 liters. Another holds 4 liters. How many liters in all? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 7 }],
        explanation: "3 + 4 = 7 liters.",
      },
      B: {
        prompt: "A bag of rice weighs 5 kilograms. Another weighs 2 kilograms. How many kilograms in all? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 7 }],
        explanation: "5 + 2 = 7 kilograms.",
      },
      C: {
        prompt: "A jug holds 6 liters. 2 liters are poured out. How many liters are left? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 4 }],
        explanation: "6 - 2 = 4 liters.",
      },
      D: {
        prompt: "A box weighs 8 kilograms. 3 kilograms are removed. How many kilograms are left? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 5 }],
        explanation: "8 - 3 = 5 kilograms.",
      },
    },
  },
  {
    slug: "math-g3-l22-picture-graphs-and-bar-graphs",
    grade: 3,
    lessonNumber: 22,
    title: "Picture Graphs and Bar Graphs",
    mathSkill: "Represent and Interpret Data (3.MD.B.3)",
    teaches: "Every slot reads a graph with a couple of categories — build each category's total on its own instrument, a simple groove where every part is a real quantity straight from the graph.",
    bpm: 96,
    challenges: {
      A: {
        prompt: "A bar graph shows pets owned: Dogs — 5, Cats — 3. Build a bass drum row of quarter notes for dogs and a snare row for cats.",
        targets: [
          { instrument: "kick", count: 5 },
          { instrument: "snare", count: 3 },
        ],
        explanation: "Dogs: 5, Cats: 3 — straight from the graph.",
      },
      B: {
        prompt: "A bar graph shows fruit sold: Apples — 6, Bananas — 4. Build a snare drum row for apples and a hi-hat row for bananas.",
        targets: [
          { instrument: "snare", count: 6 },
          { instrument: "hihatClosed", count: 4 },
        ],
        explanation: "Apples: 6, Bananas: 4.",
      },
      C: {
        prompt: "A picture graph shows books read: Emma — 4, Jack — 7. Build a hi-hat row for Emma and a bass drum row for Jack.",
        targets: [
          { instrument: "hihatClosed", count: 4 },
          { instrument: "kick", count: 7 },
        ],
        explanation: "Emma: 4, Jack: 7.",
      },
      D: {
        prompt: "A bar graph shows weather this week: Sunny — 5, Rainy — 2. Build a bass drum row for sunny days and a snare row for rainy days.",
        targets: [
          { instrument: "kick", count: 5 },
          { instrument: "snare", count: 2 },
        ],
        explanation: "Sunny: 5, Rainy: 2.",
      },
    },
  },
  {
    slug: "math-g3-l23-categorizing-shapes",
    grade: 3,
    lessonNumber: 23,
    title: "Categorizing Shapes",
    mathSkill: "Categorizing Shapes (3.G.A.1)",
    teaches: "Every slot names a shape category — count how many sides its members share, then build that many quarter notes anywhere in the kit.",
    bpm: 96,
    challenges: {
      A: {
        prompt: "All quadrilaterals share how many sides? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 4 }],
        explanation: "Every quadrilateral has 4 sides — it's in the name (quad- means four).",
      },
      B: {
        prompt: "All triangles share how many sides? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 3 }],
        explanation: "Every triangle has 3 sides.",
      },
      C: {
        prompt: "All pentagons share how many sides? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 5 }],
        explanation: "Every pentagon has 5 sides.",
      },
      D: {
        prompt: "All hexagons share how many sides? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 6 }],
        explanation: "Every hexagon has 6 sides.",
      },
    },
  },
  {
    slug: "math-g3-l24-partitioning-shapes-into-equal-areas",
    grade: 3,
    lessonNumber: 24,
    title: "Partitioning Shapes into Equal Areas",
    mathSkill: "Partition Shapes into Equal Areas (3.G.A.2)",
    teaches: "Every slot splits a shape into equal-area parts — build that many quarter notes anywhere in the kit, one for each equal part, the last groove of the year.",
    bpm: 96,
    challenges: {
      A: {
        prompt: "A rectangle is split into 4 equal-area parts. Build a drum beat with that many quarter notes. Each part is what fraction of the whole?",
        targets: [{ instrument: ANY_KIT_PIECE, count: 4 }],
        explanation: "4 equal parts — each part is 1/4 of the whole.",
      },
      B: {
        prompt: "A circle is split into 6 equal-area parts. Build a drum beat with that many quarter notes. Each part is what fraction of the whole?",
        targets: [{ instrument: ANY_KIT_PIECE, count: 6 }],
        explanation: "6 equal parts — each part is 1/6 of the whole.",
      },
      C: {
        prompt: "A square is split into 8 equal-area parts. Build a drum beat with that many quarter notes. Each part is what fraction of the whole?",
        targets: [{ instrument: ANY_KIT_PIECE, count: 8 }],
        explanation: "8 equal parts — each part is 1/8 of the whole.",
      },
      D: {
        prompt: "A rectangle is split into 3 equal-area parts. Build a drum beat with that many quarter notes. Each part is what fraction of the whole?",
        targets: [{ instrument: ANY_KIT_PIECE, count: 3 }],
        explanation: "3 equal parts — each part is 1/3 of the whole.",
      },
    },
  },

  // ============================================================
  // GRADE 4 — multi-digit multiplication and division anchor the fall,
  // factors/multiples/patterns lead into winter, fractions and decimals
  // fill early-to-mid spring, and measurement/geometry close out the year —
  // the real Common Core Grade 4 progression. This is the deepest the kit
  // goes: a four-digit number's thousands/hundreds/tens/ones gets a full
  // four-instrument groove (kick, snare, hi-hat, and — new this grade —
  // ride cymbal for the smallest place), the most real-sounding arrangement
  // RockBlocks Math has built yet, while single-fact lessons stay just as
  // simple as ever.
  // ============================================================
  {
    slug: "math-g4-l01-multiplying-1-digit-by-multi-digit",
    grade: 4,
    lessonNumber: 1,
    title: "Multiplying 1-Digit by Multi-Digit Numbers",
    mathSkill: "Multiply 1-Digit × Multi-Digit (4.NBT.B.5)",
    teaches: "Every slot multiplies a one-digit number by a two-digit number — find the product, then build its tens on the kick and its ones on the hi-hat, a steady pulse answered by a faster one.",
    bpm: 96,
    challenges: {
      A: {
        prompt: "3 × 12 = ? Build a bass drum row of quarter notes for the tens of the answer and a hi-hat row for the ones.",
        targets: [
          { instrument: "kick", count: 3 },
          { instrument: "hihatClosed", count: 6 },
        ],
        explanation: "3 × 12 = 36 = 3 tens + 6 ones.",
      },
      B: {
        prompt: "4 × 13 = ? Build a bass drum row of quarter notes for the tens of the answer and a hi-hat row for the ones.",
        targets: [
          { instrument: "kick", count: 5 },
          { instrument: "hihatClosed", count: 2 },
        ],
        explanation: "4 × 13 = 52 = 5 tens + 2 ones.",
      },
      C: {
        prompt: "2 × 24 = ? Build a bass drum row of quarter notes for the tens of the answer and a hi-hat row for the ones.",
        targets: [
          { instrument: "kick", count: 4 },
          { instrument: "hihatClosed", count: 8 },
        ],
        explanation: "2 × 24 = 48 = 4 tens + 8 ones.",
      },
      D: {
        prompt: "3 × 21 = ? Build a bass drum row of quarter notes for the tens of the answer and a hi-hat row for the ones.",
        targets: [
          { instrument: "kick", count: 6 },
          { instrument: "hihatClosed", count: 3 },
        ],
        explanation: "3 × 21 = 63 = 6 tens + 3 ones.",
      },
    },
  },
  {
    slug: "math-g4-l02-factors-and-multiples",
    grade: 4,
    lessonNumber: 2,
    title: "Factors and Multiples",
    mathSkill: "Factors and Multiples (4.OA.B.4)",
    teaches: "Every slot asks you to find factors or a multiple — build that count anywhere in the kit.",
    bpm: 96,
    challenges: {
      A: {
        prompt: "How many factors does 8 have? (1, 2, 4, 8) Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 4 }],
        explanation: "8's factors are 1, 2, 4, 8 — 4 factors.",
      },
      B: {
        prompt: "What is the 3rd multiple of 2? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 6 }],
        explanation: "2, 4, 6 — the 3rd multiple of 2 is 6.",
      },
      C: {
        prompt: "How many factors does 12 have? (1, 2, 3, 4, 6, 12) Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 6 }],
        explanation: "12's factors are 1, 2, 3, 4, 6, 12 — 6 factors.",
      },
      D: {
        prompt: "What is the 4th multiple of 2? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 8 }],
        explanation: "2, 4, 6, 8 — the 4th multiple of 2 is 8.",
      },
    },
  },
  {
    slug: "math-g4-l03-division-with-remainders",
    grade: 4,
    lessonNumber: 3,
    title: "Division with Remainders",
    mathSkill: "Division with Remainders (4.NBT.B.6)",
    teaches: "Every slot divides with some left over — the full groups are how many BLOCKS you use on the bass drum (their total is whatever divides evenly), and the remainder is one last extra hit on the snare.",
    bpm: 96,
    challenges: {
      A: {
        prompt: "13 ÷ 4 = ? How many full groups of 4, and how many left over? Build a bass drum row using exactly 4 blocks that add up to 12 notes in all (the full groups), and a snare row with the remainder.",
        targets: [
          { instrument: "kick", count: 12, blocksUsed: 4 },
          { instrument: "snare", count: 1 },
        ],
        explanation: "13 ÷ 4 = 3 remainder 1 — 4 blocks (groups) holding 12 notes in all (4×3=12), then 13-12=1 left over.",
      },
      B: {
        prompt: "17 ÷ 5 = ? Build a bass drum row using exactly 5 blocks that add up to 15 notes in all (the full groups), and a snare row with the remainder.",
        targets: [
          { instrument: "kick", count: 15, blocksUsed: 5 },
          { instrument: "snare", count: 2 },
        ],
        explanation: "17 ÷ 5 = 3 remainder 2 — 5 blocks holding 15 notes in all (5×3=15), then 17-15=2 left over.",
      },
      C: {
        prompt: "22 ÷ 6 = ? Build a bass drum row using exactly 6 blocks that add up to 18 notes in all (the full groups), and a snare row with the remainder.",
        targets: [
          { instrument: "kick", count: 18, blocksUsed: 6 },
          { instrument: "snare", count: 4 },
        ],
        explanation: "22 ÷ 6 = 3 remainder 4 — 6 blocks holding 18 notes in all (6×3=18), then 22-18=4 left over.",
      },
      D: {
        prompt: "19 ÷ 3 = ? Build a bass drum row using exactly 3 blocks that add up to 18 notes in all (the full groups), and a snare row with the remainder.",
        targets: [
          { instrument: "kick", count: 18, blocksUsed: 3 },
          { instrument: "snare", count: 1 },
        ],
        explanation: "19 ÷ 3 = 6 remainder 1 — 3 blocks holding 18 notes in all (3×6=18), then 19-18=1 left over.",
      },
    },
  },
  {
    slug: "math-g4-l04-multi-step-word-problems",
    grade: 4,
    lessonNumber: 4,
    title: "Multi-Step Word Problems",
    mathSkill: "Multi-Step Word Problems (4.OA.A.3)",
    teaches: "Every slot takes two steps to solve — work through them in order, then build the final answer anywhere in the kit.",
    bpm: 98,
    challenges: {
      A: {
        prompt: "A baker makes 4 batches of 6 muffins each, then sells 10. How many muffins are left? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 14 }],
        explanation: "4 × 6 = 24, then 24 - 10 = 14.",
      },
      B: {
        prompt: "A bus has 3 rows of 4 seats each, plus 4 extra seats. How many seats in all? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 16 }],
        explanation: "3 × 4 = 12, then 12 + 4 = 16.",
      },
      C: {
        prompt: "A store has 4 shelves of 3 books each. 4 books are sold. How many books are left? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 8 }],
        explanation: "4 × 3 = 12, then 12 - 4 = 8.",
      },
      D: {
        prompt: "A farmer has 6 rows of 2 pumpkins each, plus 3 more pumpkins found. How many pumpkins in all? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 15 }],
        explanation: "6 × 2 = 12, then 12 + 3 = 15.",
      },
    },
  },
  {
    slug: "math-g4-l05-place-value-to-the-thousands",
    grade: 4,
    lessonNumber: 5,
    title: "Place Value to the Thousands",
    mathSkill: "Place Value to 1,000,000 (4.NBT.A.1-2)",
    teaches: "Every slot gives a four-digit number — build its parts on four different instruments, from thousands down to ones: kick holding the pulse, snare answering, hi-hat filling in, and — new this grade — ride cymbal keeping the fastest, steadiest part of all.",
    bpm: 98,
    challenges: {
      A: {
        prompt: "The number 3,241. Build quarter notes for its thousands (bass drum), hundreds (snare), tens (hi-hat), and ones (ride cymbal).",
        targets: [
          { instrument: "kick", count: 3 },
          { instrument: "snare", count: 2 },
          { instrument: "hihatClosed", count: 4 },
          { instrument: "ride", count: 1 },
        ],
        explanation: "3,241 = 3 thousands + 2 hundreds + 4 tens + 1 one.",
      },
      B: {
        prompt: "The number 5,672. Build quarter notes for its thousands (bass drum), hundreds (snare), tens (hi-hat), and ones (ride cymbal).",
        targets: [
          { instrument: "kick", count: 5 },
          { instrument: "snare", count: 6 },
          { instrument: "hihatClosed", count: 7 },
          { instrument: "ride", count: 2 },
        ],
        explanation: "5,672 = 5 thousands + 6 hundreds + 7 tens + 2 ones.",
      },
      C: {
        prompt: "The number 1,384. Build quarter notes for its thousands (bass drum), hundreds (snare), tens (hi-hat), and ones (ride cymbal).",
        targets: [
          { instrument: "kick", count: 1 },
          { instrument: "snare", count: 3 },
          { instrument: "hihatClosed", count: 8 },
          { instrument: "ride", count: 4 },
        ],
        explanation: "1,384 = 1 thousand + 3 hundreds + 8 tens + 4 ones.",
      },
      D: {
        prompt: "The number 4,156. Build quarter notes for its thousands (bass drum), hundreds (snare), tens (hi-hat), and ones (ride cymbal).",
        targets: [
          { instrument: "kick", count: 4 },
          { instrument: "snare", count: 1 },
          { instrument: "hihatClosed", count: 5 },
          { instrument: "ride", count: 6 },
        ],
        explanation: "4,156 = 4 thousands + 1 hundred + 5 tens + 6 ones.",
      },
    },
  },
  {
    slug: "math-g4-l06-rounding-multi-digit-numbers",
    grade: 4,
    lessonNumber: 6,
    title: "Rounding Multi-Digit Numbers",
    mathSkill: "Rounding Multi-Digit Numbers (4.NBT.A.3)",
    teaches: "Every slot rounds a big number to a given place — build how many of that place-value unit the rounded number has, anywhere in the kit.",
    bpm: 98,
    challenges: {
      A: {
        prompt: "Round 3,482 to the nearest thousand. How many thousands is that? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 3 }],
        explanation: "3,482 rounds to 3,000, which is 3 thousands.",
      },
      B: {
        prompt: "Round 6,750 to the nearest thousand. How many thousands is that? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 7 }],
        explanation: "6,750 rounds to 7,000, which is 7 thousands.",
      },
      C: {
        prompt: "Round 2,340 to the nearest thousand. How many thousands is that? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 2 }],
        explanation: "2,340 rounds to 2,000, which is 2 thousands.",
      },
      D: {
        prompt: "Round 5,590 to the nearest thousand. How many thousands is that? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 6 }],
        explanation: "5,590 rounds to 6,000 (round up at the halfway point), which is 6 thousands.",
      },
    },
  },
  {
    slug: "math-g4-l07-comparing-multi-digit-numbers",
    grade: 4,
    lessonNumber: 7,
    title: "Comparing Multi-Digit Numbers",
    mathSkill: "Comparing Multi-Digit Numbers (4.NBT.A.2)",
    teaches: "Every slot compares two big numbers — figure out which is bigger, then build the digit that actually decided it, anywhere in the kit.",
    bpm: 98,
    challenges: {
      A: {
        prompt: "Which is bigger: 4,521 or 4,215? Build a drum beat with the BIGGER number's hundreds digit, in quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 5 }],
        explanation: "4,521 > 4,215 — compare digit by digit from the left; the hundreds digit (5 vs 2) decides it.",
      },
      B: {
        prompt: "Which is bigger: 3,842 or 3,824? Build a drum beat with the BIGGER number's tens digit, in quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 4 }],
        explanation: "3,842 > 3,824 — the thousands and hundreds match, so the tens digit (4 vs 2) decides it.",
      },
      C: {
        prompt: "Which is bigger: 6,103 or 6,130? Build a drum beat with the BIGGER number's tens digit, in quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 3 }],
        explanation: "6,130 > 6,103 — the tens digit (3 vs 0) decides it.",
      },
      D: {
        prompt: "Which is bigger: 7,256 or 7,265? Build a drum beat with the BIGGER number's tens digit, in quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 6 }],
        explanation: "7,265 > 7,256 — the tens digit (6 vs 5) decides it.",
      },
    },
  },
  {
    slug: "math-g4-l08-multi-digit-addition",
    grade: 4,
    lessonNumber: 8,
    title: "Multi-Digit Addition",
    mathSkill: "Add Multi-Digit Numbers (4.NBT.B.4)",
    teaches: "Every slot adds two four-digit numbers — build the sum's thousands, hundreds, tens, and ones on four different instruments, the fullest groove yet.",
    bpm: 98,
    challenges: {
      A: {
        prompt: "2,143 + 1,124 = ? Build quarter notes for the thousands (bass drum), hundreds (snare), tens (hi-hat), and ones (ride cymbal) of the answer.",
        targets: [
          { instrument: "kick", count: 3 },
          { instrument: "snare", count: 2 },
          { instrument: "hihatClosed", count: 6 },
          { instrument: "ride", count: 7 },
        ],
        explanation: "2,143 + 1,124 = 3,267 = 3 thousands + 2 hundreds + 6 tens + 7 ones.",
      },
      B: {
        prompt: "3,215 + 2,142 = ? Build quarter notes for the thousands (bass drum), hundreds (snare), tens (hi-hat), and ones (ride cymbal) of the answer.",
        targets: [
          { instrument: "kick", count: 5 },
          { instrument: "snare", count: 3 },
          { instrument: "hihatClosed", count: 5 },
          { instrument: "ride", count: 7 },
        ],
        explanation: "3,215 + 2,142 = 5,357 = 5 thousands + 3 hundreds + 5 tens + 7 ones.",
      },
      C: {
        prompt: "1,432 + 2,241 = ? Build quarter notes for the thousands (bass drum), hundreds (snare), tens (hi-hat), and ones (ride cymbal) of the answer.",
        targets: [
          { instrument: "kick", count: 3 },
          { instrument: "snare", count: 6 },
          { instrument: "hihatClosed", count: 7 },
          { instrument: "ride", count: 3 },
        ],
        explanation: "1,432 + 2,241 = 3,673 = 3 thousands + 6 hundreds + 7 tens + 3 ones.",
      },
      D: {
        prompt: "4,121 + 1,234 = ? Build quarter notes for the thousands (bass drum), hundreds (snare), tens (hi-hat), and ones (ride cymbal) of the answer.",
        targets: [
          { instrument: "kick", count: 5 },
          { instrument: "snare", count: 3 },
          { instrument: "hihatClosed", count: 5 },
          { instrument: "ride", count: 5 },
        ],
        explanation: "4,121 + 1,234 = 5,355 = 5 thousands + 3 hundreds + 5 tens + 5 ones.",
      },
    },
  },
  {
    slug: "math-g4-l09-multi-digit-subtraction",
    grade: 4,
    lessonNumber: 9,
    title: "Multi-Digit Subtraction",
    mathSkill: "Subtract Multi-Digit Numbers (4.NBT.B.4)",
    teaches: "Every slot subtracts two four-digit numbers — build the difference's thousands, hundreds, tens, and ones on four different instruments.",
    bpm: 98,
    challenges: {
      A: {
        prompt: "5,384 - 2,151 = ? Build quarter notes for the thousands (bass drum), hundreds (snare), tens (hi-hat), and ones (ride cymbal) of the answer.",
        targets: [
          { instrument: "kick", count: 3 },
          { instrument: "snare", count: 2 },
          { instrument: "hihatClosed", count: 3 },
          { instrument: "ride", count: 3 },
        ],
        explanation: "5,384 - 2,151 = 3,233 = 3 thousands + 2 hundreds + 3 tens + 3 ones.",
      },
      B: {
        prompt: "6,748 - 3,215 = ? Build quarter notes for the thousands (bass drum), hundreds (snare), tens (hi-hat), and ones (ride cymbal) of the answer.",
        targets: [
          { instrument: "kick", count: 3 },
          { instrument: "snare", count: 5 },
          { instrument: "hihatClosed", count: 3 },
          { instrument: "ride", count: 3 },
        ],
        explanation: "6,748 - 3,215 = 3,533 = 3 thousands + 5 hundreds + 3 tens + 3 ones.",
      },
      C: {
        prompt: "8,596 - 4,273 = ? Build quarter notes for the thousands (bass drum), hundreds (snare), tens (hi-hat), and ones (ride cymbal) of the answer.",
        targets: [
          { instrument: "kick", count: 4 },
          { instrument: "snare", count: 3 },
          { instrument: "hihatClosed", count: 2 },
          { instrument: "ride", count: 3 },
        ],
        explanation: "8,596 - 4,273 = 4,323 = 4 thousands + 3 hundreds + 2 tens + 3 ones.",
      },
      D: {
        prompt: "7,468 - 3,134 = ? Build quarter notes for the thousands (bass drum), hundreds (snare), tens (hi-hat), and ones (ride cymbal) of the answer.",
        targets: [
          { instrument: "kick", count: 4 },
          { instrument: "snare", count: 3 },
          { instrument: "hihatClosed", count: 3 },
          { instrument: "ride", count: 4 },
        ],
        explanation: "7,468 - 3,134 = 4,334 = 4 thousands + 3 hundreds + 3 tens + 4 ones.",
      },
    },
  },
  {
    slug: "math-g4-l10-prime-and-composite-numbers",
    grade: 4,
    lessonNumber: 10,
    title: "Prime and Composite Numbers",
    mathSkill: "Prime and Composite Numbers (4.OA.B.4)",
    teaches: "Every slot names a number as prime (only 1 and itself as factors) or composite (more factors than that) — build its total number of factors anywhere in the kit.",
    bpm: 100,
    challenges: {
      A: {
        prompt: "Is 7 prime or composite? How many factors does it have? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 2 }],
        explanation: "7 is prime — only 1 and 7, so 2 factors.",
      },
      B: {
        prompt: "Is 6 prime or composite? How many factors does it have? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 4 }],
        explanation: "6 is composite — 1, 2, 3, 6, so 4 factors.",
      },
      C: {
        prompt: "Is 5 prime or composite? How many factors does it have? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 2 }],
        explanation: "5 is prime — only 1 and 5, so 2 factors.",
      },
      D: {
        prompt: "Is 8 prime or composite? How many factors does it have? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 4 }],
        explanation: "8 is composite — 1, 2, 4, 8, so 4 factors.",
      },
    },
  },
  {
    slug: "math-g4-l11-number-and-shape-patterns",
    grade: 4,
    lessonNumber: 11,
    title: "Number and Shape Patterns",
    mathSkill: "Number and Shape Patterns (4.OA.C.5)",
    teaches: "Every slot gives a pattern rule — apply it to find the next number, then build that many quarter notes anywhere in the kit.",
    bpm: 100,
    challenges: {
      A: {
        prompt: "Start at 1 and add 2 each time: 1, 3, 5, __. What comes next? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 7 }],
        explanation: "1, 3, 5, 7 — add 2 each time.",
      },
      B: {
        prompt: "Start at 2 and double each time: 2, 4, __. What comes next? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 8 }],
        explanation: "2, 4, 8 — double each time.",
      },
      C: {
        prompt: "Start at 20 and subtract 5 each time: 20, 15, 10, __. What comes next? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 5 }],
        explanation: "20, 15, 10, 5 — subtract 5 each time.",
      },
      D: {
        prompt: "Start at 1 and add 3 each time: 1, 4, __. What comes next? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 7 }],
        explanation: "1, 4, 7 — add 3 each time.",
      },
    },
  },
  {
    slug: "math-g4-l12-equivalent-fractions",
    grade: 4,
    lessonNumber: 12,
    title: "Equivalent Fractions",
    mathSkill: "Equivalent Fractions (4.NF.A.1)",
    teaches: "Every slot shows two equivalent fractions — build each one's numerator on its own instrument.",
    bpm: 100,
    challenges: {
      A: {
        prompt: "2/5 and 4/10 name the same amount. Build a bass drum row with the numerator of 2/5 and a snare row with the numerator of 4/10.",
        targets: [
          { instrument: "kick", count: 2 },
          { instrument: "snare", count: 4 },
        ],
        explanation: "2/5 = 4/10.",
      },
      B: {
        prompt: "3/4 and 6/8 name the same amount. Build a bass drum row with the numerator of 3/4 and a snare row with the numerator of 6/8.",
        targets: [
          { instrument: "kick", count: 3 },
          { instrument: "snare", count: 6 },
        ],
        explanation: "3/4 = 6/8.",
      },
      C: {
        prompt: "1/3 and 3/9 name the same amount. Build a hi-hat row with the numerator of 1/3 and a bass drum row with the numerator of 3/9.",
        targets: [
          { instrument: "hihatClosed", count: 1 },
          { instrument: "kick", count: 3 },
        ],
        explanation: "1/3 = 3/9.",
      },
      D: {
        prompt: "2/6 and 1/3 name the same amount. Build a snare row with the numerator of 2/6 and a hi-hat row with the numerator of 1/3.",
        targets: [
          { instrument: "snare", count: 2 },
          { instrument: "hihatClosed", count: 1 },
        ],
        explanation: "2/6 = 1/3.",
      },
    },
  },
  {
    slug: "math-g4-l13-comparing-fractions-with-unlike-denominators",
    grade: 4,
    lessonNumber: 13,
    title: "Comparing Fractions with Unlike Denominators",
    mathSkill: "Comparing Fractions with Unlike Denominators (4.NF.A.2)",
    teaches: "Every slot compares two fractions with different denominators — figure out which is bigger, then build only that fraction's numerator, anywhere in the kit.",
    bpm: 100,
    challenges: {
      A: {
        prompt: "Which is bigger: 3/4 or 1/2? Build a drum beat with the BIGGER fraction's numerator, in quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 3 }],
        explanation: "3/4 > 1/2 (0.75 > 0.5).",
      },
      B: {
        prompt: "Which is bigger: 5/8 or 1/4? Build a drum beat with the BIGGER fraction's numerator, in quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 5 }],
        explanation: "5/8 > 1/4 (0.625 > 0.25).",
      },
      C: {
        prompt: "Which is bigger: 2/3 or 1/6? Build a drum beat with the BIGGER fraction's numerator, in quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 2 }],
        explanation: "2/3 > 1/6 (about 0.67 > about 0.17).",
      },
      D: {
        prompt: "Which is bigger: 1/2 or 3/8? Build a drum beat with the BIGGER fraction's numerator, in quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 1 }],
        explanation: "1/2 > 3/8 (0.5 > 0.375).",
      },
    },
  },
  {
    slug: "math-g4-l14-adding-fractions-with-like-denominators",
    grade: 4,
    lessonNumber: 14,
    title: "Adding Fractions with Like Denominators",
    mathSkill: "Add Fractions with Like Denominators (4.NF.B.3a)",
    teaches: "Every slot adds two fractions that share a denominator — add just the numerators, then build that total anywhere in the kit.",
    bpm: 100,
    challenges: {
      A: {
        prompt: "1/8 + 4/8 = ? Build a drum beat with the numerator of the answer, in quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 5 }],
        explanation: "1/8 + 4/8 = 5/8.",
      },
      B: {
        prompt: "2/6 + 3/6 = ? Build a drum beat with the numerator of the answer, in quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 5 }],
        explanation: "2/6 + 3/6 = 5/6.",
      },
      C: {
        prompt: "3/10 + 4/10 = ? Build a drum beat with the numerator of the answer, in quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 7 }],
        explanation: "3/10 + 4/10 = 7/10.",
      },
      D: {
        prompt: "2/5 + 2/5 = ? Build a drum beat with the numerator of the answer, in quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 4 }],
        explanation: "2/5 + 2/5 = 4/5.",
      },
    },
  },
  {
    slug: "math-g4-l15-subtracting-fractions-with-like-denominators",
    grade: 4,
    lessonNumber: 15,
    title: "Subtracting Fractions with Like Denominators",
    mathSkill: "Subtract Fractions with Like Denominators (4.NF.B.3a)",
    teaches: "Every slot subtracts two fractions that share a denominator — subtract just the numerators, then build what's left anywhere in the kit.",
    bpm: 100,
    challenges: {
      A: {
        prompt: "7/8 - 3/8 = ? Build a drum beat with the numerator of the answer, in quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 4 }],
        explanation: "7/8 - 3/8 = 4/8.",
      },
      B: {
        prompt: "5/6 - 2/6 = ? Build a drum beat with the numerator of the answer, in quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 3 }],
        explanation: "5/6 - 2/6 = 3/6.",
      },
      C: {
        prompt: "9/10 - 4/10 = ? Build a drum beat with the numerator of the answer, in quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 5 }],
        explanation: "9/10 - 4/10 = 5/10.",
      },
      D: {
        prompt: "4/5 - 1/5 = ? Build a drum beat with the numerator of the answer, in quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 3 }],
        explanation: "4/5 - 1/5 = 3/5.",
      },
    },
  },
  {
    slug: "math-g4-l16-multiplying-a-fraction-by-a-whole-number",
    grade: 4,
    lessonNumber: 16,
    title: "Multiplying a Fraction by a Whole Number",
    mathSkill: "Multiply a Fraction by a Whole Number (4.NF.B.4)",
    teaches: "Every slot multiplies a fraction by a whole number — the whole number is how many BLOCKS you use, and the notes packed into them are the resulting numerator; build that total across exactly that many blocks.",
    bpm: 102,
    challenges: {
      A: {
        prompt: "3 × 1/4 = ? Build a drum beat using exactly 3 blocks that add up to 3 notes in all — the numerator of the answer.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 3, blocksUsed: 3 }],
        explanation: "3 × 1/4 = 3/4 — 3 blocks (the whole number) holding 3 notes in all (the numerator).",
      },
      B: {
        prompt: "4 × 1/3 = ? Build a drum beat using exactly 4 blocks that add up to 4 notes in all — the numerator of the answer.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 4, blocksUsed: 4 }],
        explanation: "4 × 1/3 = 4/3 — 4 blocks holding 4 notes in all.",
      },
      C: {
        prompt: "2 × 2/5 = ? Build a drum beat using exactly 2 blocks that add up to 4 notes in all — the numerator of the answer.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 4, blocksUsed: 2 }],
        explanation: "2 × 2/5 = 4/5 — 2 blocks (the whole number), 2 notes in each (2/5 each time), 4 in all.",
      },
      D: {
        prompt: "5 × 1/6 = ? Build a drum beat using exactly 5 blocks that add up to 5 notes in all — the numerator of the answer.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 5, blocksUsed: 5 }],
        explanation: "5 × 1/6 = 5/6 — 5 blocks holding 5 notes in all.",
      },
    },
  },
  {
    slug: "math-g4-l17-decimals-as-fractions",
    grade: 4,
    lessonNumber: 17,
    title: "Decimals as Fractions",
    mathSkill: "Decimals as Fractions of Tenths and Hundredths (4.NF.C.6)",
    teaches: "Every slot gives a decimal — build how many tenths (or hundredths) it is, anywhere in the kit.",
    bpm: 102,
    challenges: {
      A: {
        prompt: "0.3 as a fraction is how many tenths? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 3 }],
        explanation: "0.3 = 3/10 — 3 tenths.",
      },
      B: {
        prompt: "0.7 as a fraction is how many tenths? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 7 }],
        explanation: "0.7 = 7/10 — 7 tenths.",
      },
      C: {
        prompt: "0.05 as a fraction is how many hundredths? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 5 }],
        explanation: "0.05 = 5/100 — 5 hundredths.",
      },
      D: {
        prompt: "0.6 as a fraction is how many tenths? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 6 }],
        explanation: "0.6 = 6/10 — 6 tenths.",
      },
    },
  },
  {
    slug: "math-g4-l18-comparing-decimals",
    grade: 4,
    lessonNumber: 18,
    title: "Comparing Decimals",
    mathSkill: "Comparing Decimals (4.NF.C.7)",
    teaches: "Every slot compares two decimals — figure out which is bigger, then build its tenths digit anywhere in the kit.",
    bpm: 102,
    challenges: {
      A: {
        prompt: "Which is bigger: 0.4 or 0.6? Build a drum beat with the BIGGER decimal's tenths digit, in quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 6 }],
        explanation: "0.6 > 0.4.",
      },
      B: {
        prompt: "Which is bigger: 0.35 or 0.53? Build a drum beat with the BIGGER decimal's tenths digit, in quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 5 }],
        explanation: "0.53 > 0.35 — compare the tenths digit first (5 vs 3).",
      },
      C: {
        prompt: "Which is bigger: 0.2 or 0.19? Build a drum beat with the BIGGER decimal's tenths digit, in quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 2 }],
        explanation: "0.2 (0.20) > 0.19 — 2 tenths beats 1 tenth.",
      },
      D: {
        prompt: "Which is bigger: 0.7 or 0.68? Build a drum beat with the BIGGER decimal's tenths digit, in quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 7 }],
        explanation: "0.7 > 0.68 — 7 tenths beats 6 tenths.",
      },
    },
  },
  {
    slug: "math-g4-l19-measurement-conversions",
    grade: 4,
    lessonNumber: 19,
    title: "Measurement Conversions",
    mathSkill: "Measurement Conversions (4.MD.A.1-2)",
    teaches: "Every slot converts between units — figure out the new count, then build that many quarter notes anywhere in the kit.",
    bpm: 102,
    challenges: {
      A: {
        prompt: "How many feet are in 2 yards? (1 yard = 3 feet) Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 6 }],
        explanation: "2 yards × 3 feet = 6 feet.",
      },
      B: {
        prompt: "How many inches are in 1 foot? (1 foot = 12 inches) Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 12 }],
        explanation: "1 foot = 12 inches.",
      },
      C: {
        prompt: "How many quarts are in 2 gallons? (1 gallon = 4 quarts) Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 8 }],
        explanation: "2 gallons × 4 quarts = 8 quarts.",
      },
      D: {
        prompt: "How many feet are in 3 yards? (1 yard = 3 feet) Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 9 }],
        explanation: "3 yards × 3 feet = 9 feet.",
      },
    },
  },
  {
    slug: "math-g4-l20-area-and-perimeter-word-problems",
    grade: 4,
    lessonNumber: 20,
    title: "Area and Perimeter Word Problems",
    mathSkill: "Area and Perimeter Word Problems (4.MD.A.3)",
    teaches: "Every slot is a word problem about a rectangle's area or perimeter — figure out which one it's asking for. For area, the length is how many BLOCKS you use and the width is about how many notes go in each; for perimeter, just build the total anywhere in the kit.",
    bpm: 102,
    challenges: {
      A: {
        prompt:
          "A garden is 5 feet long and 3 feet wide. What is its area? Build a drum beat using exactly 5 blocks that add up to 15 notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 15, blocksUsed: 5 }],
        explanation: "Area = length × width = 5 × 3 = 15 — 5 blocks (the length), 3 notes in each (the width), 15 in all.",
      },
      B: {
        prompt: "A rug is 4 feet long and 2 feet wide. What is its perimeter? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 12 }],
        explanation: "Perimeter = 2 × (4 + 2) = 12.",
      },
      C: {
        prompt:
          "A room is 5 feet long and 2 feet wide. What is its area? Build a drum beat using exactly 5 blocks that add up to 10 notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 10, blocksUsed: 5 }],
        explanation: "Area = 5 × 2 = 10 — 5 blocks, 2 notes in each, 10 in all.",
      },
      D: {
        prompt: "A patio is 3 feet long and 3 feet wide. What is its perimeter? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 12 }],
        explanation: "Perimeter = 2 × (3 + 3) = 12.",
      },
    },
  },
  {
    slug: "math-g4-l21-angle-measurement",
    grade: 4,
    lessonNumber: 21,
    title: "Angle Measurement",
    mathSkill: "Angle Measurement (4.MD.C.5-6)",
    teaches: "Every slot gives an angle in degrees — since the degree count itself is too big to build directly, build how many TENS of degrees it is, anywhere in the kit.",
    bpm: 104,
    challenges: {
      A: {
        prompt: "A 40° angle. How many tens of degrees is that? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 4 }],
        explanation: "40° is 4 tens of degrees.",
      },
      B: {
        prompt: "A 70° angle. How many tens of degrees is that? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 7 }],
        explanation: "70° is 7 tens of degrees.",
      },
      C: {
        prompt: "A right angle measures 90°. How many tens of degrees is that? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 9 }],
        explanation: "90° is 9 tens of degrees.",
      },
      D: {
        prompt: "A 60° angle. How many tens of degrees is that? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 6 }],
        explanation: "60° is 6 tens of degrees.",
      },
    },
  },
  {
    slug: "math-g4-l22-classifying-two-dimensional-shapes",
    grade: 4,
    lessonNumber: 22,
    title: "Classifying Two-Dimensional Shapes",
    mathSkill: "Classify Two-Dimensional Shapes (4.G.A.2)",
    teaches: "Every slot names a shape by its angles or sides — count the feature it's asking about, then build that many quarter notes anywhere in the kit.",
    bpm: 104,
    challenges: {
      A: {
        prompt: "A right triangle has how many right angles? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 1 }],
        explanation: "A right triangle has exactly 1 right angle.",
      },
      B: {
        prompt: "A rectangle has how many right angles? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 4 }],
        explanation: "A rectangle has 4 right angles, one at each corner.",
      },
      C: {
        prompt: "An acute triangle has how many acute angles? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 3 }],
        explanation: "An acute triangle has 3 acute angles — all of them.",
      },
      D: {
        prompt: "A parallelogram has how many pairs of parallel sides? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 2 }],
        explanation: "A parallelogram has 2 pairs of parallel sides.",
      },
    },
  },
  {
    slug: "math-g4-l23-lines-of-symmetry",
    grade: 4,
    lessonNumber: 23,
    title: "Lines of Symmetry",
    mathSkill: "Lines of Symmetry (4.G.A.3)",
    teaches: "Every slot names a shape — build how many lines of symmetry it has, one quarter note per line, anywhere in the kit.",
    bpm: 104,
    challenges: {
      A: {
        prompt: "A square has how many lines of symmetry? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 4 }],
        explanation: "A square has 4 lines of symmetry.",
      },
      B: {
        prompt: "An equilateral triangle has how many lines of symmetry? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 3 }],
        explanation: "An equilateral triangle has 3 lines of symmetry.",
      },
      C: {
        prompt: "A regular hexagon has how many lines of symmetry? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 6 }],
        explanation: "A regular hexagon has 6 lines of symmetry.",
      },
      D: {
        prompt: "A rectangle (non-square) has how many lines of symmetry? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 2 }],
        explanation: "A non-square rectangle has 2 lines of symmetry — through the middle each way, but not diagonally.",
      },
    },
  },
  {
    slug: "math-g4-l24-interpreting-line-plots",
    grade: 4,
    lessonNumber: 24,
    title: "Interpreting Line Plots",
    mathSkill: "Interpreting Line Plots (4.MD.B.4)",
    teaches: "Every slot reads a line plot's data — build the count for each value it asks about, a simple groove built entirely from real data points, the last lesson of the year.",
    bpm: 104,
    challenges: {
      A: {
        prompt: "A line plot shows how many pets kids have: 3 kids have 1 pet, 5 kids have 2 pets. Build a bass drum row of quarter notes for kids with 1 pet and a snare row for kids with 2 pets.",
        targets: [
          { instrument: "kick", count: 3 },
          { instrument: "snare", count: 5 },
        ],
        explanation: "1 pet: 3 kids. 2 pets: 5 kids — straight from the line plot.",
      },
      B: {
        prompt: "A line plot shows shoe sizes: 4 kids wear size 5, 6 kids wear size 6. Build a snare row for size 5 and a hi-hat row for size 6.",
        targets: [
          { instrument: "snare", count: 4 },
          { instrument: "hihatClosed", count: 6 },
        ],
        explanation: "Size 5: 4 kids. Size 6: 6 kids.",
      },
      C: {
        prompt: "A line plot shows minutes of reading: 2 kids read for 3 minutes, 7 kids read for 5 minutes. Build a hi-hat row for the 3-minute readers and a bass drum row for the 5-minute readers.",
        targets: [
          { instrument: "hihatClosed", count: 2 },
          { instrument: "kick", count: 7 },
        ],
        explanation: "3 minutes: 2 kids. 5 minutes: 7 kids.",
      },
      D: {
        prompt: "A line plot shows plants grown: 5 kids grew 2 plants, 3 kids grew 4 plants. Build a bass drum row for 2-plant growers and a snare row for 4-plant growers.",
        targets: [
          { instrument: "kick", count: 5 },
          { instrument: "snare", count: 3 },
        ],
        explanation: "2 plants: 5 kids. 4 plants: 3 kids.",
      },
    },
  },

  // ============================================================
  // GRADE 5 — order of operations and powers of ten open the fall,
  // decimal operations and fraction operations with unlike denominators
  // fill winter and early spring, volume and the coordinate plane close
  // out the year — the real Common Core Grade 5 progression. Numbers get
  // genuinely bigger this grade (decimal sums counted in tenths, division
  // by a unit fraction, multi-digit products), so a plain row of quarter
  // notes usually can't hold an answer at all — building it *requires*
  // mixing in eighth notes, triplets, and faster subdivisions, not just
  // defaulting to one quarter note per block. The blocks mechanic keeps
  // doing the heavy lifting for anything shaped like equal groups
  // (multiplication, division, and — new this grade — dividing by a unit
  // fraction, where splitting a whole into its unit fractions maps onto
  // splitting one block into that many notes about as cleanly as this
  // model gets).
  // ============================================================
  {
    slug: "math-g5-l01-order-of-operations",
    grade: 5,
    lessonNumber: 1,
    title: "Order of Operations",
    mathSkill: "Order of Operations with Parentheses (5.OA.A.1)",
    teaches: "Every slot has an expression with parentheses — solve inside the parentheses first, then finish the rest, and build the final answer as a drum beat with that many notes in all. Mix in eighth notes and triplets to fit them — most of these are too big for a row of plain quarter notes.",
    bpm: 106,
    challenges: {
      A: {
        prompt: "(3 + 2) × 4 = ? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 20 }],
        explanation: "(3 + 2) × 4 = 5 × 4 = 20 — solve inside the parentheses first.",
      },
      B: {
        prompt: "(8 - 3) × 5 = ? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 25 }],
        explanation: "(8 - 3) × 5 = 5 × 5 = 25.",
      },
      C: {
        prompt: "2 × (6 + 3) = ? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 18 }],
        explanation: "2 × (6 + 3) = 2 × 9 = 18.",
      },
      D: {
        prompt: "(12 - 4) × 2 = ? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 16 }],
        explanation: "(12 - 4) × 2 = 8 × 2 = 16.",
      },
    },
  },
  {
    slug: "math-g5-l02-writing-numerical-expressions",
    grade: 5,
    lessonNumber: 2,
    title: "Writing Numerical Expressions",
    mathSkill: "Writing and Evaluating Expressions (5.OA.A.2)",
    teaches: "Every slot describes a two-step calculation in words — translate it into an expression, work it out in order, and build the result as a drum beat with that many notes in all.",
    bpm: 106,
    challenges: {
      A: {
        prompt: "Add 6 and 4, then multiply by 3. What's the result? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 30 }],
        explanation: "(6 + 4) × 3 = 10 × 3 = 30.",
      },
      B: {
        prompt: "Subtract 2 from 9, then multiply by 5. What's the result? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 35 }],
        explanation: "(9 - 2) × 5 = 7 × 5 = 35.",
      },
      C: {
        prompt: "Multiply 4 by 3, then add 5. What's the result? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 17 }],
        explanation: "(4 × 3) + 5 = 12 + 5 = 17.",
      },
      D: {
        prompt: "Multiply 6 by 2, then subtract 3. What's the result? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 9 }],
        explanation: "(6 × 2) - 3 = 12 - 3 = 9.",
      },
    },
  },
  {
    slug: "math-g5-l03-powers-of-ten",
    grade: 5,
    lessonNumber: 3,
    title: "Powers of Ten",
    mathSkill: "Powers of 10 (5.NBT.A.1-2)",
    teaches: "Every slot multiplies a digit by a power of ten — the exponent tells you which place value it lands in; build how many of that unit the answer has.",
    bpm: 106,
    challenges: {
      A: {
        prompt: "3 × 10^1 = ? How many tens is that? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 3 }],
        explanation: "3 × 10^1 = 30, which is 3 tens.",
      },
      B: {
        prompt: "5 × 10^2 = ? How many hundreds is that? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 5 }],
        explanation: "5 × 10^2 = 500, which is 5 hundreds.",
      },
      C: {
        prompt: "2 × 10^3 = ? How many thousands is that? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 2 }],
        explanation: "2 × 10^3 = 2,000, which is 2 thousands.",
      },
      D: {
        prompt: "7 × 10^1 = ? How many tens is that? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 7 }],
        explanation: "7 × 10^1 = 70, which is 7 tens.",
      },
    },
  },
  {
    slug: "math-g5-l04-multiplying-multi-digit-numbers",
    grade: 5,
    lessonNumber: 4,
    title: "Multiplying Multi-Digit Numbers",
    mathSkill: "Multiply Multi-Digit Whole Numbers (5.NBT.B.5)",
    teaches: "Every slot multiplies two bigger numbers — the first is how many BLOCKS you use, the second is about how many notes go in each one. These run right up against how much a block can hold (up to 6 notes), so expect to reach for triplets and sixteenth notes, not just eighths.",
    bpm: 106,
    challenges: {
      A: {
        prompt: "8 × 5 = ? Build a drum beat using exactly 8 blocks that add up to 40 notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 40, blocksUsed: 8 }],
        explanation: "8 × 5 = 40 — 8 blocks holding 40 notes in all.",
      },
      B: {
        prompt: "7 × 6 = ? Build a drum beat using exactly 7 blocks that add up to 42 notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 42, blocksUsed: 7 }],
        explanation: "7 × 6 = 42 — 7 blocks holding 42 notes in all.",
      },
      C: {
        prompt: "8 × 6 = ? Build a drum beat using exactly 8 blocks that add up to 48 notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 48, blocksUsed: 8 }],
        explanation: "8 × 6 = 48 — 8 blocks holding 48 notes in all (every block completely full).",
      },
      D: {
        prompt: "7 × 5 = ? Build a drum beat using exactly 7 blocks that add up to 35 notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 35, blocksUsed: 7 }],
        explanation: "7 × 5 = 35 — 7 blocks holding 35 notes in all.",
      },
    },
  },
  {
    slug: "math-g5-l05-dividing-multi-digit-numbers",
    grade: 5,
    lessonNumber: 5,
    title: "Dividing Multi-Digit Numbers",
    mathSkill: "Divide Multi-Digit Numbers (5.NBT.B.6)",
    teaches: "Every slot divides a bigger number — the divisor is how many BLOCKS you use; build the whole dividend across exactly that many blocks, packing several notes into each one.",
    bpm: 106,
    challenges: {
      A: {
        prompt: "42 ÷ 7 = ? Build a drum beat using exactly 7 blocks that add up to 42 notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 42, blocksUsed: 7 }],
        explanation: "42 ÷ 7 = 6 — 7 blocks (groups), 6 in each, 42 in all.",
      },
      B: {
        prompt: "40 ÷ 8 = ? Build a drum beat using exactly 8 blocks that add up to 40 notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 40, blocksUsed: 8 }],
        explanation: "40 ÷ 8 = 5 — 8 blocks, 5 in each, 40 in all.",
      },
      C: {
        prompt: "48 ÷ 8 = ? Build a drum beat using exactly 8 blocks that add up to 48 notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 48, blocksUsed: 8 }],
        explanation: "48 ÷ 8 = 6 — 8 blocks, 6 in each, 48 in all (every block completely full).",
      },
      D: {
        prompt: "35 ÷ 7 = ? Build a drum beat using exactly 7 blocks that add up to 35 notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 35, blocksUsed: 7 }],
        explanation: "35 ÷ 7 = 5 — 7 blocks, 5 in each, 35 in all.",
      },
    },
  },
  {
    slug: "math-g5-l06-rounding-decimals",
    grade: 5,
    lessonNumber: 6,
    title: "Rounding Decimals",
    mathSkill: "Rounding Decimals (5.NBT.A.4)",
    teaches: "Every slot rounds a decimal — most to the nearest whole number, one to the nearest tenth; build the result's own digit anywhere in the kit.",
    bpm: 106,
    challenges: {
      A: {
        prompt: "Round 4.7 to the nearest whole number. Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 5 }],
        explanation: "4.7 rounds up to 5.",
      },
      B: {
        prompt: "Round 3.2 to the nearest whole number. Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 3 }],
        explanation: "3.2 rounds down to 3.",
      },
      C: {
        prompt: "Round 8.5 to the nearest whole number. Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 9 }],
        explanation: "8.5 rounds up to 9 (round up at the halfway point).",
      },
      D: {
        prompt: "Round 6.38 to the nearest tenth. The result is 6 and how many tenths? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 4 }],
        explanation: "6.38 rounds to 6.4 — 6 and 4 tenths.",
      },
    },
  },
  {
    slug: "math-g5-l07-adding-decimals",
    grade: 5,
    lessonNumber: 7,
    title: "Adding Decimals",
    mathSkill: "Add Decimals to Hundredths (5.NBT.B.7)",
    teaches: "Every slot adds two decimals — multiply the total by 10 to count it in tenths, then build that many notes across the kit. None of these fit as plain quarter notes; mix in eighth notes, triplets, and sixteenths to pack them all in.",
    bpm: 108,
    challenges: {
      A: {
        prompt: "3.2 + 1.5 = ? Build a drum beat with that many tenths in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 47 }],
        explanation: "3.2 + 1.5 = 4.7, which is 47 tenths.",
      },
      B: {
        prompt: "2.4 + 3.9 = ? Build a drum beat with that many tenths in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 63 }],
        explanation: "2.4 + 3.9 = 6.3, which is 63 tenths.",
      },
      C: {
        prompt: "5.6 + 2.7 = ? Build a drum beat with that many tenths in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 83 }],
        explanation: "5.6 + 2.7 = 8.3, which is 83 tenths.",
      },
      D: {
        prompt: "1.8 + 4.6 = ? Build a drum beat with that many tenths in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 64 }],
        explanation: "1.8 + 4.6 = 6.4, which is 64 tenths.",
      },
    },
  },
  {
    slug: "math-g5-l08-subtracting-decimals",
    grade: 5,
    lessonNumber: 8,
    title: "Subtracting Decimals",
    mathSkill: "Subtract Decimals to Hundredths (5.NBT.B.7)",
    teaches: "Every slot subtracts two decimals — multiply what's left by 10 to count it in tenths, then build that many notes across the kit, mixing in faster subdivisions to fit them.",
    bpm: 108,
    challenges: {
      A: {
        prompt: "8.4 - 3.6 = ? Build a drum beat with that many tenths in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 48 }],
        explanation: "8.4 - 3.6 = 4.8, which is 48 tenths.",
      },
      B: {
        prompt: "9.5 - 2.8 = ? Build a drum beat with that many tenths in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 67 }],
        explanation: "9.5 - 2.8 = 6.7, which is 67 tenths.",
      },
      C: {
        prompt: "7.3 - 4.5 = ? Build a drum beat with that many tenths in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 28 }],
        explanation: "7.3 - 4.5 = 2.8, which is 28 tenths.",
      },
      D: {
        prompt: "6.1 - 2.4 = ? Build a drum beat with that many tenths in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 37 }],
        explanation: "6.1 - 2.4 = 3.7, which is 37 tenths.",
      },
    },
  },
  {
    slug: "math-g5-l09-multiplying-decimals",
    grade: 5,
    lessonNumber: 9,
    title: "Multiplying Decimals",
    mathSkill: "Multiply Decimals (5.NBT.B.7)",
    teaches: "Every slot multiplies a decimal by a whole number — the whole number is how many BLOCKS you use, and the notes packed into each one are the decimal counted in tenths; build the total (also in tenths) across exactly that many blocks.",
    bpm: 108,
    challenges: {
      A: {
        prompt: "0.5 × 6 = ? Build a drum beat using exactly 6 blocks that add up to 30 tenths in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 30, blocksUsed: 6 }],
        explanation: "0.5 × 6 = 3.0 — 6 blocks (the whole number), 5 tenths in each, 30 tenths in all.",
      },
      B: {
        prompt: "0.3 × 8 = ? Build a drum beat using exactly 8 blocks that add up to 24 tenths in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 24, blocksUsed: 8 }],
        explanation: "0.3 × 8 = 2.4 — 8 blocks, 3 tenths in each, 24 tenths in all.",
      },
      C: {
        prompt: "0.4 × 5 = ? Build a drum beat using exactly 5 blocks that add up to 20 tenths in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 20, blocksUsed: 5 }],
        explanation: "0.4 × 5 = 2.0 — 5 blocks, 4 tenths in each, 20 tenths in all.",
      },
      D: {
        prompt: "0.2 × 7 = ? Build a drum beat using exactly 7 blocks that add up to 14 tenths in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 14, blocksUsed: 7 }],
        explanation: "0.2 × 7 = 1.4 — 7 blocks, 2 tenths in each, 14 tenths in all.",
      },
    },
  },
  {
    slug: "math-g5-l10-dividing-decimals",
    grade: 5,
    lessonNumber: 10,
    title: "Dividing Decimals",
    mathSkill: "Divide Decimals (5.NBT.B.7)",
    teaches: "Every slot divides a decimal by a whole number — multiply the answer by 10 to count it in tenths, then build that many notes anywhere in the kit.",
    bpm: 108,
    challenges: {
      A: {
        prompt: "4.8 ÷ 6 = ? Build a drum beat with that many tenths in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 8 }],
        explanation: "4.8 ÷ 6 = 0.8, which is 8 tenths.",
      },
      B: {
        prompt: "6.3 ÷ 7 = ? Build a drum beat with that many tenths in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 9 }],
        explanation: "6.3 ÷ 7 = 0.9, which is 9 tenths.",
      },
      C: {
        prompt: "8.4 ÷ 4 = ? Build a drum beat with that many tenths in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 21 }],
        explanation: "8.4 ÷ 4 = 2.1, which is 21 tenths.",
      },
      D: {
        prompt: "9.6 ÷ 8 = ? Build a drum beat with that many tenths in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 12 }],
        explanation: "9.6 ÷ 8 = 1.2, which is 12 tenths.",
      },
    },
  },
  {
    slug: "math-g5-l11-comparing-decimals-to-thousandths",
    grade: 5,
    lessonNumber: 11,
    title: "Comparing Decimals to Thousandths",
    mathSkill: "Compare Decimals to Thousandths (5.NBT.A.3b)",
    teaches: "Every slot compares two decimals down to the thousandths place — figure out which is bigger, then build the digit that actually decided it, anywhere in the kit.",
    bpm: 108,
    challenges: {
      A: {
        prompt: "Which is bigger: 0.456 or 0.465? Build a drum beat with the BIGGER decimal's hundredths digit, in quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 6 }],
        explanation: "0.465 > 0.456 — the tenths match (4), so the hundredths digit (6 vs 5) decides it.",
      },
      B: {
        prompt: "Which is bigger: 0.72 or 0.719? Build a drum beat with the BIGGER decimal's hundredths digit, in quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 2 }],
        explanation: "0.72 (0.720) > 0.719 — the tenths match (7), so the hundredths digit (2 vs 1) decides it.",
      },
      C: {
        prompt: "Which is bigger: 0.6 or 0.599? Build a drum beat with the BIGGER decimal's tenths digit, in quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 6 }],
        explanation: "0.6 (0.600) > 0.599 — the tenths digit (6 vs 5) decides it.",
      },
      D: {
        prompt: "Which is bigger: 0.834 or 0.843? Build a drum beat with the BIGGER decimal's hundredths digit, in quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 4 }],
        explanation: "0.843 > 0.834 — the tenths match (8), so the hundredths digit (4 vs 3) decides it.",
      },
    },
  },
  {
    slug: "math-g5-l12-adding-fractions-unlike-denominators",
    grade: 5,
    lessonNumber: 12,
    title: "Adding Fractions with Unlike Denominators",
    mathSkill: "Add Fractions with Unlike Denominators (5.NF.A.1)",
    teaches: "Every slot adds two fractions with different denominators — rewrite both over a common denominator first, then add just the numerators, and build that total anywhere in the kit.",
    bpm: 108,
    challenges: {
      A: {
        prompt: "1/2 + 1/3 = ? (common denominator 6) Build a drum beat with the numerator of the answer, in quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 5 }],
        explanation: "1/2 + 1/3 = 3/6 + 2/6 = 5/6.",
      },
      B: {
        prompt: "1/4 + 1/6 = ? (common denominator 12) Build a drum beat with the numerator of the answer, in quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 5 }],
        explanation: "1/4 + 1/6 = 3/12 + 2/12 = 5/12.",
      },
      C: {
        prompt: "2/3 + 1/4 = ? (common denominator 12) Build a drum beat with the numerator of the answer, in quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 11 }],
        explanation: "2/3 + 1/4 = 8/12 + 3/12 = 11/12.",
      },
      D: {
        prompt: "1/2 + 2/5 = ? (common denominator 10) Build a drum beat with the numerator of the answer, in quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 9 }],
        explanation: "1/2 + 2/5 = 5/10 + 4/10 = 9/10.",
      },
    },
  },
  {
    slug: "math-g5-l13-subtracting-fractions-unlike-denominators",
    grade: 5,
    lessonNumber: 13,
    title: "Subtracting Fractions with Unlike Denominators",
    mathSkill: "Subtract Fractions with Unlike Denominators (5.NF.A.1)",
    teaches: "Every slot subtracts two fractions with different denominators — rewrite both over a common denominator first, then subtract just the numerators, and build what's left anywhere in the kit.",
    bpm: 108,
    challenges: {
      A: {
        prompt: "3/4 - 1/3 = ? (common denominator 12) Build a drum beat with the numerator of the answer, in quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 5 }],
        explanation: "3/4 - 1/3 = 9/12 - 4/12 = 5/12.",
      },
      B: {
        prompt: "5/6 - 1/2 = ? (common denominator 6) Build a drum beat with the numerator of the answer, in quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 2 }],
        explanation: "5/6 - 1/2 = 5/6 - 3/6 = 2/6.",
      },
      C: {
        prompt: "2/3 - 1/4 = ? (common denominator 12) Build a drum beat with the numerator of the answer, in quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 5 }],
        explanation: "2/3 - 1/4 = 8/12 - 3/12 = 5/12.",
      },
      D: {
        prompt: "7/8 - 1/2 = ? (common denominator 8) Build a drum beat with the numerator of the answer, in quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 3 }],
        explanation: "7/8 - 1/2 = 7/8 - 4/8 = 3/8.",
      },
    },
  },
  {
    slug: "math-g5-l14-multiplying-fractions",
    grade: 5,
    lessonNumber: 14,
    title: "Multiplying Fractions",
    mathSkill: "Multiply Fraction by Fraction (5.NF.B.4)",
    teaches: "Every slot multiplies two fractions — multiply the numerators together for the new numerator, then build that many quarter notes anywhere in the kit.",
    bpm: 108,
    challenges: {
      A: {
        prompt: "1/2 × 2/3 = ? Build a drum beat with the numerator of the answer, in quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 2 }],
        explanation: "1/2 × 2/3 = (1×2)/(2×3) = 2/6.",
      },
      B: {
        prompt: "3/4 × 2/5 = ? Build a drum beat with the numerator of the answer, in quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 6 }],
        explanation: "3/4 × 2/5 = (3×2)/(4×5) = 6/20.",
      },
      C: {
        prompt: "2/3 × 3/4 = ? Build a drum beat with the numerator of the answer, in quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 6 }],
        explanation: "2/3 × 3/4 = (2×3)/(3×4) = 6/12.",
      },
      D: {
        prompt: "1/3 × 3/5 = ? Build a drum beat with the numerator of the answer, in quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 3 }],
        explanation: "1/3 × 3/5 = (1×3)/(3×5) = 3/15.",
      },
    },
  },
  {
    slug: "math-g5-l15-area-with-fractional-side-lengths",
    grade: 5,
    lessonNumber: 15,
    title: "Area with Fractional Side Lengths",
    mathSkill: "Area with Fractional Side Lengths (5.NF.B.4b)",
    teaches: "Every slot gives a rectangle with fraction side lengths — its area is the two fractions multiplied together; build the numerator of that area anywhere in the kit.",
    bpm: 108,
    challenges: {
      A: {
        prompt: "A rectangle is 2/3 unit long and 3/4 unit wide. What is its area? Build a drum beat with the numerator of the answer, in quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 6 }],
        explanation: "Area = 2/3 × 3/4 = 6/12.",
      },
      B: {
        prompt: "A rectangle is 1/2 unit long and 2/5 unit wide. What is its area? Build a drum beat with the numerator of the answer, in quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 2 }],
        explanation: "Area = 1/2 × 2/5 = 2/10.",
      },
      C: {
        prompt: "A rectangle is 3/5 unit long and 1/2 unit wide. What is its area? Build a drum beat with the numerator of the answer, in quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 3 }],
        explanation: "Area = 3/5 × 1/2 = 3/10.",
      },
      D: {
        prompt: "A rectangle is 2/3 unit long and 1/4 unit wide. What is its area? Build a drum beat with the numerator of the answer, in quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 2 }],
        explanation: "Area = 2/3 × 1/4 = 2/12.",
      },
    },
  },
  {
    slug: "math-g5-l16-dividing-a-unit-fraction-by-a-whole-number",
    grade: 5,
    lessonNumber: 16,
    title: "Dividing a Unit Fraction by a Whole Number",
    mathSkill: "Divide a Unit Fraction by a Whole Number (5.NF.B.7a)",
    teaches: "Every slot divides a unit fraction by a whole number — the new denominator is the old one multiplied by that whole number; build the denominator anywhere in the kit.",
    bpm: 108,
    challenges: {
      A: {
        prompt: "1/3 ÷ 4 = ? Build a drum beat with the denominator of the answer, in quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 12 }],
        explanation: "1/3 ÷ 4 = 1/12 — the denominator becomes 3 × 4 = 12.",
      },
      B: {
        prompt: "1/2 ÷ 5 = ? Build a drum beat with the denominator of the answer, in quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 10 }],
        explanation: "1/2 ÷ 5 = 1/10 — the denominator becomes 2 × 5 = 10.",
      },
      C: {
        prompt: "1/4 ÷ 3 = ? Build a drum beat with the denominator of the answer, in quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 12 }],
        explanation: "1/4 ÷ 3 = 1/12 — the denominator becomes 4 × 3 = 12.",
      },
      D: {
        prompt: "1/5 ÷ 2 = ? Build a drum beat with the denominator of the answer, in quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 10 }],
        explanation: "1/5 ÷ 2 = 1/10 — the denominator becomes 5 × 2 = 10.",
      },
    },
  },
  {
    slug: "math-g5-l17-dividing-a-whole-number-by-a-unit-fraction",
    grade: 5,
    lessonNumber: 17,
    title: "Dividing a Whole Number by a Unit Fraction",
    mathSkill: "Divide a Whole Number by a Unit Fraction (5.NF.B.7b)",
    teaches: "Every slot divides a whole number by a unit fraction — the whole number is how many BLOCKS you use, and the fraction's denominator is how many notes fit in each block (splitting every whole into that many equal pieces); build the total across exactly that many blocks.",
    bpm: 108,
    challenges: {
      A: {
        prompt: "6 ÷ 1/3 = ? Build a drum beat using exactly 6 blocks that add up to 18 notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 18, blocksUsed: 6 }],
        explanation: "6 ÷ 1/3 = 18 — 6 blocks (the wholes), each split into 3 thirds, 18 in all.",
      },
      B: {
        prompt: "4 ÷ 1/2 = ? Build a drum beat using exactly 4 blocks that add up to 8 notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 8, blocksUsed: 4 }],
        explanation: "4 ÷ 1/2 = 8 — 4 blocks, each split into 2 halves, 8 in all.",
      },
      C: {
        prompt: "5 ÷ 1/4 = ? Build a drum beat using exactly 5 blocks that add up to 20 notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 20, blocksUsed: 5 }],
        explanation: "5 ÷ 1/4 = 20 — 5 blocks, each split into 4 quarters, 20 in all.",
      },
      D: {
        prompt: "3 ÷ 1/5 = ? Build a drum beat using exactly 3 blocks that add up to 15 notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 15, blocksUsed: 3 }],
        explanation: "3 ÷ 1/5 = 15 — 3 blocks, each split into 5 fifths, 15 in all.",
      },
    },
  },
  {
    slug: "math-g5-l18-converting-measurement-units",
    grade: 5,
    lessonNumber: 18,
    title: "Converting Measurement Units",
    mathSkill: "Convert Measurement Units (5.MD.A.1)",
    teaches: "Every slot converts between units within the same measurement system — figure out the new count, then build that many notes anywhere in the kit.",
    bpm: 110,
    challenges: {
      A: {
        prompt: "How many cups are in 3 quarts? (1 quart = 4 cups) Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 12 }],
        explanation: "3 quarts × 4 cups = 12 cups.",
      },
      B: {
        prompt: "How many ounces are in 2 pounds? (1 pound = 16 ounces) Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 32 }],
        explanation: "2 pounds × 16 ounces = 32 ounces.",
      },
      C: {
        prompt: "How many feet are in 4 yards? (1 yard = 3 feet) Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 12 }],
        explanation: "4 yards × 3 feet = 12 feet.",
      },
      D: {
        prompt: "How many inches are in 2 feet? (1 foot = 12 inches) Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 24 }],
        explanation: "2 feet × 12 inches = 24 inches.",
      },
    },
  },
  {
    slug: "math-g5-l19-volume-of-rectangular-prisms",
    grade: 5,
    lessonNumber: 19,
    title: "Volume of Rectangular Prisms",
    mathSkill: "Volume of Rectangular Prisms (5.MD.C.5)",
    teaches: "Every slot gives a box's three dimensions — multiply length × width × height for its volume, then build that many notes anywhere in the kit.",
    bpm: 110,
    challenges: {
      A: {
        prompt: "A box is 3 units long, 2 units wide, and 4 units tall. What is its volume? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 24 }],
        explanation: "Volume = 3 × 2 × 4 = 24.",
      },
      B: {
        prompt: "A box is 2 units long, 3 units wide, and 5 units tall. What is its volume? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 30 }],
        explanation: "Volume = 2 × 3 × 5 = 30.",
      },
      C: {
        prompt: "A box is 5 units long, 2 units wide, and 2 units tall. What is its volume? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 20 }],
        explanation: "Volume = 5 × 2 × 2 = 20.",
      },
      D: {
        prompt: "A box is 3 units long, 3 units wide, and 2 units tall. What is its volume? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 18 }],
        explanation: "Volume = 3 × 3 × 2 = 18.",
      },
    },
  },
  {
    slug: "math-g5-l20-line-plots-with-fractional-data",
    grade: 5,
    lessonNumber: 20,
    title: "Line Plots with Fractional Data",
    mathSkill: "Line Plots with Fractional Data (5.MD.B.2)",
    teaches: "Every slot reads a line plot measured in fraction-inch units — build each group's count on its own instrument, straight from the plot.",
    bpm: 110,
    challenges: {
      A: {
        prompt: "A line plot shows plant heights in 1/4-inch units: 3 plants at 2 1/4 in, 5 plants at 2 1/2 in. Build a bass drum row for the 2 1/4-inch plants and a snare row for the 2 1/2-inch plants.",
        targets: [
          { instrument: "kick", count: 3 },
          { instrument: "snare", count: 5 },
        ],
        explanation: "2 1/4 in: 3 plants. 2 1/2 in: 5 plants — straight from the plot.",
      },
      B: {
        prompt: "A line plot shows pencil lengths in 1/2-inch units: 4 pencils at 5 in, 6 pencils at 5 1/2 in. Build a bass drum row for the 5-inch pencils and a snare row for the 5 1/2-inch pencils.",
        targets: [
          { instrument: "kick", count: 4 },
          { instrument: "snare", count: 6 },
        ],
        explanation: "5 in: 4 pencils. 5 1/2 in: 6 pencils.",
      },
      C: {
        prompt: "A line plot shows ribbon lengths in 1/4-inch units: 2 ribbons at 3 in, 7 ribbons at 3 1/4 in. Build a bass drum row for the 3-inch ribbons and a snare row for the 3 1/4-inch ribbons.",
        targets: [
          { instrument: "kick", count: 2 },
          { instrument: "snare", count: 7 },
        ],
        explanation: "3 in: 2 ribbons. 3 1/4 in: 7 ribbons.",
      },
      D: {
        prompt: "A line plot shows leaf widths in 1/2-inch units: 5 leaves at 1 in, 3 leaves at 1 1/2 in. Build a bass drum row for the 1-inch leaves and a snare row for the 1 1/2-inch leaves.",
        targets: [
          { instrument: "kick", count: 5 },
          { instrument: "snare", count: 3 },
        ],
        explanation: "1 in: 5 leaves. 1 1/2 in: 3 leaves.",
      },
    },
  },
  {
    slug: "math-g5-l21-coordinate-plane-plotting-points",
    grade: 5,
    lessonNumber: 21,
    title: "Coordinate Plane: Plotting Points",
    mathSkill: "Plotting Points on the Coordinate Plane (5.G.A.1-2)",
    teaches: "Every slot gives an ordered pair — build the x-coordinate on the bass drum and the y-coordinate on the snare.",
    bpm: 110,
    challenges: {
      A: {
        prompt: "Plot the point (3, 5). Build a bass drum row with the x-coordinate and a snare row with the y-coordinate, in quarter notes.",
        targets: [
          { instrument: "kick", count: 3 },
          { instrument: "snare", count: 5 },
        ],
        explanation: "(3, 5) — x = 3, y = 5.",
      },
      B: {
        prompt: "Plot the point (4, 2). Build a bass drum row with the x-coordinate and a snare row with the y-coordinate, in quarter notes.",
        targets: [
          { instrument: "kick", count: 4 },
          { instrument: "snare", count: 2 },
        ],
        explanation: "(4, 2) — x = 4, y = 2.",
      },
      C: {
        prompt: "Plot the point (6, 1). Build a bass drum row with the x-coordinate and a snare row with the y-coordinate, in quarter notes.",
        targets: [
          { instrument: "kick", count: 6 },
          { instrument: "snare", count: 1 },
        ],
        explanation: "(6, 1) — x = 6, y = 1.",
      },
      D: {
        prompt: "Plot the point (2, 7). Build a bass drum row with the x-coordinate and a snare row with the y-coordinate, in quarter notes.",
        targets: [
          { instrument: "kick", count: 2 },
          { instrument: "snare", count: 7 },
        ],
        explanation: "(2, 7) — x = 2, y = 7.",
      },
    },
  },
  {
    slug: "math-g5-l22-classifying-shapes-in-a-hierarchy",
    grade: 5,
    lessonNumber: 22,
    title: "Classifying Shapes in a Hierarchy",
    mathSkill: "Classify Shapes in a Hierarchy (5.G.B.3-4)",
    teaches: "Every slot names a shape from a chain of categories (square → rectangle → parallelogram → quadrilateral) — every shape in the chain shares the feature being asked about; build that many quarter notes anywhere in the kit.",
    bpm: 110,
    challenges: {
      A: {
        prompt: "A square is a rectangle, which is a parallelogram, which is a quadrilateral. How many sides does every shape in that chain have? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 4 }],
        explanation: "Every shape in the chain is a quadrilateral, so every one has 4 sides.",
      },
      B: {
        prompt: "A rhombus is a parallelogram, which is a quadrilateral. How many sides does every shape in that chain have? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 4 }],
        explanation: "Every shape in the chain is a quadrilateral, so every one has 4 sides.",
      },
      C: {
        prompt: "A square is also a rectangle. How many right angles does it have? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 4 }],
        explanation: "A square inherits every rectangle property, including 4 right angles.",
      },
      D: {
        prompt: "A rhombus is also a parallelogram. How many pairs of parallel sides does it have? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 2 }],
        explanation: "A rhombus inherits every parallelogram property, including 2 pairs of parallel sides.",
      },
    },
  },
  {
    slug: "math-g5-l23-multi-step-word-problems",
    grade: 5,
    lessonNumber: 23,
    title: "Multi-Step Word Problems",
    mathSkill: "Multi-Step Word Problems (5.OA/5.NBT)",
    teaches: "Every slot takes two steps to solve — work through them in order, then build the final total anywhere in the kit. These are big enough that plain quarter notes won't fit; mix in faster subdivisions.",
    bpm: 110,
    challenges: {
      A: {
        prompt: "A store has 6 boxes of 8 pens each. They sell 15 pens. How many pens are left? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 33 }],
        explanation: "6 × 8 = 48, then 48 - 15 = 33.",
      },
      B: {
        prompt: "A baker makes 5 trays of 12 cookies each, then gives away 20. How many are left? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 40 }],
        explanation: "5 × 12 = 60, then 60 - 20 = 40.",
      },
      C: {
        prompt: "A class raises money in 4 groups of $15 each, then spends $25. How much is left? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 35 }],
        explanation: "4 × 15 = 60, then 60 - 25 = 35.",
      },
      D: {
        prompt: "A garden has 7 rows of 6 flowers each, then 10 more are planted. How many flowers in all? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 52 }],
        explanation: "7 × 6 = 42, then 42 + 10 = 52.",
      },
    },
  },
  {
    slug: "math-g5-l24-patterns-two-rules-ordered-pairs",
    grade: 5,
    lessonNumber: 24,
    title: "Patterns: Two Rules, Ordered Pairs",
    mathSkill: "Patterns from Two Rules (5.OA.B.3)",
    teaches: "Every slot runs two number patterns side by side from the same starting point — follow the second rule out to the given step, and build that many notes anywhere in the kit, the last lesson of the year.",
    bpm: 110,
    challenges: {
      A: {
        prompt: "Rule 1: start at 0, add 2 each time. Rule 2: start at 0, add 4 each time. After 3 steps, what is Rule 2's number? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 12 }],
        explanation: "Rule 2: 4, 8, 12 — after 3 steps, 12.",
      },
      B: {
        prompt: "Rule 1: start at 0, add 3 each time. Rule 2: start at 0, add 6 each time. After 4 steps, what is Rule 2's number? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 24 }],
        explanation: "Rule 2: 6, 12, 18, 24 — after 4 steps, 24.",
      },
      C: {
        prompt: "Rule 1: start at 0, add 2 each time. Rule 2: start at 0, add 8 each time. After 2 steps, what is Rule 2's number? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 16 }],
        explanation: "Rule 2: 8, 16 — after 2 steps, 16.",
      },
      D: {
        prompt: "Rule 1: start at 0, add 5 each time. Rule 2: start at 0, add 10 each time. After 3 steps, what is Rule 2's number? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 30 }],
        explanation: "Rule 2: 10, 20, 30 — after 3 steps, 30.",
      },
    },
  },

  // ============================================================
  // GRADE 6 — ratios and rates open the fall (the year's real new idea:
  // one quantity scaling another), negative numbers and exponents lead
  // into winter, expressions and one-step equations fill early spring,
  // and geometry (triangles, parallelograms, surface area) with
  // statistics (mean, median, range) close out the year — the real
  // Common Core Grade 6 progression. A ratio is itself a scaling
  // relationship, so it's the best fit yet for the blocks mechanic: a
  // ratio's second term becomes how many notes go in each block, and how
  // many times that ratio repeats becomes how many blocks — ratio tables,
  // unit-rate scaling, multi-digit division, and triangle/parallelogram
  // area all get the same treatment. Numbers stay big enough all year
  // that a plain row of quarter notes won't hold most answers.
  // ============================================================
  {
    slug: "math-g6-l01-ratios-and-ratio-language",
    grade: 6,
    lessonNumber: 1,
    title: "Ratios and Ratio Language",
    mathSkill: "Ratio Language (6.RP.A.1)",
    teaches: "Every slot gives a ratio and a number of groups of it — the groups are how many BLOCKS you use, and the ratio's own term is about how many notes go in each block; build the total across exactly that many blocks.",
    bpm: 112,
    challenges: {
      A: {
        prompt: "The ratio of cats to dogs is 2:3. If there are 4 groups of this ratio, how many dogs are there? Build a drum beat using exactly 4 blocks that add up to 12 notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 12, blocksUsed: 4 }],
        explanation: "4 groups of a 2:3 ratio means 4 × 3 = 12 dogs — 4 blocks holding 12 notes in all.",
      },
      B: {
        prompt: "The ratio of red to blue marbles is 3:5. If there are 3 groups of this ratio, how many blue marbles are there? Build a drum beat using exactly 3 blocks that add up to 15 notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 15, blocksUsed: 3 }],
        explanation: "3 groups of a 3:5 ratio means 3 × 5 = 15 blue marbles.",
      },
      C: {
        prompt: "The ratio of boys to girls is 1:4. If there are 5 groups of this ratio, how many girls are there? Build a drum beat using exactly 5 blocks that add up to 20 notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 20, blocksUsed: 5 }],
        explanation: "5 groups of a 1:4 ratio means 5 × 4 = 20 girls.",
      },
      D: {
        prompt: "The ratio of apples to oranges is 2:1. If there are 6 groups of this ratio, how many apples are there? Build a drum beat using exactly 6 blocks that add up to 12 notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 12, blocksUsed: 6 }],
        explanation: "6 groups of a 2:1 ratio means 6 × 2 = 12 apples.",
      },
    },
  },
  {
    slug: "math-g6-l02-ratio-tables",
    grade: 6,
    lessonNumber: 2,
    title: "Ratio Tables",
    mathSkill: "Ratio Tables (6.RP.A.3a)",
    teaches: "Every slot scales a recipe or rate up by a number of batches — the batches are how many BLOCKS you use, and the per-batch amount is about how many notes go in each one.",
    bpm: 112,
    challenges: {
      A: {
        prompt: "A recipe uses 2 cups of flour for every 1 cup of sugar. Build a drum beat using exactly 5 blocks that add up to 10 notes in all — the flour needed for 5 batches.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 10, blocksUsed: 5 }],
        explanation: "5 batches × 2 cups of flour = 10 cups — 5 blocks holding 10 notes in all.",
      },
      B: {
        prompt: "A paint mix uses 3 parts red for every 1 part white. Build a drum beat using exactly 4 blocks that add up to 12 notes in all — the red paint needed for 4 batches.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 12, blocksUsed: 4 }],
        explanation: "4 batches × 3 parts red = 12 parts.",
      },
      C: {
        prompt: "A school keeps 1 teacher for every 6 students. Build a drum beat using exactly 3 blocks that add up to 18 notes in all — the students across 3 classes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 18, blocksUsed: 3 }],
        explanation: "3 classes × 6 students = 18 students.",
      },
      D: {
        prompt: "A car travels 5 miles for every 1 hour. Build a drum beat using exactly 4 blocks that add up to 20 notes in all — the miles traveled in 4 hours.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 20, blocksUsed: 4 }],
        explanation: "4 hours × 5 miles = 20 miles.",
      },
    },
  },
  {
    slug: "math-g6-l03-unit-rates",
    grade: 6,
    lessonNumber: 3,
    title: "Unit Rates",
    mathSkill: "Unit Rates (6.RP.A.2)",
    teaches: "Every slot gives a total and how many it took — divide to find the rate for just one, then build that many notes anywhere in the kit.",
    bpm: 112,
    challenges: {
      A: {
        prompt: "A car travels 120 miles in 4 hours. What is the unit rate, in miles per hour? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 30 }],
        explanation: "120 ÷ 4 = 30 miles per hour.",
      },
      B: {
        prompt: "A recipe uses 18 cups of flour across 6 batches. What is the unit rate, in cups per batch? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 3 }],
        explanation: "18 ÷ 6 = 3 cups per batch.",
      },
      C: {
        prompt: "9 items cost $45. What is the unit rate, in dollars per item? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 5 }],
        explanation: "45 ÷ 9 = 5 dollars per item.",
      },
      D: {
        prompt: "150 words are typed in 5 minutes. What is the unit rate, in words per minute? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 30 }],
        explanation: "150 ÷ 5 = 30 words per minute.",
      },
    },
  },
  {
    slug: "math-g6-l04-solving-unit-rate-problems",
    grade: 6,
    lessonNumber: 4,
    title: "Solving Unit Rate Problems",
    mathSkill: "Solve Unit Rate Problems (6.RP.A.3b)",
    teaches: "Every slot gives a unit rate, then asks for a bigger amount — the new amount you're scaling to is how many BLOCKS you use, and the unit rate itself is about how many notes go in each block.",
    bpm: 112,
    challenges: {
      A: {
        prompt: "Apples cost $3 per pound. Build a drum beat using exactly 5 blocks that add up to 15 notes in all — the cost for 5 pounds.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 15, blocksUsed: 5 }],
        explanation: "5 pounds × $3 = $15 — 5 blocks holding 15 notes in all.",
      },
      B: {
        prompt: "A printer prints 4 pages per minute. Build a drum beat using exactly 6 blocks that add up to 24 notes in all — the pages printed in 6 minutes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 24, blocksUsed: 6 }],
        explanation: "6 minutes × 4 pages = 24 pages.",
      },
      C: {
        prompt: "A car uses 2 gallons of gas per trip. Build a drum beat using exactly 7 blocks that add up to 14 notes in all — the gallons used across 7 trips.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 14, blocksUsed: 7 }],
        explanation: "7 trips × 2 gallons = 14 gallons.",
      },
      D: {
        prompt: "A factory makes 5 toys per hour. Build a drum beat using exactly 4 blocks that add up to 20 notes in all — the toys made in 4 hours.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 20, blocksUsed: 4 }],
        explanation: "4 hours × 5 toys = 20 toys.",
      },
    },
  },
  {
    slug: "math-g6-l05-percent-of-a-quantity",
    grade: 6,
    lessonNumber: 5,
    title: "Percent of a Quantity",
    mathSkill: "Find a Percent of a Quantity (6.RP.A.3c)",
    teaches: "Every slot asks for a percent of a number — turn the percent into a fraction or decimal, multiply, and build the result anywhere in the kit.",
    bpm: 112,
    challenges: {
      A: {
        prompt: "What is 50% of 40? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 20 }],
        explanation: "50% of 40 = 0.5 × 40 = 20.",
      },
      B: {
        prompt: "What is 25% of 60? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 15 }],
        explanation: "25% of 60 = 0.25 × 60 = 15.",
      },
      C: {
        prompt: "What is 10% of 90? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 9 }],
        explanation: "10% of 90 = 0.1 × 90 = 9.",
      },
      D: {
        prompt: "What is 20% of 35? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 7 }],
        explanation: "20% of 35 = 0.2 × 35 = 7.",
      },
    },
  },
  {
    slug: "math-g6-l06-dividing-fractions-by-fractions",
    grade: 6,
    lessonNumber: 6,
    title: "Dividing Fractions by Fractions",
    mathSkill: "Divide Fractions by Fractions (6.NS.A.1)",
    teaches: "Every slot divides one fraction by another — flip the second fraction and multiply, then build the numerator of the result anywhere in the kit.",
    bpm: 112,
    challenges: {
      A: {
        prompt: "1/2 ÷ 1/4 = ? Build a drum beat with the numerator of the answer (before simplifying), in quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 4 }],
        explanation: "1/2 ÷ 1/4 = 1/2 × 4/1 = 4/2 = 2.",
      },
      B: {
        prompt: "2/3 ÷ 1/6 = ? Build a drum beat with the numerator of the answer (before simplifying), in quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 12 }],
        explanation: "2/3 ÷ 1/6 = 2/3 × 6/1 = 12/3 = 4.",
      },
      C: {
        prompt: "3/4 ÷ 1/2 = ? Build a drum beat with the numerator of the answer (before simplifying), in quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 6 }],
        explanation: "3/4 ÷ 1/2 = 3/4 × 2/1 = 6/4 = 1.5.",
      },
      D: {
        prompt: "1/3 ÷ 1/6 = ? Build a drum beat with the numerator of the answer (before simplifying), in quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 6 }],
        explanation: "1/3 ÷ 1/6 = 1/3 × 6/1 = 6/3 = 2.",
      },
    },
  },
  {
    slug: "math-g6-l07-multi-digit-division",
    grade: 6,
    lessonNumber: 7,
    title: "Multi-Digit Division",
    mathSkill: "Divide Multi-Digit Numbers (6.NS.B.2)",
    teaches: "Every slot divides a bigger number — the divisor is how many BLOCKS you use; build the whole dividend across exactly that many blocks, most of them completely full.",
    bpm: 112,
    challenges: {
      A: {
        prompt: "42 ÷ 7 = ? Build a drum beat using exactly 7 blocks that add up to 42 notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 42, blocksUsed: 7 }],
        explanation: "42 ÷ 7 = 6 — 7 blocks, 6 in each, 42 in all (every block completely full).",
      },
      B: {
        prompt: "40 ÷ 8 = ? Build a drum beat using exactly 8 blocks that add up to 40 notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 40, blocksUsed: 8 }],
        explanation: "40 ÷ 8 = 5 — 8 blocks, 5 in each, 40 in all.",
      },
      C: {
        prompt: "36 ÷ 6 = ? Build a drum beat using exactly 6 blocks that add up to 36 notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 36, blocksUsed: 6 }],
        explanation: "36 ÷ 6 = 6 — 6 blocks, 6 in each, 36 in all (every block completely full).",
      },
      D: {
        prompt: "48 ÷ 8 = ? Build a drum beat using exactly 8 blocks that add up to 48 notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 48, blocksUsed: 8 }],
        explanation: "48 ÷ 8 = 6 — 8 blocks, 6 in each, 48 in all (every block completely full).",
      },
    },
  },
  {
    slug: "math-g6-l08-operations-with-decimals",
    grade: 6,
    lessonNumber: 8,
    title: "Operations with Decimals",
    mathSkill: "Multiply and Divide Decimals (6.NS.B.3)",
    teaches: "Every slot multiplies or divides with decimals — for multiplication, the whole number is how many BLOCKS you use; for division, just build the result counted in tenths, anywhere in the kit.",
    bpm: 112,
    challenges: {
      A: {
        prompt: "0.6 × 5 = ? Build a drum beat using exactly 5 blocks that add up to 30 tenths in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 30, blocksUsed: 5 }],
        explanation: "0.6 × 5 = 3.0 — 5 blocks (the whole number), 6 tenths in each, 30 tenths in all.",
      },
      B: {
        prompt: "0.5 × 7 = ? Build a drum beat using exactly 7 blocks that add up to 35 tenths in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 35, blocksUsed: 7 }],
        explanation: "0.5 × 7 = 3.5 — 7 blocks, 5 tenths in each, 35 tenths in all.",
      },
      C: {
        prompt: "5.6 ÷ 7 = ? Build a drum beat with that many tenths in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 8 }],
        explanation: "5.6 ÷ 7 = 0.8, which is 8 tenths.",
      },
      D: {
        prompt: "8.1 ÷ 9 = ? Build a drum beat with that many tenths in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 9 }],
        explanation: "8.1 ÷ 9 = 0.9, which is 9 tenths.",
      },
    },
  },
  {
    slug: "math-g6-l09-greatest-common-factor",
    grade: 6,
    lessonNumber: 9,
    title: "Greatest Common Factor",
    mathSkill: "Greatest Common Factor (6.NS.B.4)",
    teaches: "Every slot gives two numbers — find their greatest common factor, then build that many quarter notes anywhere in the kit.",
    bpm: 114,
    challenges: {
      A: {
        prompt: "What is the greatest common factor (GCF) of 12 and 18? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 6 }],
        explanation: "12 = 2×2×3, 18 = 2×3×3 — the GCF is 2×3 = 6.",
      },
      B: {
        prompt: "What is the greatest common factor (GCF) of 8 and 20? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 4 }],
        explanation: "8 = 2×2×2, 20 = 2×2×5 — the GCF is 2×2 = 4.",
      },
      C: {
        prompt: "What is the greatest common factor (GCF) of 15 and 25? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 5 }],
        explanation: "15 = 3×5, 25 = 5×5 — the GCF is 5.",
      },
      D: {
        prompt: "What is the greatest common factor (GCF) of 9 and 24? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 3 }],
        explanation: "9 = 3×3, 24 = 2×2×2×3 — the GCF is 3.",
      },
    },
  },
  {
    slug: "math-g6-l10-least-common-multiple",
    grade: 6,
    lessonNumber: 10,
    title: "Least Common Multiple",
    mathSkill: "Least Common Multiple (6.NS.B.4)",
    teaches: "Every slot gives two numbers — find their least common multiple, then build that many notes anywhere in the kit.",
    bpm: 114,
    challenges: {
      A: {
        prompt: "What is the least common multiple (LCM) of 4 and 6? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 12 }],
        explanation: "Multiples of 4: 4, 8, 12. Multiples of 6: 6, 12 — the LCM is 12.",
      },
      B: {
        prompt: "What is the least common multiple (LCM) of 3 and 5? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 15 }],
        explanation: "3 and 5 share no smaller factors, so the LCM is just 3 × 5 = 15.",
      },
      C: {
        prompt: "What is the least common multiple (LCM) of 6 and 8? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 24 }],
        explanation: "Multiples of 6: 6, 12, 18, 24. Multiples of 8: 8, 16, 24 — the LCM is 24.",
      },
      D: {
        prompt: "What is the least common multiple (LCM) of 4 and 10? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 20 }],
        explanation: "Multiples of 4: 4, 8, 12, 16, 20. Multiples of 10: 10, 20 — the LCM is 20.",
      },
    },
  },
  {
    slug: "math-g6-l11-positive-and-negative-numbers",
    grade: 6,
    lessonNumber: 11,
    title: "Positive and Negative Numbers",
    mathSkill: "Positive and Negative Numbers (6.NS.C.5)",
    teaches: "Every slot moves along a number line that dips below zero — work out where you land, then build that landing value (as a positive count) anywhere in the kit.",
    bpm: 114,
    challenges: {
      A: {
        prompt: "The temperature is -5°F in the morning and rises by 12 degrees. What is the new temperature? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 7 }],
        explanation: "-5 + 12 = 7°F.",
      },
      B: {
        prompt: "A submarine is at -20 feet and rises 8 feet. How many feet below the surface is it now? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 12 }],
        explanation: "-20 + 8 = -12, so it's 12 feet below the surface.",
      },
      C: {
        prompt: "The temperature is -3°C and drops another 4 degrees. How far from zero is the new temperature? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 7 }],
        explanation: "-3 - 4 = -7, which is 7 degrees away from zero.",
      },
      D: {
        prompt: "A hiker starts at -8 feet (below sea level) and climbs 20 feet. What is the new elevation? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 12 }],
        explanation: "-8 + 20 = 12 feet above sea level.",
      },
    },
  },
  {
    slug: "math-g6-l12-absolute-value",
    grade: 6,
    lessonNumber: 12,
    title: "Absolute Value",
    mathSkill: "Absolute Value (6.NS.C.7c)",
    teaches: "Every slot asks for a number's distance from zero — build that distance (always positive) anywhere in the kit.",
    bpm: 114,
    challenges: {
      A: {
        prompt: "What is |-7|? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 7 }],
        explanation: "|-7| = 7 — its distance from zero.",
      },
      B: {
        prompt: "What is |4|? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 4 }],
        explanation: "|4| = 4 — it's already positive.",
      },
      C: {
        prompt: "Which is bigger: |-9| or |5|? Build a drum beat with the bigger absolute value, in quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 9 }],
        explanation: "|-9| = 9, which is bigger than |5| = 5.",
      },
      D: {
        prompt: "What is |-12|? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 12 }],
        explanation: "|-12| = 12 — its distance from zero.",
      },
    },
  },
  {
    slug: "math-g6-l13-exponents",
    grade: 6,
    lessonNumber: 13,
    title: "Exponents",
    mathSkill: "Exponents (6.EE.A.1)",
    teaches: "Every slot evaluates a number raised to a power — multiply the base by itself that many times, then build the result anywhere in the kit. None of these are small; expect to mix in triplets and sixteenth notes.",
    bpm: 114,
    challenges: {
      A: {
        prompt: "2^4 = ? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 16 }],
        explanation: "2^4 = 2×2×2×2 = 16.",
      },
      B: {
        prompt: "3^3 = ? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 27 }],
        explanation: "3^3 = 3×3×3 = 27.",
      },
      C: {
        prompt: "5^2 = ? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 25 }],
        explanation: "5^2 = 5×5 = 25.",
      },
      D: {
        prompt: "2^5 = ? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 32 }],
        explanation: "2^5 = 2×2×2×2×2 = 32.",
      },
    },
  },
  {
    slug: "math-g6-l14-evaluating-expressions-with-variables",
    grade: 6,
    lessonNumber: 14,
    title: "Evaluating Expressions with Variables",
    mathSkill: "Evaluate Expressions with Variables (6.EE.A.2c)",
    teaches: "Every slot gives an expression and a value for its variable — substitute the value in, work it out in order, and build the result anywhere in the kit.",
    bpm: 114,
    challenges: {
      A: {
        prompt: "Evaluate 3x + 2 when x = 5. Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 17 }],
        explanation: "3(5) + 2 = 15 + 2 = 17.",
      },
      B: {
        prompt: "Evaluate 2x - 4 when x = 9. Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 14 }],
        explanation: "2(9) - 4 = 18 - 4 = 14.",
      },
      C: {
        prompt: "Evaluate 5x when x = 6. Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 30 }],
        explanation: "5(6) = 30.",
      },
      D: {
        prompt: "Evaluate x^2 when x = 4. Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 16 }],
        explanation: "4^2 = 16.",
      },
    },
  },
  {
    slug: "math-g6-l15-writing-expressions",
    grade: 6,
    lessonNumber: 15,
    title: "Writing Expressions",
    mathSkill: "Write Expressions (6.EE.A.2a)",
    teaches: "Every slot describes an expression in words — write it out, plug in the given value, and build the result anywhere in the kit.",
    bpm: 114,
    challenges: {
      A: {
        prompt: "4 more than 3 times a number x, where x = 5. Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 19 }],
        explanation: "3x + 4 = 3(5) + 4 = 15 + 4 = 19.",
      },
      B: {
        prompt: "6 less than 5 times a number x, where x = 4. Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 14 }],
        explanation: "5x - 6 = 5(4) - 6 = 20 - 6 = 14.",
      },
      C: {
        prompt: "Twice a number x plus 7, where x = 8. Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 23 }],
        explanation: "2x + 7 = 2(8) + 7 = 16 + 7 = 23.",
      },
      D: {
        prompt: "A number x divided by 2, plus 3, where x = 10. Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 8 }],
        explanation: "x/2 + 3 = 10/2 + 3 = 5 + 3 = 8.",
      },
    },
  },
  {
    slug: "math-g6-l16-one-step-equations-addition-subtraction",
    grade: 6,
    lessonNumber: 16,
    title: "One-Step Equations: Addition & Subtraction",
    mathSkill: "One-Step Equations (6.EE.B.7)",
    teaches: "Every slot hides x in an addition or subtraction equation — undo it with the opposite operation, then build x anywhere in the kit.",
    bpm: 114,
    challenges: {
      A: {
        prompt: "x + 7 = 15. What is x? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 8 }],
        explanation: "x + 7 = 15, so x = 15 - 7 = 8.",
      },
      B: {
        prompt: "x - 4 = 9. What is x? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 13 }],
        explanation: "x - 4 = 9, so x = 9 + 4 = 13.",
      },
      C: {
        prompt: "x + 15 = 22. What is x? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 7 }],
        explanation: "x + 15 = 22, so x = 22 - 15 = 7.",
      },
      D: {
        prompt: "x - 6 = 11. What is x? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 17 }],
        explanation: "x - 6 = 11, so x = 11 + 6 = 17.",
      },
    },
  },
  {
    slug: "math-g6-l17-one-step-equations-multiplication-division",
    grade: 6,
    lessonNumber: 17,
    title: "One-Step Equations: Multiplication & Division",
    mathSkill: "One-Step Equations (6.EE.B.7)",
    teaches: "Every slot hides x in a multiplication or division equation — undo it with the opposite operation, then build x anywhere in the kit.",
    bpm: 114,
    challenges: {
      A: {
        prompt: "4x = 28. What is x? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 7 }],
        explanation: "4x = 28, so x = 28 ÷ 4 = 7.",
      },
      B: {
        prompt: "x ÷ 3 = 6. What is x? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 18 }],
        explanation: "x ÷ 3 = 6, so x = 6 × 3 = 18.",
      },
      C: {
        prompt: "5x = 45. What is x? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 9 }],
        explanation: "5x = 45, so x = 45 ÷ 5 = 9.",
      },
      D: {
        prompt: "x ÷ 4 = 8. What is x? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 32 }],
        explanation: "x ÷ 4 = 8, so x = 8 × 4 = 32.",
      },
    },
  },
  {
    slug: "math-g6-l18-independent-and-dependent-variables",
    grade: 6,
    lessonNumber: 18,
    title: "Independent and Dependent Variables",
    mathSkill: "Independent and Dependent Variables (6.EE.C.9)",
    teaches: "Every slot gives a rule linking two variables — plug the given x into the rule to find y, then build y anywhere in the kit.",
    bpm: 116,
    challenges: {
      A: {
        prompt: "The rule is y = 3x. When x = 4, what is y? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 12 }],
        explanation: "y = 3(4) = 12.",
      },
      B: {
        prompt: "The rule is y = 2x + 1. When x = 5, what is y? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 11 }],
        explanation: "y = 2(5) + 1 = 10 + 1 = 11.",
      },
      C: {
        prompt: "The rule is y = x + 6. When x = 7, what is y? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 13 }],
        explanation: "y = 7 + 6 = 13.",
      },
      D: {
        prompt: "The rule is y = 4x - 2. When x = 3, what is y? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 10 }],
        explanation: "y = 4(3) - 2 = 12 - 2 = 10.",
      },
    },
  },
  {
    slug: "math-g6-l19-area-of-triangles",
    grade: 6,
    lessonNumber: 19,
    title: "Area of Triangles",
    mathSkill: "Area of Triangles (6.G.A.1)",
    teaches: "Every slot gives a triangle's base and height — its area is half of base times height; the base is how many BLOCKS you use, and the area is the total notes across exactly that many.",
    bpm: 116,
    challenges: {
      A: {
        prompt: "A triangle has a base of 6 and a height of 4. What is its area? Build a drum beat using exactly 6 blocks that add up to 12 notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 12, blocksUsed: 6 }],
        explanation: "Area = (6 × 4) ÷ 2 = 12 — 6 blocks (the base) holding 12 notes in all.",
      },
      B: {
        prompt: "A triangle has a base of 8 and a height of 3. What is its area? Build a drum beat using exactly 8 blocks that add up to 12 notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 12, blocksUsed: 8 }],
        explanation: "Area = (8 × 3) ÷ 2 = 12 — 8 blocks holding 12 notes in all.",
      },
      C: {
        prompt: "A triangle has a base of 5 and a height of 4. What is its area? Build a drum beat using exactly 5 blocks that add up to 10 notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 10, blocksUsed: 5 }],
        explanation: "Area = (5 × 4) ÷ 2 = 10 — 5 blocks holding 10 notes in all.",
      },
      D: {
        prompt: "A triangle has a base of 7 and a height of 2. What is its area? Build a drum beat using exactly 7 blocks that add up to 7 notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 7, blocksUsed: 7 }],
        explanation: "Area = (7 × 2) ÷ 2 = 7 — 7 blocks holding 7 notes in all, one per block.",
      },
    },
  },
  {
    slug: "math-g6-l20-area-of-parallelograms-and-trapezoids",
    grade: 6,
    lessonNumber: 20,
    title: "Area of Parallelograms and Trapezoids",
    mathSkill: "Area of Parallelograms and Trapezoids (6.G.A.1)",
    teaches: "A parallelogram's area is base times height — the base is how many BLOCKS you use. A trapezoid has two different bases, so it doesn't split into blocks as cleanly; just build its total area anywhere in the kit.",
    bpm: 116,
    challenges: {
      A: {
        prompt: "A parallelogram has a base of 5 and a height of 4. What is its area? Build a drum beat using exactly 5 blocks that add up to 20 notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 20, blocksUsed: 5 }],
        explanation: "Area = 5 × 4 = 20 — 5 blocks (the base) holding 20 notes in all.",
      },
      B: {
        prompt: "A parallelogram has a base of 6 and a height of 3. What is its area? Build a drum beat using exactly 6 blocks that add up to 18 notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 18, blocksUsed: 6 }],
        explanation: "Area = 6 × 3 = 18 — 6 blocks holding 18 notes in all.",
      },
      C: {
        prompt: "A trapezoid has bases of 4 and 6, and a height of 3. What is its area? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 15 }],
        explanation: "Area = ((4 + 6) ÷ 2) × 3 = 5 × 3 = 15.",
      },
      D: {
        prompt: "A trapezoid has bases of 5 and 7, and a height of 2. What is its area? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 12 }],
        explanation: "Area = ((5 + 7) ÷ 2) × 2 = 6 × 2 = 12.",
      },
    },
  },
  {
    slug: "math-g6-l21-surface-area",
    grade: 6,
    lessonNumber: 21,
    title: "Surface Area",
    mathSkill: "Surface Area of Rectangular Prisms (6.G.A.4)",
    teaches: "Every slot gives a box's three dimensions — find the area of each pair of faces, double it, and add them all up; build the total anywhere in the kit. These are the biggest totals yet — expect to fill most of the kit with fast subdivisions.",
    bpm: 116,
    challenges: {
      A: {
        prompt: "A box is 2 units long, 3 units wide, and 4 units tall. What is its surface area? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 52 }],
        explanation: "Surface area = 2×(2×3 + 2×4 + 3×4) = 2×(6 + 8 + 12) = 2×26 = 52.",
      },
      B: {
        prompt: "A box is 1 unit long, 2 units wide, and 3 units tall. What is its surface area? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 22 }],
        explanation: "Surface area = 2×(1×2 + 1×3 + 2×3) = 2×(2 + 3 + 6) = 2×11 = 22.",
      },
      C: {
        prompt: "A box is 2 units long, 2 units wide, and 3 units tall. What is its surface area? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 32 }],
        explanation: "Surface area = 2×(2×2 + 2×3 + 2×3) = 2×(4 + 6 + 6) = 2×16 = 32.",
      },
      D: {
        prompt: "A box is 3 units long, 3 units wide, and 2 units tall. What is its surface area? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 42 }],
        explanation: "Surface area = 2×(3×3 + 3×2 + 3×2) = 2×(9 + 6 + 6) = 2×21 = 42.",
      },
    },
  },
  {
    slug: "math-g6-l22-volume-with-fractional-edge-lengths",
    grade: 6,
    lessonNumber: 22,
    title: "Volume with Fractional Edge Lengths",
    mathSkill: "Volume with Fractional Edge Lengths (6.G.A.2)",
    teaches: "Every slot gives a box with one fractional edge — multiply all three dimensions together, and build the result anywhere in the kit.",
    bpm: 116,
    challenges: {
      A: {
        prompt: "A box is 4 units long, 3 units wide, and 1/2 unit tall. What is its volume? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 6 }],
        explanation: "Volume = 4 × 3 × 1/2 = 6.",
      },
      B: {
        prompt: "A box is 5 units long, 2 units wide, and 1/2 unit tall. What is its volume? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 5 }],
        explanation: "Volume = 5 × 2 × 1/2 = 5.",
      },
      C: {
        prompt: "A box is 6 units long, 2 units wide, and 1/3 unit tall. What is its volume? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 4 }],
        explanation: "Volume = 6 × 2 × 1/3 = 4.",
      },
      D: {
        prompt: "A box is 4 units long, 3 units wide, and 1/4 unit tall. What is its volume? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 3 }],
        explanation: "Volume = 4 × 3 × 1/4 = 3.",
      },
    },
  },
  {
    slug: "math-g6-l23-mean-and-median",
    grade: 6,
    lessonNumber: 23,
    title: "Mean and Median",
    mathSkill: "Mean and Median (6.SP.B.5c)",
    teaches: "Every slot asks for a data set's mean or median — work it out (add and divide for the mean, sort and find the middle for the median), then build the result anywhere in the kit.",
    bpm: 116,
    challenges: {
      A: {
        prompt: "Find the mean of 4, 6, 8, 2. Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 5 }],
        explanation: "(4 + 6 + 8 + 2) ÷ 4 = 20 ÷ 4 = 5.",
      },
      B: {
        prompt: "Find the median of 3, 7, 5, 9, 1. Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 5 }],
        explanation: "Sorted: 1, 3, 5, 7, 9 — the middle number is 5.",
      },
      C: {
        prompt: "Find the mean of 10, 20, 30. Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 20 }],
        explanation: "(10 + 20 + 30) ÷ 3 = 60 ÷ 3 = 20.",
      },
      D: {
        prompt: "Find the median of 12, 4, 8, 16, 10. Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 10 }],
        explanation: "Sorted: 4, 8, 10, 12, 16 — the middle number is 10.",
      },
    },
  },
  {
    slug: "math-g6-l24-range",
    grade: 6,
    lessonNumber: 24,
    title: "Range",
    mathSkill: "Range as a Measure of Variation (6.SP.B.5c)",
    teaches: "Every slot asks for a data set's range — subtract the smallest value from the largest, then build the result anywhere in the kit, the last lesson of the year.",
    bpm: 116,
    challenges: {
      A: {
        prompt: "Find the range of 4, 9, 2, 7. Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 7 }],
        explanation: "Range = 9 - 2 = 7.",
      },
      B: {
        prompt: "Find the range of 15, 3, 8, 20. Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 17 }],
        explanation: "Range = 20 - 3 = 17.",
      },
      C: {
        prompt: "Find the range of 10, 14, 11, 13. Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 4 }],
        explanation: "Range = 14 - 10 = 4.",
      },
      D: {
        prompt: "Find the range of 25, 5, 18. Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 20 }],
        explanation: "Range = 25 - 5 = 20.",
      },
    },
  },
  // ============================================================
  // GRADE 7 — proportional relationships open the fall (unit rates with
  // complex fractions, the constant of proportionality, percent change),
  // then negative-number operations across the whole number system carry
  // through early winter, expressions and multi-step/both-sides equations
  // fill late winter, and geometry (scale drawings, circles, angle pairs,
  // composite area) with probability closes out the spring — the real
  // Common Core Grade 7 progression. Multiplication and proportional
  // scaling keep leaning on the blocks mechanic (y = kx as blocksUsed x
  // groups of k, simple interest as blocksUsed years of P×r, integer
  // multiplication as blocksUsed groups of a factor, a scale drawing's
  // inches as blocksUsed groups of the map scale) — the same "a block IS a
  // group" idea Grade 6 established, now over signed numbers and rates.
  // ============================================================
  {
    slug: "math-g7-l01-unit-rates-with-fractions",
    grade: 7,
    lessonNumber: 1,
    title: "Unit Rates with Fractions",
    mathSkill: "Unit Rates with Complex Fractions (7.RP.A.1)",
    teaches: "Every slot gives a distance traveled in a fraction of an hour — divide the fraction by the fraction to get the unit rate, then build that many notes anywhere in the kit.",
    bpm: 118,
    challenges: {
      A: {
        prompt: "A runner covers 3/4 mile in 1/4 hour. What is the unit rate, in miles per hour? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 3 }],
        explanation: "(3/4) ÷ (1/4) = 3 miles per hour.",
      },
      B: {
        prompt: "A cyclist covers 5/6 mile in 1/6 hour. What is the unit rate, in miles per hour? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 5 }],
        explanation: "(5/6) ÷ (1/6) = 5 miles per hour.",
      },
      C: {
        prompt: "A walker covers 7/8 mile in 1/8 hour. What is the unit rate, in miles per hour? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 7 }],
        explanation: "(7/8) ÷ (1/8) = 7 miles per hour.",
      },
      D: {
        prompt: "A swimmer covers 4/5 mile in 1/5 hour. What is the unit rate, in miles per hour? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 4 }],
        explanation: "(4/5) ÷ (1/5) = 4 miles per hour.",
      },
    },
  },
  {
    slug: "math-g7-l02-constant-of-proportionality",
    grade: 7,
    lessonNumber: 2,
    title: "Constant of Proportionality",
    mathSkill: "Constant of Proportionality (7.RP.A.2b)",
    teaches: "Every slot gives a matched x and y from a proportional relationship — divide y by x to find the constant of proportionality k, then build that many notes anywhere in the kit.",
    bpm: 118,
    challenges: {
      A: {
        prompt: "In a proportional relationship, y = 24 when x = 6. What is the constant of proportionality (y ÷ x)? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 4 }],
        explanation: "24 ÷ 6 = 4.",
      },
      B: {
        prompt: "In a proportional relationship, y = 45 when x = 9. What is the constant of proportionality (y ÷ x)? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 5 }],
        explanation: "45 ÷ 9 = 5.",
      },
      C: {
        prompt: "In a proportional relationship, y = 56 when x = 7. What is the constant of proportionality (y ÷ x)? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 8 }],
        explanation: "56 ÷ 7 = 8.",
      },
      D: {
        prompt: "In a proportional relationship, y = 36 when x = 4. What is the constant of proportionality (y ÷ x)? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 9 }],
        explanation: "36 ÷ 4 = 9.",
      },
    },
  },
  {
    slug: "math-g7-l03-using-y-equals-kx",
    grade: 7,
    lessonNumber: 3,
    title: "Using y = kx",
    mathSkill: "Represent Proportional Relationships with Equations (7.RP.A.2c)",
    teaches: "Every slot gives y = kx and a value for x — the x-value is how many BLOCKS you use, and k is about how many notes go in each block; build the total across exactly that many blocks.",
    bpm: 118,
    challenges: {
      A: {
        prompt: "y = 3x. What is y when x = 7? Build a drum beat using exactly 7 blocks that add up to 21 notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 21, blocksUsed: 7 }],
        explanation: "y = 3(7) = 21 — 7 blocks holding 21 notes in all.",
      },
      B: {
        prompt: "y = 5x. What is y when x = 8? Build a drum beat using exactly 8 blocks that add up to 40 notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 40, blocksUsed: 8 }],
        explanation: "y = 5(8) = 40 — 8 blocks holding 40 notes in all.",
      },
      C: {
        prompt: "y = 4x. What is y when x = 6? Build a drum beat using exactly 6 blocks that add up to 24 notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 24, blocksUsed: 6 }],
        explanation: "y = 4(6) = 24 — 6 blocks holding 24 notes in all.",
      },
      D: {
        prompt: "y = 6x. What is y when x = 5? Build a drum beat using exactly 5 blocks that add up to 30 notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 30, blocksUsed: 5 }],
        explanation: "y = 6(5) = 30 — 5 blocks holding 30 notes in all.",
      },
    },
  },
  {
    slug: "math-g7-l04-percent-increase",
    grade: 7,
    lessonNumber: 4,
    title: "Percent Increase",
    mathSkill: "Percent Increase (7.RP.A.3)",
    teaches: "Every slot gives a starting price and a percent it increases by — find the increase, add it to the start, and build the new price anywhere in the kit.",
    bpm: 118,
    challenges: {
      A: {
        prompt: "A $40 item's price increases by 25%. What is the new price? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 50 }],
        explanation: "40 + (0.25 × 40) = 40 + 10 = $50.",
      },
      B: {
        prompt: "A $50 item's price increases by 10%. What is the new price? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 55 }],
        explanation: "50 + (0.10 × 50) = 50 + 5 = $55.",
      },
      C: {
        prompt: "A $60 item's price increases by 5%. What is the new price? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 63 }],
        explanation: "60 + (0.05 × 60) = 60 + 3 = $63.",
      },
      D: {
        prompt: "A $30 item's price increases by 50%. What is the new price? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 45 }],
        explanation: "30 + (0.50 × 30) = 30 + 15 = $45.",
      },
    },
  },
  {
    slug: "math-g7-l05-percent-decrease",
    grade: 7,
    lessonNumber: 5,
    title: "Percent Decrease",
    mathSkill: "Percent Decrease (7.RP.A.3)",
    teaches: "Every slot gives a starting price and a discount percent — find the discount, subtract it from the start, and build the sale price anywhere in the kit.",
    bpm: 118,
    challenges: {
      A: {
        prompt: "An $80 item is discounted 25%. What is the sale price? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 60 }],
        explanation: "80 - (0.25 × 80) = 80 - 20 = $60.",
      },
      B: {
        prompt: "A $50 item is discounted 10%. What is the sale price? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 45 }],
        explanation: "50 - (0.10 × 50) = 50 - 5 = $45.",
      },
      C: {
        prompt: "A $40 item is discounted 15%. What is the sale price? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 34 }],
        explanation: "40 - (0.15 × 40) = 40 - 6 = $34.",
      },
      D: {
        prompt: "A $60 item is discounted 20%. What is the sale price? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 48 }],
        explanation: "60 - (0.20 × 60) = 60 - 12 = $48.",
      },
    },
  },
  {
    slug: "math-g7-l06-simple-interest",
    grade: 7,
    lessonNumber: 6,
    title: "Simple Interest",
    mathSkill: "Simple Interest (7.RP.A.3)",
    teaches: "Every slot gives a principal, a rate, and a number of years — the years are how many BLOCKS you use, and one year's interest is about how many notes go in each block; build the total interest across exactly that many blocks.",
    bpm: 118,
    challenges: {
      A: {
        prompt: "$100 earns 5% simple interest per year for 2 years. Build a drum beat using exactly 2 blocks that add up to 10 notes in all — the total interest earned.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 10, blocksUsed: 2 }],
        explanation: "$100 × 5% = $5 per year × 2 years = $10 — 2 blocks holding 10 notes in all.",
      },
      B: {
        prompt: "$150 earns 4% simple interest per year for 3 years. Build a drum beat using exactly 3 blocks that add up to 18 notes in all — the total interest earned.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 18, blocksUsed: 3 }],
        explanation: "$150 × 4% = $6 per year × 3 years = $18.",
      },
      C: {
        prompt: "$300 earns 1% simple interest per year for 5 years. Build a drum beat using exactly 5 blocks that add up to 15 notes in all — the total interest earned.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 15, blocksUsed: 5 }],
        explanation: "$300 × 1% = $3 per year × 5 years = $15.",
      },
      D: {
        prompt: "$200 earns 2% simple interest per year for 6 years. Build a drum beat using exactly 6 blocks that add up to 24 notes in all — the total interest earned.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 24, blocksUsed: 6 }],
        explanation: "$200 × 2% = $4 per year × 6 years = $24.",
      },
    },
  },
  {
    slug: "math-g7-l07-adding-integers",
    grade: 7,
    lessonNumber: 7,
    title: "Adding Integers",
    mathSkill: "Add Integers (7.NS.A.1b)",
    teaches: "Every slot adds two signed numbers on a number line that dips below zero — work out where you land, then build that landing value's distance from zero anywhere in the kit.",
    bpm: 118,
    challenges: {
      A: {
        prompt: "-8 + 15 = ? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 7 }],
        explanation: "-8 + 15 = 7.",
      },
      B: {
        prompt: "-12 + 20 = ? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 8 }],
        explanation: "-12 + 20 = 8.",
      },
      C: {
        prompt: "-6 + (-9) = ? Build a drum beat with the distance of the answer from zero, in quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 15 }],
        explanation: "-6 + (-9) = -15, which is 15 away from zero.",
      },
      D: {
        prompt: "9 + (-30) = ? Build a drum beat with the distance of the answer from zero, in notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 21 }],
        explanation: "9 + (-30) = -21, which is 21 away from zero.",
      },
    },
  },
  {
    slug: "math-g7-l08-subtracting-integers",
    grade: 7,
    lessonNumber: 8,
    title: "Subtracting Integers",
    mathSkill: "Subtract Integers (7.NS.A.1c)",
    teaches: "Every slot subtracts a signed number — turn it into adding the opposite, then build the landing value's distance from zero anywhere in the kit.",
    bpm: 118,
    challenges: {
      A: {
        prompt: "5 - (-8) = ? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 13 }],
        explanation: "5 - (-8) = 5 + 8 = 13.",
      },
      B: {
        prompt: "-4 - 6 = ? Build a drum beat with the distance of the answer from zero, in quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 10 }],
        explanation: "-4 - 6 = -10, which is 10 away from zero.",
      },
      C: {
        prompt: "-3 - (-10) = ? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 7 }],
        explanation: "-3 - (-10) = -3 + 10 = 7.",
      },
      D: {
        prompt: "12 - 20 = ? Build a drum beat with the distance of the answer from zero, in quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 8 }],
        explanation: "12 - 20 = -8, which is 8 away from zero.",
      },
    },
  },
  {
    slug: "math-g7-l09-multiplying-integers",
    grade: 7,
    lessonNumber: 9,
    title: "Multiplying Integers",
    mathSkill: "Multiply Integers (7.NS.A.2a)",
    teaches: "Every slot multiplies two signed numbers — one factor is how many BLOCKS you use, and the other is about how many notes go in each block; build the product's distance from zero across exactly that many blocks.",
    bpm: 120,
    challenges: {
      A: {
        prompt: "-4 × 6 = ? Build a drum beat using exactly 6 blocks that add up to 24 notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 24, blocksUsed: 6 }],
        explanation: "-4 × 6 = -24, a distance of 24 from zero — 6 blocks holding 24 notes in all.",
      },
      B: {
        prompt: "-5 × (-4) = ? Build a drum beat using exactly 4 blocks that add up to 20 notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 20, blocksUsed: 4 }],
        explanation: "-5 × (-4) = 20 — 4 blocks holding 20 notes in all.",
      },
      C: {
        prompt: "6 × (-5) = ? Build a drum beat using exactly 5 blocks that add up to 30 notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 30, blocksUsed: 5 }],
        explanation: "6 × (-5) = -30, a distance of 30 from zero — 5 blocks holding 30 notes in all.",
      },
      D: {
        prompt: "-6 × (-6) = ? Build a drum beat using exactly 6 blocks that add up to 36 notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 36, blocksUsed: 6 }],
        explanation: "-6 × (-6) = 36 — 6 blocks holding 36 notes in all.",
      },
    },
  },
  {
    slug: "math-g7-l10-dividing-integers",
    grade: 7,
    lessonNumber: 10,
    title: "Dividing Integers",
    mathSkill: "Divide Integers (7.NS.A.2b)",
    teaches: "Every slot divides two signed numbers — work out the quotient, then build its distance from zero anywhere in the kit.",
    bpm: 120,
    challenges: {
      A: {
        prompt: "-24 ÷ 6 = ? Build a drum beat with the distance of the answer from zero, in quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 4 }],
        explanation: "-24 ÷ 6 = -4, which is 4 away from zero.",
      },
      B: {
        prompt: "36 ÷ (-4) = ? Build a drum beat with the distance of the answer from zero, in quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 9 }],
        explanation: "36 ÷ (-4) = -9, which is 9 away from zero.",
      },
      C: {
        prompt: "-45 ÷ (-9) = ? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 5 }],
        explanation: "-45 ÷ (-9) = 5.",
      },
      D: {
        prompt: "56 ÷ (-7) = ? Build a drum beat with the distance of the answer from zero, in quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 8 }],
        explanation: "56 ÷ (-7) = -8, which is 8 away from zero.",
      },
    },
  },
  {
    slug: "math-g7-l11-operations-with-rational-numbers",
    grade: 7,
    lessonNumber: 11,
    title: "Operations with Rational Numbers",
    mathSkill: "Add and Subtract Rational Numbers (7.NS.A.1d)",
    teaches: "Every slot adds or subtracts decimals or fractions, some negative — work it out, then build the result's distance from zero anywhere in the kit.",
    bpm: 120,
    challenges: {
      A: {
        prompt: "2.25 + 1.75 = ? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 4 }],
        explanation: "2.25 + 1.75 = 4.",
      },
      B: {
        prompt: "-2.5 + 9.5 = ? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 7 }],
        explanation: "-2.5 + 9.5 = 7.",
      },
      C: {
        prompt: "7/2 + 5/2 = ? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 6 }],
        explanation: "7/2 + 5/2 = 12/2 = 6.",
      },
      D: {
        prompt: "-6.5 - 1.5 = ? Build a drum beat with the distance of the answer from zero, in quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 8 }],
        explanation: "-6.5 - 1.5 = -8, which is 8 away from zero.",
      },
    },
  },
  {
    slug: "math-g7-l12-multi-step-rational-number-problems",
    grade: 7,
    lessonNumber: 12,
    title: "Multi-Step Rational Number Problems",
    mathSkill: "Solve Multi-Step Real-World Problems (7.NS.A.3)",
    teaches: "Every slot chains two or three signed-number moves in a real situation — work through them in order, then build the final value's distance from zero anywhere in the kit.",
    bpm: 120,
    challenges: {
      A: {
        prompt: "A submarine descends 15 feet, rises 6 feet, then descends 4 more feet. How far below where it started is it now? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 13 }],
        explanation: "-15 + 6 - 4 = -13, so it's 13 feet below the start.",
      },
      B: {
        prompt: "A hiker's elevation changes by +8 feet, then -20 feet, then +5 feet. What is the net change's distance from zero? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 7 }],
        explanation: "8 - 20 + 5 = -7, a net change of 7 feet.",
      },
      C: {
        prompt: "The temperature starts at 10°, drops 15°, then rises 3°. What is the final temperature's distance from zero? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 2 }],
        explanation: "10 - 15 + 3 = -2, a distance of 2 from zero.",
      },
      D: {
        prompt: "A bank balance changes by -$50, then +$30, then -$10. What is the net change's distance from zero? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 30 }],
        explanation: "-50 + 30 - 10 = -30, a net change of $30.",
      },
    },
  },
  {
    slug: "math-g7-l13-combining-like-terms",
    grade: 7,
    lessonNumber: 13,
    title: "Combining Like Terms",
    mathSkill: "Simplify Expressions by Combining Like Terms (7.EE.A.1)",
    teaches: "Every slot simplifies an expression with repeated x-terms, then plugs in a value for x — combine the terms first, substitute, and build the result anywhere in the kit.",
    bpm: 120,
    challenges: {
      A: {
        prompt: "Simplify 4x + 3x - 2x, then evaluate it when x = 4. Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 20 }],
        explanation: "4x + 3x - 2x = 5x, and 5(4) = 20.",
      },
      B: {
        prompt: "Simplify 7x - 2x + x, then evaluate it when x = 5. Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 30 }],
        explanation: "7x - 2x + x = 6x, and 6(5) = 30.",
      },
      C: {
        prompt: "Simplify 3x + 5x - 4x, then evaluate it when x = 6. Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 24 }],
        explanation: "3x + 5x - 4x = 4x, and 4(6) = 24.",
      },
      D: {
        prompt: "Simplify 9x - 3x + 2x, then evaluate it when x = 4. Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 32 }],
        explanation: "9x - 3x + 2x = 8x, and 8(4) = 32.",
      },
    },
  },
  {
    slug: "math-g7-l14-the-distributive-property",
    grade: 7,
    lessonNumber: 14,
    title: "The Distributive Property",
    mathSkill: "Expand Expressions with the Distributive Property (7.EE.A.1)",
    teaches: "Every slot gives an expression like a(x + b) or a(x - b) and a value for x — distribute (or just work inside the parentheses first), then build the result anywhere in the kit.",
    bpm: 120,
    challenges: {
      A: {
        prompt: "3(x + 4), where x = 5. Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 27 }],
        explanation: "3(5 + 4) = 3(9) = 27.",
      },
      B: {
        prompt: "2(x - 3), where x = 8. Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 10 }],
        explanation: "2(8 - 3) = 2(5) = 10.",
      },
      C: {
        prompt: "4(x + 2), where x = 6. Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 32 }],
        explanation: "4(6 + 2) = 4(8) = 32.",
      },
      D: {
        prompt: "5(x - 1), where x = 7. Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 30 }],
        explanation: "5(7 - 1) = 5(6) = 30.",
      },
    },
  },
  {
    slug: "math-g7-l15-two-step-equations",
    grade: 7,
    lessonNumber: 15,
    title: "Two-Step Equations",
    mathSkill: "Solve Two-Step Equations (7.EE.B.4a)",
    teaches: "Every slot hides x behind a multiplication and an addition or subtraction — undo them in reverse order, then build x anywhere in the kit.",
    bpm: 120,
    challenges: {
      A: {
        prompt: "2x + 5 = 17. What is x? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 6 }],
        explanation: "2x + 5 = 17, so 2x = 12, and x = 6.",
      },
      B: {
        prompt: "3x - 4 = 11. What is x? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 5 }],
        explanation: "3x - 4 = 11, so 3x = 15, and x = 5.",
      },
      C: {
        prompt: "4x + 7 = 39. What is x? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 8 }],
        explanation: "4x + 7 = 39, so 4x = 32, and x = 8.",
      },
      D: {
        prompt: "5x - 3 = 32. What is x? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 7 }],
        explanation: "5x - 3 = 32, so 5x = 35, and x = 7.",
      },
    },
  },
  {
    slug: "math-g7-l16-equations-with-variables-on-both-sides",
    grade: 7,
    lessonNumber: 16,
    title: "Equations with Variables on Both Sides",
    mathSkill: "Solve Multi-Step Equations (7.EE.B.4a)",
    teaches: "Every slot has x-terms on both sides of the equation — gather them onto one side, undo what's left, and build x anywhere in the kit.",
    bpm: 122,
    challenges: {
      A: {
        prompt: "3x + 4 = x + 16. What is x? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 6 }],
        explanation: "3x + 4 = x + 16 → 2x = 12 → x = 6.",
      },
      B: {
        prompt: "5x - 2 = 2x + 13. What is x? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 5 }],
        explanation: "5x - 2 = 2x + 13 → 3x = 15 → x = 5.",
      },
      C: {
        prompt: "4x + 6 = x + 27. What is x? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 7 }],
        explanation: "4x + 6 = x + 27 → 3x = 21 → x = 7.",
      },
      D: {
        prompt: "6x - 5 = 2x + 27. What is x? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 8 }],
        explanation: "6x - 5 = 2x + 27 → 4x = 32 → x = 8.",
      },
    },
  },
  {
    slug: "math-g7-l17-inequalities",
    grade: 7,
    lessonNumber: 17,
    title: "Inequalities",
    mathSkill: "Solve One-Step and Two-Step Inequalities (7.EE.B.4b)",
    teaches: "Every slot solves an inequality, then asks for the smallest or largest whole number that still makes it true — solve it like an equation, then build that boundary value anywhere in the kit.",
    bpm: 122,
    challenges: {
      A: {
        prompt: "x + 5 > 12. What is the smallest whole number that makes this true? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 8 }],
        explanation: "x + 5 > 12 → x > 7, so the smallest whole number is 8.",
      },
      B: {
        prompt: "2x < 24. What is the largest whole number that makes this true? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 11 }],
        explanation: "2x < 24 → x < 12, so the largest whole number is 11.",
      },
      C: {
        prompt: "x - 3 ≥ 10. What is the smallest whole number that makes this true? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 13 }],
        explanation: "x - 3 ≥ 10 → x ≥ 13, so the smallest whole number is 13.",
      },
      D: {
        prompt: "3x ≤ 27. What is the largest whole number that makes this true? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 9 }],
        explanation: "3x ≤ 27 → x ≤ 9, so the largest whole number is 9.",
      },
    },
  },
  {
    slug: "math-g7-l18-scale-drawings",
    grade: 7,
    lessonNumber: 18,
    title: "Scale Drawings",
    mathSkill: "Scale Drawings (7.G.A.1)",
    teaches: "Every slot gives a map scale and a distance measured on the map — the map inches are how many BLOCKS you use, and the scale itself is about how many notes go in each block; build the real-world distance across exactly that many blocks.",
    bpm: 122,
    challenges: {
      A: {
        prompt: "A map's scale is 1 inch = 5 miles. Two cities are 6 inches apart on the map. Build a drum beat using exactly 6 blocks that add up to 30 notes in all — the real distance in miles.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 30, blocksUsed: 6 }],
        explanation: "6 inches × 5 miles/inch = 30 miles — 6 blocks holding 30 notes in all.",
      },
      B: {
        prompt: "A map's scale is 1 inch = 4 miles. Two towns are 8 inches apart on the map. Build a drum beat using exactly 8 blocks that add up to 32 notes in all — the real distance in miles.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 32, blocksUsed: 8 }],
        explanation: "8 inches × 4 miles/inch = 32 miles.",
      },
      C: {
        prompt: "A map's scale is 1 inch = 6 miles. Two parks are 5 inches apart on the map. Build a drum beat using exactly 5 blocks that add up to 30 notes in all — the real distance in miles.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 30, blocksUsed: 5 }],
        explanation: "5 inches × 6 miles/inch = 30 miles.",
      },
      D: {
        prompt: "A map's scale is 1 inch = 3 miles. Two lakes are 7 inches apart on the map. Build a drum beat using exactly 7 blocks that add up to 21 notes in all — the real distance in miles.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 21, blocksUsed: 7 }],
        explanation: "7 inches × 3 miles/inch = 21 miles.",
      },
    },
  },
  {
    slug: "math-g7-l19-circumference-of-a-circle",
    grade: 7,
    lessonNumber: 19,
    title: "Circumference of a Circle",
    mathSkill: "Circumference of a Circle (7.G.B.4)",
    teaches: "Every slot gives a circle's radius or diameter — use π ≈ 22/7 to find the circumference, then build the result anywhere in the kit.",
    bpm: 122,
    challenges: {
      A: {
        prompt: "A circle has a diameter of 7 units. Using π ≈ 22/7, what is its circumference? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 22 }],
        explanation: "C = πd = (22/7)(7) = 22.",
      },
      B: {
        prompt: "A circle has a diameter of 14 units. Using π ≈ 22/7, what is its circumference? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 44 }],
        explanation: "C = πd = (22/7)(14) = 44.",
      },
      C: {
        prompt: "A circle has a radius of 10.5 units. Using π ≈ 22/7, what is its circumference? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 66 }],
        explanation: "C = 2πr = 2(22/7)(10.5) = 66.",
      },
      D: {
        prompt: "A circle has a diameter of 3.5 units. Using π ≈ 22/7, what is its circumference? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 11 }],
        explanation: "C = πd = (22/7)(3.5) = 11.",
      },
    },
  },
  {
    slug: "math-g7-l20-area-of-a-circle",
    grade: 7,
    lessonNumber: 20,
    title: "Area of a Circle",
    mathSkill: "Area of a Circle (7.G.B.4)",
    teaches: "Every slot gives a circle's radius — use π ≈ 3 to find the area, then build the result anywhere in the kit. These are the biggest totals yet; expect to fill most of the kit with fast subdivisions.",
    bpm: 122,
    challenges: {
      A: {
        prompt: "A circle has a radius of 4 units. Using π ≈ 3, what is its area? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 48 }],
        explanation: "A = πr² ≈ 3(4²) = 3(16) = 48.",
      },
      B: {
        prompt: "A circle has a radius of 3 units. Using π ≈ 3, what is its area? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 27 }],
        explanation: "A = πr² ≈ 3(3²) = 3(9) = 27.",
      },
      C: {
        prompt: "A circle has a radius of 5 units. Using π ≈ 3, what is its area? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 75 }],
        explanation: "A = πr² ≈ 3(5²) = 3(25) = 75.",
      },
      D: {
        prompt: "A circle has a radius of 2 units. Using π ≈ 3, what is its area? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 12 }],
        explanation: "A = πr² ≈ 3(2²) = 3(4) = 12.",
      },
    },
  },
  {
    slug: "math-g7-l21-complementary-and-supplementary-angles",
    grade: 7,
    lessonNumber: 21,
    title: "Complementary and Supplementary Angles",
    mathSkill: "Angle Relationships (7.G.B.5)",
    teaches: "Every slot gives one angle in a complementary (sums to 90°) or supplementary (sums to 180°) pair — subtract to find the missing angle, then build it anywhere in the kit.",
    bpm: 122,
    challenges: {
      A: {
        prompt: "Two angles are complementary. One measures 35°. What is the other? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 55 }],
        explanation: "90 - 35 = 55°.",
      },
      B: {
        prompt: "Two angles are supplementary. One measures 110°. What is the other? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 70 }],
        explanation: "180 - 110 = 70°.",
      },
      C: {
        prompt: "Two angles are complementary. One measures 62°. What is the other? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 28 }],
        explanation: "90 - 62 = 28°.",
      },
      D: {
        prompt: "Two angles are supplementary. One measures 145°. What is the other? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 35 }],
        explanation: "180 - 145 = 35°.",
      },
    },
  },
  {
    slug: "math-g7-l22-area-of-composite-figures",
    grade: 7,
    lessonNumber: 22,
    title: "Area of Composite Figures",
    mathSkill: "Area of Two-Dimensional Composite Figures (7.G.B.6)",
    teaches: "Every slot gives a figure made of two simpler shapes stuck together — find each piece's area and add them up, then build the total anywhere in the kit.",
    bpm: 122,
    challenges: {
      A: {
        prompt: "A figure is a 4×5 rectangle with a 3×3 square attached. What is its total area? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 29 }],
        explanation: "(4×5) + (3×3) = 20 + 9 = 29.",
      },
      B: {
        prompt: "A figure is a 6×4 rectangle with a triangle (base 4, height 3) attached. What is its total area? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 30 }],
        explanation: "(6×4) + (1/2 × 4 × 3) = 24 + 6 = 30.",
      },
      C: {
        prompt: "A figure is a 5×5 square with a 2×3 rectangle attached. What is its total area? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 31 }],
        explanation: "(5×5) + (2×3) = 25 + 6 = 31.",
      },
      D: {
        prompt: "A figure is an 8×3 rectangle with a triangle (base 6, height 4) attached. What is its total area? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 36 }],
        explanation: "(8×3) + (1/2 × 6 × 4) = 24 + 12 = 36.",
      },
    },
  },
  {
    slug: "math-g7-l23-probability-of-simple-events",
    grade: 7,
    lessonNumber: 23,
    title: "Probability and Expected Frequency",
    mathSkill: "Probability of Simple Events (7.SP.C.6)",
    teaches: "Every slot gives a chance of an outcome and a number of trials — multiply the probability by the number of trials to predict how often it happens, then build that many notes anywhere in the kit.",
    bpm: 122,
    challenges: {
      A: {
        prompt: "A spinner has 8 equal sections, 3 of them red. If you spin it 40 times, how many times do you expect red? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 15 }],
        explanation: "(3/8) × 40 = 15.",
      },
      B: {
        prompt: "A bag has 5 blue and 3 green marbles (8 total). If you draw one, look, and replace it 24 times, how many times do you expect green? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 9 }],
        explanation: "(3/8) × 24 = 9.",
      },
      C: {
        prompt: "A fair die is rolled 42 times. How many times do you expect an even number (a 1/2 chance)? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 21 }],
        explanation: "(1/2) × 42 = 21.",
      },
      D: {
        prompt: "A fair coin is flipped 50 times. How many times do you expect heads? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 25 }],
        explanation: "(1/2) × 50 = 25.",
      },
    },
  },
  {
    slug: "math-g7-l24-multi-step-percent-problems",
    grade: 7,
    lessonNumber: 24,
    title: "Multi-Step Percent Problems",
    mathSkill: "Solve Multi-Step Percent Problems: Tax and Tip (7.RP.A.3)",
    teaches: "Every slot gives a price with a tax percent and a tip percent, both on the original price — find each amount, add them to the price, and build the total anywhere in the kit, the last lesson of the year.",
    bpm: 122,
    challenges: {
      A: {
        prompt: "A $50 meal has an 8% tax and a 20% tip, both figured on the $50. What is the total? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 64 }],
        explanation: "50 + (0.08 × 50) + (0.20 × 50) = 50 + 4 + 10 = $64.",
      },
      B: {
        prompt: "A $40 meal has a 5% tax and a 15% tip, both figured on the $40. What is the total? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 48 }],
        explanation: "40 + (0.05 × 40) + (0.15 × 40) = 40 + 2 + 6 = $48.",
      },
      C: {
        prompt: "A $60 meal has a 10% tax and a 20% tip, both figured on the $60. What is the total? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 78 }],
        explanation: "60 + (0.10 × 60) + (0.20 × 60) = 60 + 6 + 12 = $78.",
      },
      D: {
        prompt: "A $30 meal has a 10% tax and a 20% tip, both figured on the $30. What is the total? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 39 }],
        explanation: "30 + (0.10 × 30) + (0.20 × 30) = 30 + 3 + 6 = $39.",
      },
    },
  },
  // ============================================================
  // GRADE 8 — exponents and radicals (integer exponent rules, square and
  // cube roots, scientific notation) open the fall, slope and linear
  // equations (including variables on both sides and systems of two
  // equations) carry through winter, functions and the Pythagorean
  // theorem fill late winter, and volume of curved solids with
  // transformations, similarity, and bivariate data close out the spring
  // — the real Common Core Grade 8 progression. Volume keeps the blocks
  // mechanic alive (a cylinder's height as blocksUsed layers of a
  // cross-sectional area, a cone the same way with π ≈ 3 collapsing the
  // formula to r²h) even as most of the year's answers come from a single
  // clean formula rather than a block-groups structure.
  // ============================================================
  {
    slug: "math-g8-l01-integer-exponents",
    grade: 8,
    lessonNumber: 1,
    title: "Integer Exponents",
    mathSkill: "Laws of Exponents (8.EE.A.1)",
    teaches: "Every slot applies a law of exponents — multiply same-base powers by adding exponents, divide by subtracting, or raise a power to a power by multiplying — then build the result anywhere in the kit.",
    bpm: 122,
    challenges: {
      A: {
        prompt: "2³ × 2² = ? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 32 }],
        explanation: "2³ × 2² = 2⁵ = 32.",
      },
      B: {
        prompt: "3⁴ ÷ 3² = ? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 9 }],
        explanation: "3⁴ ÷ 3² = 3² = 9.",
      },
      C: {
        prompt: "(2²)³ = ? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 64 }],
        explanation: "(2²)³ = 2⁶ = 64.",
      },
      D: {
        prompt: "5³ ÷ 5¹ = ? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 25 }],
        explanation: "5³ ÷ 5¹ = 5² = 25.",
      },
    },
  },
  {
    slug: "math-g8-l02-square-roots",
    grade: 8,
    lessonNumber: 2,
    title: "Square Roots",
    mathSkill: "Square Roots of Perfect Squares (8.EE.A.2)",
    teaches: "Every slot asks for a perfect square's square root — find the number that multiplies by itself to make it, then build that many notes anywhere in the kit.",
    bpm: 122,
    challenges: {
      A: {
        prompt: "√64 = ? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 8 }],
        explanation: "8 × 8 = 64, so √64 = 8.",
      },
      B: {
        prompt: "√121 = ? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 11 }],
        explanation: "11 × 11 = 121, so √121 = 11.",
      },
      C: {
        prompt: "√144 = ? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 12 }],
        explanation: "12 × 12 = 144, so √144 = 12.",
      },
      D: {
        prompt: "√225 = ? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 15 }],
        explanation: "15 × 15 = 225, so √225 = 15.",
      },
    },
  },
  {
    slug: "math-g8-l03-cube-roots",
    grade: 8,
    lessonNumber: 3,
    title: "Cube Roots",
    mathSkill: "Cube Roots of Perfect Cubes (8.EE.A.2)",
    teaches: "Every slot asks for a perfect cube's cube root — find the number that multiplies by itself three times to make it, then build that many quarter notes.",
    bpm: 122,
    challenges: {
      A: {
        prompt: "∛27 = ? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 3 }],
        explanation: "3 × 3 × 3 = 27, so ∛27 = 3.",
      },
      B: {
        prompt: "∛125 = ? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 5 }],
        explanation: "5 × 5 × 5 = 125, so ∛125 = 5.",
      },
      C: {
        prompt: "∛216 = ? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 6 }],
        explanation: "6 × 6 × 6 = 216, so ∛216 = 6.",
      },
      D: {
        prompt: "∛64 = ? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 4 }],
        explanation: "4 × 4 × 4 = 64, so ∛64 = 4.",
      },
    },
  },
  {
    slug: "math-g8-l04-comparing-numbers-in-scientific-notation",
    grade: 8,
    lessonNumber: 4,
    title: "Comparing Numbers in Scientific Notation",
    mathSkill: "Compare Very Large and Very Small Numbers (8.EE.A.3)",
    teaches: "Every slot gives two numbers in scientific notation — figure out how many times bigger the first is than the second, then build that many notes anywhere in the kit.",
    bpm: 122,
    challenges: {
      A: {
        prompt: "How many times bigger is 6×10³ than 2×10³? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 3 }],
        explanation: "(6×10³) ÷ (2×10³) = 3.",
      },
      B: {
        prompt: "How many times bigger is 8×10⁵ than 4×10⁵? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 2 }],
        explanation: "(8×10⁵) ÷ (4×10⁵) = 2.",
      },
      C: {
        prompt: "How many times bigger is 1×10⁶ than 2×10⁵? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 5 }],
        explanation: "(1×10⁶) ÷ (2×10⁵) = 5.",
      },
      D: {
        prompt: "How many times bigger is 6×10⁷ than 2×10⁶? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 30 }],
        explanation: "(6×10⁷) ÷ (2×10⁶) = 30.",
      },
    },
  },
  {
    slug: "math-g8-l05-operations-with-scientific-notation",
    grade: 8,
    lessonNumber: 5,
    title: "Operations with Scientific Notation",
    mathSkill: "Add, Subtract, and Multiply Numbers in Scientific Notation (8.EE.A.4)",
    teaches: "Every slot combines two numbers in scientific notation — work out just the coefficient (the number in front of the power of ten), then build that many notes anywhere in the kit.",
    bpm: 122,
    challenges: {
      A: {
        prompt: "(2×10³) + (3×10³) = ? What is the coefficient of the result (the number before ×10³)? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 5 }],
        explanation: "2 + 3 = 5, so the sum is 5×10³.",
      },
      B: {
        prompt: "(6×10²) - (2×10²) = ? What is the coefficient of the result? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 4 }],
        explanation: "6 - 2 = 4, so the difference is 4×10².",
      },
      C: {
        prompt: "(2×10³) × (3×10¹) = ? What is the coefficient of the result? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 6 }],
        explanation: "2 × 3 = 6, so the product's coefficient is 6.",
      },
      D: {
        prompt: "(3×10²) × (3×10¹) = ? What is the coefficient of the result? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 9 }],
        explanation: "3 × 3 = 9, so the product's coefficient is 9.",
      },
    },
  },
  {
    slug: "math-g8-l06-slope-of-a-proportional-relationship",
    grade: 8,
    lessonNumber: 6,
    title: "Slope of a Proportional Relationship",
    mathSkill: "Graph Proportional Relationships and Interpret the Slope (8.EE.B.5)",
    teaches: "Every slot gives a line through the origin and one other point — divide rise by run to find the slope, then build that many notes anywhere in the kit.",
    bpm: 122,
    challenges: {
      A: {
        prompt: "A line passes through (0, 0) and (4, 12). What is its slope? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 3 }],
        explanation: "slope = 12/4 = 3.",
      },
      B: {
        prompt: "A line passes through (0, 0) and (5, 20). What is its slope? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 4 }],
        explanation: "slope = 20/5 = 4.",
      },
      C: {
        prompt: "A line passes through (0, 0) and (8, 40). What is its slope? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 5 }],
        explanation: "slope = 40/8 = 5.",
      },
      D: {
        prompt: "A line passes through (0, 0) and (10, 60). What is its slope? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 6 }],
        explanation: "slope = 60/10 = 6.",
      },
    },
  },
  {
    slug: "math-g8-l07-slope-from-two-points",
    grade: 8,
    lessonNumber: 7,
    title: "Slope from Two Points",
    mathSkill: "Find the Slope Between Two Points (8.EE.B.6)",
    teaches: "Every slot gives two points not on the origin — divide the change in y by the change in x, then build the slope anywhere in the kit.",
    bpm: 124,
    challenges: {
      A: {
        prompt: "Find the slope between (1, 2) and (4, 11). Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 3 }],
        explanation: "slope = (11 - 2)/(4 - 1) = 9/3 = 3.",
      },
      B: {
        prompt: "Find the slope between (2, 5) and (6, 21). Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 4 }],
        explanation: "slope = (21 - 5)/(6 - 2) = 16/4 = 4.",
      },
      C: {
        prompt: "Find the slope between (0, 3) and (5, 28). Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 5 }],
        explanation: "slope = (28 - 3)/(5 - 0) = 25/5 = 5.",
      },
      D: {
        prompt: "Find the slope between (1, 1) and (7, 37). Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 6 }],
        explanation: "slope = (37 - 1)/(7 - 1) = 36/6 = 6.",
      },
    },
  },
  {
    slug: "math-g8-l08-two-step-linear-equations",
    grade: 8,
    lessonNumber: 8,
    title: "Two-Step Linear Equations",
    mathSkill: "Solve Linear Equations in One Variable (8.EE.C.7)",
    teaches: "Every slot hides x behind a multiplication and an addition or subtraction — undo them in reverse order, then build x anywhere in the kit.",
    bpm: 124,
    challenges: {
      A: {
        prompt: "4x - 7 = 21. What is x? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 7 }],
        explanation: "4x - 7 = 21 → 4x = 28 → x = 7.",
      },
      B: {
        prompt: "3x + 8 = 32. What is x? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 8 }],
        explanation: "3x + 8 = 32 → 3x = 24 → x = 8.",
      },
      C: {
        prompt: "6x - 5 = 25. What is x? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 5 }],
        explanation: "6x - 5 = 25 → 6x = 30 → x = 5.",
      },
      D: {
        prompt: "5x + 9 = 39. What is x? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 6 }],
        explanation: "5x + 9 = 39 → 5x = 30 → x = 6.",
      },
    },
  },
  {
    slug: "math-g8-l09-equations-with-variables-on-both-sides",
    grade: 8,
    lessonNumber: 9,
    title: "Equations with Variables on Both Sides",
    mathSkill: "Solve Linear Equations with Variables on Both Sides (8.EE.C.7b)",
    teaches: "Every slot has x-terms on both sides of the equation — gather them onto one side, undo what's left, and build x anywhere in the kit.",
    bpm: 124,
    challenges: {
      A: {
        prompt: "5x + 3 = 2x + 18. What is x? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 5 }],
        explanation: "5x + 3 = 2x + 18 → 3x = 15 → x = 5.",
      },
      B: {
        prompt: "7x - 4 = 3x + 24. What is x? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 7 }],
        explanation: "7x - 4 = 3x + 24 → 4x = 28 → x = 7.",
      },
      C: {
        prompt: "8x + 2 = 3x + 42. What is x? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 8 }],
        explanation: "8x + 2 = 3x + 42 → 5x = 40 → x = 8.",
      },
      D: {
        prompt: "6x - 9 = x + 21. What is x? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 6 }],
        explanation: "6x - 9 = x + 21 → 5x = 30 → x = 6.",
      },
    },
  },
  {
    slug: "math-g8-l10-systems-of-equations",
    grade: 8,
    lessonNumber: 10,
    title: "Systems of Equations",
    mathSkill: "Solve Systems of Two Linear Equations by Substitution (8.EE.C.8b)",
    teaches: "Every slot gives two equations for the same y — set them equal to each other and solve for x, then build x anywhere in the kit.",
    bpm: 124,
    challenges: {
      A: {
        prompt: "y = x + 3 and y = 2x. What is x? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 3 }],
        explanation: "x + 3 = 2x → 3 = x, so x = 3.",
      },
      B: {
        prompt: "y = 2x + 1 and y = 3x - 4. What is x? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 5 }],
        explanation: "2x + 1 = 3x - 4 → 5 = x, so x = 5.",
      },
      C: {
        prompt: "y = x + 2 and y = 3x - 6. What is x? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 4 }],
        explanation: "x + 2 = 3x - 6 → 8 = 2x → x = 4.",
      },
      D: {
        prompt: "y = x + 1 and y = 2x - 5. What is x? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 6 }],
        explanation: "x + 1 = 2x - 5 → 6 = x, so x = 6.",
      },
    },
  },
  {
    slug: "math-g8-l11-evaluating-functions",
    grade: 8,
    lessonNumber: 11,
    title: "Evaluating Functions",
    mathSkill: "Evaluate Functions (8.F.A.1)",
    teaches: "Every slot gives a function rule and an input — substitute the input in and work it out, then build the output anywhere in the kit.",
    bpm: 124,
    challenges: {
      A: {
        prompt: "f(x) = 2x + 3. What is f(5)? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 13 }],
        explanation: "f(5) = 2(5) + 3 = 13.",
      },
      B: {
        prompt: "f(x) = 3x - 4. What is f(6)? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 14 }],
        explanation: "f(6) = 3(6) - 4 = 14.",
      },
      C: {
        prompt: "f(x) = x² + 1. What is f(4)? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 17 }],
        explanation: "f(4) = 4² + 1 = 17.",
      },
      D: {
        prompt: "f(x) = 4x - 2. What is f(7)? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 26 }],
        explanation: "f(7) = 4(7) - 2 = 26.",
      },
    },
  },
  {
    slug: "math-g8-l12-rate-of-change",
    grade: 8,
    lessonNumber: 12,
    title: "Rate of Change",
    mathSkill: "Compare and Interpret Rate of Change (8.F.B.4)",
    teaches: "Every slot gives two input-output pairs from a function — divide the change in output by the change in input to find the rate of change, then build it anywhere in the kit.",
    bpm: 124,
    challenges: {
      A: {
        prompt: "A function goes from f(2) = 8 to f(6) = 20. What is its rate of change? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 3 }],
        explanation: "(20 - 8)/(6 - 2) = 12/4 = 3.",
      },
      B: {
        prompt: "A function goes from f(1) = 5 to f(4) = 17. What is its rate of change? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 4 }],
        explanation: "(17 - 5)/(4 - 1) = 12/3 = 4.",
      },
      C: {
        prompt: "A function goes from f(0) = 2 to f(5) = 27. What is its rate of change? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 5 }],
        explanation: "(27 - 2)/(5 - 0) = 25/5 = 5.",
      },
      D: {
        prompt: "A function goes from f(3) = 10 to f(9) = 46. What is its rate of change? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 6 }],
        explanation: "(46 - 10)/(9 - 3) = 36/6 = 6.",
      },
    },
  },
  {
    slug: "math-g8-l13-pythagorean-theorem-hypotenuse",
    grade: 8,
    lessonNumber: 13,
    title: "Pythagorean Theorem: Finding the Hypotenuse",
    mathSkill: "The Pythagorean Theorem (8.G.B.7)",
    teaches: "Every slot gives a right triangle's two legs — square them, add, and take the square root to find the hypotenuse, then build it anywhere in the kit.",
    bpm: 124,
    challenges: {
      A: {
        prompt: "A right triangle has legs 3 and 4. What is its hypotenuse? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 5 }],
        explanation: "√(3² + 4²) = √25 = 5.",
      },
      B: {
        prompt: "A right triangle has legs 6 and 8. What is its hypotenuse? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 10 }],
        explanation: "√(6² + 8²) = √100 = 10.",
      },
      C: {
        prompt: "A right triangle has legs 5 and 12. What is its hypotenuse? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 13 }],
        explanation: "√(5² + 12²) = √169 = 13.",
      },
      D: {
        prompt: "A right triangle has legs 9 and 12. What is its hypotenuse? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 15 }],
        explanation: "√(9² + 12²) = √225 = 15.",
      },
    },
  },
  {
    slug: "math-g8-l14-pythagorean-theorem-a-leg",
    grade: 8,
    lessonNumber: 14,
    title: "Pythagorean Theorem: Finding a Leg",
    mathSkill: "The Pythagorean Theorem (8.G.B.7)",
    teaches: "Every slot gives a right triangle's hypotenuse and one leg — square them, subtract, and take the square root to find the missing leg, then build it anywhere in the kit.",
    bpm: 124,
    challenges: {
      A: {
        prompt: "A right triangle has a hypotenuse of 10 and one leg of 6. What is the other leg? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 8 }],
        explanation: "√(10² - 6²) = √64 = 8.",
      },
      B: {
        prompt: "A right triangle has a hypotenuse of 13 and one leg of 5. What is the other leg? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 12 }],
        explanation: "√(13² - 5²) = √144 = 12.",
      },
      C: {
        prompt: "A right triangle has a hypotenuse of 17 and one leg of 8. What is the other leg? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 15 }],
        explanation: "√(17² - 8²) = √225 = 15.",
      },
      D: {
        prompt: "A right triangle has a hypotenuse of 25 and one leg of 7. What is the other leg? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 24 }],
        explanation: "√(25² - 7²) = √576 = 24.",
      },
    },
  },
  {
    slug: "math-g8-l15-distance-between-two-points",
    grade: 8,
    lessonNumber: 15,
    title: "Distance Between Two Points",
    mathSkill: "Apply the Pythagorean Theorem to Find Distance (8.G.B.8)",
    teaches: "Every slot gives two points on a grid — build the right triangle between them (the horizontal and vertical legs) and use the Pythagorean theorem to find the distance, then build it anywhere in the kit.",
    bpm: 124,
    challenges: {
      A: {
        prompt: "What is the distance between (0, 0) and (3, 4)? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 5 }],
        explanation: "√(3² + 4²) = √25 = 5.",
      },
      B: {
        prompt: "What is the distance between (0, 0) and (6, 8)? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 10 }],
        explanation: "√(6² + 8²) = √100 = 10.",
      },
      C: {
        prompt: "What is the distance between (1, 1) and (13, 6)? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 13 }],
        explanation: "The legs are 12 and 5: √(12² + 5²) = √169 = 13.",
      },
      D: {
        prompt: "What is the distance between (0, 0) and (9, 12)? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 15 }],
        explanation: "√(9² + 12²) = √225 = 15.",
      },
    },
  },
  {
    slug: "math-g8-l16-volume-of-cylinders",
    grade: 8,
    lessonNumber: 16,
    title: "Volume of Cylinders",
    mathSkill: "Volume of a Cylinder (8.G.C.9)",
    teaches: "Every slot gives a cylinder with radius 1 (so, using π ≈ 3, each layer's circular base holds 3 notes) and a height — the height is how many BLOCKS you use; build the total volume across exactly that many blocks.",
    bpm: 124,
    challenges: {
      A: {
        prompt: "A cylinder has radius 1 and height 5. Using π ≈ 3, build a drum beat using exactly 5 blocks that add up to 15 notes in all — its volume.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 15, blocksUsed: 5 }],
        explanation: "V = πr²h ≈ 3(1²)(5) = 15 — 5 blocks holding 15 notes in all.",
      },
      B: {
        prompt: "A cylinder has radius 1 and height 8. Using π ≈ 3, build a drum beat using exactly 8 blocks that add up to 24 notes in all — its volume.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 24, blocksUsed: 8 }],
        explanation: "V = πr²h ≈ 3(1²)(8) = 24.",
      },
      C: {
        prompt: "A cylinder has radius 1 and height 6. Using π ≈ 3, build a drum beat using exactly 6 blocks that add up to 18 notes in all — its volume.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 18, blocksUsed: 6 }],
        explanation: "V = πr²h ≈ 3(1²)(6) = 18.",
      },
      D: {
        prompt: "A cylinder has radius 1 and height 7. Using π ≈ 3, build a drum beat using exactly 7 blocks that add up to 21 notes in all — its volume.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 21, blocksUsed: 7 }],
        explanation: "V = πr²h ≈ 3(1²)(7) = 21.",
      },
    },
  },
  {
    slug: "math-g8-l17-volume-of-cones",
    grade: 8,
    lessonNumber: 17,
    title: "Volume of Cones",
    mathSkill: "Volume of a Cone (8.G.C.9)",
    teaches: "Every slot gives a cone's radius and height — using π ≈ 3, the 1/3 and the π cancel out, leaving volume = r² × h. The height is how many BLOCKS you use; build the total across exactly that many blocks.",
    bpm: 126,
    challenges: {
      A: {
        prompt: "A cone has radius 2 and height 3. Using π ≈ 3, build a drum beat using exactly 3 blocks that add up to 12 notes in all — its volume.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 12, blocksUsed: 3 }],
        explanation: "V = (1/3)πr²h ≈ (1/3)(3)(2²)(3) = (2²)(3) = 12 — 3 blocks holding 12 notes in all.",
      },
      B: {
        prompt: "A cone has radius 1 and height 8. Using π ≈ 3, build a drum beat using exactly 8 blocks that add up to 8 notes in all — its volume.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 8, blocksUsed: 8 }],
        explanation: "V = (1/3)πr²h ≈ (1²)(8) = 8.",
      },
      C: {
        prompt: "A cone has radius 2 and height 6. Using π ≈ 3, build a drum beat using exactly 6 blocks that add up to 24 notes in all — its volume.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 24, blocksUsed: 6 }],
        explanation: "V = (1/3)πr²h ≈ (2²)(6) = 24.",
      },
      D: {
        prompt: "A cone has radius 2 and height 7. Using π ≈ 3, build a drum beat using exactly 7 blocks that add up to 28 notes in all — its volume.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 28, blocksUsed: 7 }],
        explanation: "V = (1/3)πr²h ≈ (2²)(7) = 28.",
      },
    },
  },
  {
    slug: "math-g8-l18-volume-of-spheres",
    grade: 8,
    lessonNumber: 18,
    title: "Volume of Spheres",
    mathSkill: "Volume of a Sphere (8.G.C.9)",
    teaches: "Every slot gives a sphere's radius or diameter — using π ≈ 3, volume = 4r³. Work it out, then build the result anywhere in the kit.",
    bpm: 126,
    challenges: {
      A: {
        prompt: "A sphere has radius 1. Using π ≈ 3, what is its volume? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 4 }],
        explanation: "V = (4/3)πr³ ≈ (4/3)(3)(1³) = 4.",
      },
      B: {
        prompt: "A sphere has radius 2. Using π ≈ 3, what is its volume? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 32 }],
        explanation: "V = (4/3)πr³ ≈ (4/3)(3)(2³) = 4(8) = 32.",
      },
      C: {
        prompt: "A sphere has a diameter of 2 (radius 1). Using π ≈ 3, what is its volume? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 4 }],
        explanation: "radius = 1, so V ≈ 4(1³) = 4.",
      },
      D: {
        prompt: "Sphere A has radius 1 (volume 4). Sphere B has radius 2 (volume 32). How many times bigger is Sphere B's volume? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 8 }],
        explanation: "32 ÷ 4 = 8.",
      },
    },
  },
  {
    slug: "math-g8-l19-translations",
    grade: 8,
    lessonNumber: 19,
    title: "Translations",
    mathSkill: "Translations on the Coordinate Plane (8.G.A.1)",
    teaches: "Every slot moves a point left/right and up/down — apply the shift to the coordinate asked for, then build that many notes anywhere in the kit.",
    bpm: 126,
    challenges: {
      A: {
        prompt: "Point (3, 5) is translated 4 units right. What is its new x-coordinate? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 7 }],
        explanation: "3 + 4 = 7.",
      },
      B: {
        prompt: "Point (2, 6) is translated 3 units down. What is its new y-coordinate? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 3 }],
        explanation: "6 - 3 = 3.",
      },
      C: {
        prompt: "Point (1, 1) is translated 8 units right. What is its new x-coordinate? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 9 }],
        explanation: "1 + 8 = 9.",
      },
      D: {
        prompt: "Point (10, 10) is translated 6 units left. What is its new x-coordinate? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 4 }],
        explanation: "10 - 6 = 4.",
      },
    },
  },
  {
    slug: "math-g8-l20-reflections-and-rotations",
    grade: 8,
    lessonNumber: 20,
    title: "Reflections and Rotations",
    mathSkill: "Reflections and Rotations on the Coordinate Plane (8.G.A.3)",
    teaches: "Every slot reflects or rotates a point — a reflection flips the sign of one coordinate, a 180° rotation flips both — then build the new coordinate's distance from zero anywhere in the kit.",
    bpm: 126,
    challenges: {
      A: {
        prompt: "Point (4, 7) is reflected over the x-axis. What is the distance of its new y-coordinate from zero? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 7 }],
        explanation: "Reflecting over the x-axis flips y to -7, a distance of 7 from zero.",
      },
      B: {
        prompt: "Point (5, 3) is reflected over the y-axis. What is the distance of its new x-coordinate from zero? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 5 }],
        explanation: "Reflecting over the y-axis flips x to -5, a distance of 5 from zero.",
      },
      C: {
        prompt: "Point (6, 2) is rotated 180° about the origin. What is the distance of its new x-coordinate from zero? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 6 }],
        explanation: "A 180° rotation flips both coordinates to (-6, -2); the new x is 6 away from zero.",
      },
      D: {
        prompt: "Point (9, 4) is reflected over the x-axis. What is the distance of its new y-coordinate from zero? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 4 }],
        explanation: "Reflecting over the x-axis flips y to -4, a distance of 4 from zero.",
      },
    },
  },
  {
    slug: "math-g8-l21-similar-figures-and-scale-factor",
    grade: 8,
    lessonNumber: 21,
    title: "Similar Figures and Scale Factor",
    mathSkill: "Similarity and Scale Factor (8.G.A.4)",
    teaches: "Every slot gives corresponding sides from two similar figures — divide the larger by the smaller to find the scale factor, then build that many notes anywhere in the kit.",
    bpm: 126,
    challenges: {
      A: {
        prompt: "Two similar triangles: the smaller triangle has a side of 4, and the corresponding side on the larger triangle is 12. What is the scale factor? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 3 }],
        explanation: "12 ÷ 4 = 3.",
      },
      B: {
        prompt: "Two similar rectangles: the smaller has a side of 3, and the corresponding side on the larger is 15. What is the scale factor? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 5 }],
        explanation: "15 ÷ 3 = 5.",
      },
      C: {
        prompt: "Two similar triangles: the smaller has a side of 6, and the corresponding side on the larger is 24. What is the scale factor? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 4 }],
        explanation: "24 ÷ 6 = 4.",
      },
      D: {
        prompt: "Two similar rectangles: the smaller has a side of 5, and the corresponding side on the larger is 30. What is the scale factor? Build a drum beat with that many quarter notes.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 6 }],
        explanation: "30 ÷ 5 = 6.",
      },
    },
  },
  {
    slug: "math-g8-l22-angle-relationships-in-triangles-and-parallel-lines",
    grade: 8,
    lessonNumber: 22,
    title: "Angle Relationships in Triangles and Parallel Lines",
    mathSkill: "Angle Relationships from Triangle Sums and Parallel Lines Cut by a Transversal (8.G.A.5)",
    teaches: "Every slot uses either the triangle angle sum (180°) or a rule for angles formed by a transversal crossing parallel lines — work out the missing angle, then build it anywhere in the kit.",
    bpm: 126,
    challenges: {
      A: {
        prompt: "A triangle has angles of 50° and 60°. What is the third angle? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 70 }],
        explanation: "180 - 50 - 60 = 70°.",
      },
      B: {
        prompt: "A triangle has angles of 70° and 45°. What is the third angle? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 65 }],
        explanation: "180 - 70 - 45 = 65°.",
      },
      C: {
        prompt: "Two parallel lines are cut by a transversal. One alternate interior angle measures 55°. What is the other one (alternate interior angles are always equal)? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 55 }],
        explanation: "Alternate interior angles are congruent, so the other angle is also 55°.",
      },
      D: {
        prompt: "Two parallel lines are cut by a transversal. One co-interior (same-side interior) angle measures 100°. What is the other one (co-interior angles are always supplementary)? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 80 }],
        explanation: "Co-interior angles sum to 180°, so the other angle is 180 - 100 = 80°.",
      },
    },
  },
  {
    slug: "math-g8-l23-scatter-plots-and-lines-of-best-fit",
    grade: 8,
    lessonNumber: 23,
    title: "Scatter Plots and Lines of Best Fit",
    mathSkill: "Use a Line of Best Fit to Make Predictions (8.SP.A.2/A.3)",
    teaches: "Every slot gives a line of best fit's equation and an x-value — plug it in and work it out, then build the predicted y-value anywhere in the kit.",
    bpm: 126,
    challenges: {
      A: {
        prompt: "A line of best fit is y = 2x + 3. What is the predicted y when x = 10? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 23 }],
        explanation: "y = 2(10) + 3 = 23.",
      },
      B: {
        prompt: "A line of best fit is y = 3x + 1. What is the predicted y when x = 8? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 25 }],
        explanation: "y = 3(8) + 1 = 25.",
      },
      C: {
        prompt: "A line of best fit is y = 4x - 2. What is the predicted y when x = 7? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 26 }],
        explanation: "y = 4(7) - 2 = 26.",
      },
      D: {
        prompt: "A line of best fit is y = 5x + 4. What is the predicted y when x = 5? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 29 }],
        explanation: "y = 5(5) + 4 = 29.",
      },
    },
  },
  {
    slug: "math-g8-l24-two-way-tables",
    grade: 8,
    lessonNumber: 24,
    title: "Two-Way Tables",
    mathSkill: "Construct and Interpret Two-Way Tables (8.SP.A.4)",
    teaches: "Every slot gives a category's total and how many of those also fall in a second category — subtract to find how many are in the first category only, then build that many notes anywhere in the kit, the last lesson of the year.",
    bpm: 126,
    challenges: {
      A: {
        prompt: "In a survey, 45 students like sports, and 20 of those also like music. How many like sports but NOT music? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 25 }],
        explanation: "45 - 20 = 25.",
      },
      B: {
        prompt: "In a survey, 60 students like art, and 15 of those also like drama. How many like art but NOT drama? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 45 }],
        explanation: "60 - 15 = 45.",
      },
      C: {
        prompt: "In a survey, 90 students like science, and 30 of those also like coding. How many like science but NOT coding? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 60 }],
        explanation: "90 - 30 = 60.",
      },
      D: {
        prompt: "In a survey, 50 students like reading, and 18 of those also like writing. How many like reading but NOT writing? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 32 }],
        explanation: "50 - 18 = 32.",
      },
    },
  },

  // ============================================================
  // HIGH SCHOOL — starting the K-8 curriculum's grade-by-grade climb into
  // 9-12. Common Core (and Oregon's 2021 adoption of it) doesn't band high
  // school standards by grade the way K-8 is banded — high school math is
  // organized by conceptual category (A, F, G, N, S) and left to each
  // district to sequence into courses. Grade 9-12 here map to the single
  // most common US course sequence for those grades — Algebra I, Geometry,
  // Algebra II, and a capstone (Pre-Calc/Statistics) — same fall-through-
  // spring pacing convention as K-8, cited by conceptual-category code
  // (e.g. A-REI.B.3) instead of a grade-banded one.
  //
  // Grade 9 = Algebra I. Same 24-lesson, four-unit-per-quarter shape as
  // every grade before it, but two mechanics get pushed further now that
  // the math itself has two moving parts more often: a target's
  // `instrument` array can pair two different kit pieces so a single slot
  // grades two related quantities at once (rise on crash + run on ride for
  // slope, x on kick + y on snare for a system's solution, a trinomial's
  // two factors on low tom + mid tom, a quadratic's two roots on high tom +
  // rimshot) — and `blocksUsed` now doubles as a literal time-signature
  // choice, not just a grouping count: building a solution across exactly
  // N blocks writes an N/4 bar (see timeSignatureLabel in song.ts), so
  // solving "6x = 30" by building 5 blocks worth 30 notes puts the answer
  // in 5/4, and the geometric-sequence capstone's 6-block term lands in a
  // full 6/4 bar. Every lesson's auto-generated Stack (/math/<slug>/stack)
  // is still there too — worth a listen on the sequence lessons in
  // particular, where repeating a slot across the Stack's steps is exactly
  // what the sequence itself does.
  // ============================================================
  {
    slug: "math-g9-l01-order-of-operations-with-exponents",
    grade: 9,
    lessonNumber: 1,
    title: "Order of Operations with Exponents",
    mathSkill: "Evaluate Numerical Expressions Involving Exponents (A-SSE.A.1)",
    teaches: "Every slot is a numerical expression with an exponent — apply the exponent first, then multiply/divide, then add/subtract, and build that many notes anywhere in the kit.",
    bpm: 128,
    challenges: {
      A: {
        prompt: "Evaluate 2³ + 4 × 3. Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 20 }],
        explanation: "2³ = 8, then 4 × 3 = 12. 8 + 12 = 20.",
      },
      B: {
        prompt: "Evaluate 3² + 5 × 4. Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 29 }],
        explanation: "3² = 9, then 5 × 4 = 20. 9 + 20 = 29.",
      },
      C: {
        prompt: "Evaluate 4² - 2 × 3. Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 10 }],
        explanation: "4² = 16, then 2 × 3 = 6. 16 - 6 = 10.",
      },
      D: {
        prompt: "Evaluate 5² + 3 × 5. Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 40 }],
        explanation: "5² = 25, then 3 × 5 = 15. 25 + 15 = 40.",
      },
    },
  },
  {
    slug: "math-g9-l02-evaluating-algebraic-expressions",
    grade: 9,
    lessonNumber: 2,
    title: "Evaluating Algebraic Expressions",
    mathSkill: "Evaluate Expressions by Substitution (A-SSE.A.1)",
    teaches: "Every slot gives an expression with a squared term and a value for x — substitute, then work it out, then build that many notes anywhere in the kit.",
    bpm: 128,
    challenges: {
      A: {
        prompt: "Evaluate 2x² + 3 when x = 3. Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 21 }],
        explanation: "2(3)² + 3 = 2(9) + 3 = 18 + 3 = 21.",
      },
      B: {
        prompt: "Evaluate 3x² - 2 when x = 2. Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 10 }],
        explanation: "3(2)² - 2 = 3(4) - 2 = 12 - 2 = 10.",
      },
      C: {
        prompt: "Evaluate x² + 5x when x = 4. Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 36 }],
        explanation: "(4)² + 5(4) = 16 + 20 = 36.",
      },
      D: {
        prompt: "Evaluate 4x² - x when x = 3. Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 33 }],
        explanation: "4(3)² - 3 = 4(9) - 3 = 36 - 3 = 33.",
      },
    },
  },
  {
    slug: "math-g9-l03-combining-like-terms",
    grade: 9,
    lessonNumber: 3,
    title: "Combining Like Terms",
    mathSkill: "Simplify Expressions by Combining Like Terms (A-SSE.A.1.b)",
    teaches: "Every slot has three like terms to combine into one — simplify, substitute the given x, then build that many notes anywhere in the kit.",
    bpm: 128,
    challenges: {
      A: {
        prompt: "Simplify 5x + 3x - 2x to a single term, then evaluate it when x = 4. Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 24 }],
        explanation: "5x + 3x - 2x = 6x. 6(4) = 24.",
      },
      B: {
        prompt: "Simplify 7x - 2x + x to a single term, then evaluate it when x = 5. Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 30 }],
        explanation: "7x - 2x + x = 6x. 6(5) = 30.",
      },
      C: {
        prompt: "Simplify 4x + 6x - 3x to a single term, then evaluate it when x = 3. Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 21 }],
        explanation: "4x + 6x - 3x = 7x. 7(3) = 21.",
      },
      D: {
        prompt: "Simplify 9x - 4x + 2x to a single term, then evaluate it when x = 4. Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 28 }],
        explanation: "9x - 4x + 2x = 7x. 7(4) = 28.",
      },
    },
  },
  {
    slug: "math-g9-l04-the-distributive-property",
    grade: 9,
    lessonNumber: 4,
    title: "The Distributive Property",
    mathSkill: "Expand Expressions with the Distributive Property (A-SSE.A.2)",
    teaches: "Every slot has a number times a sum — distribute it across both terms, substitute the given x, then build that many notes anywhere in the kit.",
    bpm: 128,
    challenges: {
      A: {
        prompt: "Expand 3(x + 5) using the distributive property, then evaluate when x = 2. Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 21 }],
        explanation: "3(x + 5) = 3x + 15. 3(2) + 15 = 6 + 15 = 21.",
      },
      B: {
        prompt: "Expand 4(x + 2) using the distributive property, then evaluate when x = 3. Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 20 }],
        explanation: "4(x + 2) = 4x + 8. 4(3) + 8 = 12 + 8 = 20.",
      },
      C: {
        prompt: "Expand 2(x + 7) using the distributive property, then evaluate when x = 4. Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 22 }],
        explanation: "2(x + 7) = 2x + 14. 2(4) + 14 = 8 + 14 = 22.",
      },
      D: {
        prompt: "Expand 5(x + 1) using the distributive property, then evaluate when x = 3. Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 20 }],
        explanation: "5(x + 1) = 5x + 5. 5(3) + 5 = 15 + 5 = 20.",
      },
    },
  },
  {
    slug: "math-g9-l05-one-step-equations-addition-and-subtraction",
    grade: 9,
    lessonNumber: 5,
    title: "One-Step Equations (Addition & Subtraction)",
    mathSkill: "Solve One-Step Equations by Addition/Subtraction (A-REI.B.3)",
    teaches: "Every slot is a one-step equation — undo the addition or subtraction to isolate x, then build that many notes anywhere in the kit.",
    bpm: 128,
    challenges: {
      A: {
        prompt: "Solve for x: x + 8 = 15. Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 7 }],
        explanation: "x + 8 = 15 → x = 15 - 8 = 7.",
      },
      B: {
        prompt: "Solve for x: x - 5 = 12. Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 17 }],
        explanation: "x - 5 = 12 → x = 12 + 5 = 17.",
      },
      C: {
        prompt: "Solve for x: x + 13 = 20. Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 7 }],
        explanation: "x + 13 = 20 → x = 20 - 13 = 7.",
      },
      D: {
        prompt: "Solve for x: x - 9 = 6. Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 15 }],
        explanation: "x - 9 = 6 → x = 6 + 9 = 15.",
      },
    },
  },
  {
    slug: "math-g9-l06-one-step-equations-multiplication-and-division",
    grade: 9,
    lessonNumber: 6,
    title: "One-Step Equations (Multiplication & Division)",
    mathSkill: "Solve One-Step Equations by Multiplication/Division (A-REI.B.3)",
    teaches: "Every slot is a one-step equation like 6x = 30 — x itself is how many BLOCKS you use, and the total is how many notes go across them, so solving by division becomes splitting the total into x equal groups.",
    bpm: 128,
    challenges: {
      A: {
        prompt: "Solve 6x = 30 for x. Build a drum beat using exactly that many blocks, adding up to 30 notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 30, blocksUsed: 5 }],
        explanation: "6x = 30 → x = 30 ÷ 6 = 5 — 5 blocks holding 30 notes in all, 6 in each.",
      },
      B: {
        prompt: "Solve 5x = 35 for x. Build a drum beat using exactly that many blocks, adding up to 35 notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 35, blocksUsed: 7 }],
        explanation: "5x = 35 → x = 35 ÷ 5 = 7 — 7 blocks holding 35 notes in all, 5 in each.",
      },
      C: {
        prompt: "Solve 8x = 32 for x. Build a drum beat using exactly that many blocks, adding up to 32 notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 32, blocksUsed: 4 }],
        explanation: "8x = 32 → x = 32 ÷ 8 = 4 — 4 blocks holding 32 notes in all, 8 in each.",
      },
      D: {
        prompt: "Solve 9x = 27 for x. Build a drum beat using exactly that many blocks, adding up to 27 notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 27, blocksUsed: 3 }],
        explanation: "9x = 27 → x = 27 ÷ 9 = 3 — 3 blocks holding 27 notes in all, 9 in each.",
      },
    },
  },
  {
    slug: "math-g9-l07-two-step-equations",
    grade: 9,
    lessonNumber: 7,
    title: "Two-Step Equations",
    mathSkill: "Solve Two-Step Equations (A-REI.B.3)",
    teaches: "Every slot is a two-step equation — undo the addition/subtraction first, then the multiplication, to isolate x, then build that many notes anywhere in the kit.",
    bpm: 130,
    challenges: {
      A: {
        prompt: "Solve for x: 3x + 4 = 19. Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 5 }],
        explanation: "3x + 4 = 19 → 3x = 15 → x = 5.",
      },
      B: {
        prompt: "Solve for x: 5x - 6 = 24. Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 6 }],
        explanation: "5x - 6 = 24 → 5x = 30 → x = 6.",
      },
      C: {
        prompt: "Solve for x: 2x + 9 = 23. Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 7 }],
        explanation: "2x + 9 = 23 → 2x = 14 → x = 7.",
      },
      D: {
        prompt: "Solve for x: 4x - 3 = 29. Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 8 }],
        explanation: "4x - 3 = 29 → 4x = 32 → x = 8.",
      },
    },
  },
  {
    slug: "math-g9-l08-multi-step-equations-variables-on-both-sides",
    grade: 9,
    lessonNumber: 8,
    title: "Multi-Step Equations with Variables on Both Sides",
    mathSkill: "Solve Equations with the Variable on Both Sides (A-REI.A.1)",
    teaches: "Every slot has x terms on both sides — gather them onto one side, gather the numbers onto the other, then build the solution anywhere in the kit.",
    bpm: 130,
    challenges: {
      A: {
        prompt: "Solve for x: 5x + 3 = 2x + 18. Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 5 }],
        explanation: "5x + 3 = 2x + 18 → 3x = 15 → x = 5.",
      },
      B: {
        prompt: "Solve for x: 6x - 7 = 3x + 11. Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 6 }],
        explanation: "6x - 7 = 3x + 11 → 3x = 18 → x = 6.",
      },
      C: {
        prompt: "Solve for x: 8x - 3 = 5x + 18. Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 7 }],
        explanation: "8x - 3 = 5x + 18 → 3x = 21 → x = 7.",
      },
      D: {
        prompt: "Solve for x: 10x - 8 = 4x + 46. Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 9 }],
        explanation: "10x - 8 = 4x + 46 → 6x = 54 → x = 9.",
      },
    },
  },
  {
    slug: "math-g9-l09-slope-from-two-points",
    grade: 9,
    lessonNumber: 9,
    title: "Slope from Two Points — Rise Over Run",
    mathSkill: "Find the Slope Between Two Points (F-IF.B.6)",
    teaches: "Every slot gives two points on a line — find the rise (change in y) and the run (change in x), then build a crash cymbal row for the rise and a ride cymbal row for the run.",
    bpm: 130,
    challenges: {
      A: {
        prompt: "A line passes through (1, 2) and (5, 10). What is the rise (change in y)? What is the run (change in x)? Build a crash cymbal row with the rise in quarter notes and a ride cymbal row with the run in quarter notes.",
        targets: [
          { instrument: "crash", count: 8 },
          { instrument: "ride", count: 4 },
        ],
        explanation: "Rise = 10 - 2 = 8. Run = 5 - 1 = 4. Slope = rise ÷ run = 8 ÷ 4 = 2.",
      },
      B: {
        prompt: "A line passes through (0, 1) and (3, 7). What is the rise (change in y)? What is the run (change in x)? Build a crash cymbal row with the rise in quarter notes and a ride cymbal row with the run in quarter notes.",
        targets: [
          { instrument: "crash", count: 6 },
          { instrument: "ride", count: 3 },
        ],
        explanation: "Rise = 7 - 1 = 6. Run = 3 - 0 = 3. Slope = rise ÷ run = 6 ÷ 3 = 2.",
      },
      C: {
        prompt: "A line passes through (1, 4) and (9, 12). What is the rise (change in y)? What is the run (change in x)? Build a crash cymbal row with the rise in quarter notes and a ride cymbal row with the run in quarter notes.",
        targets: [
          { instrument: "crash", count: 8 },
          { instrument: "ride", count: 8 },
        ],
        explanation: "Rise = 12 - 4 = 8. Run = 9 - 1 = 8. Slope = rise ÷ run = 8 ÷ 8 = 1.",
      },
      D: {
        prompt: "A line passes through (2, 2) and (5, 11). What is the rise (change in y)? What is the run (change in x)? Build a crash cymbal row with the rise in quarter notes and a ride cymbal row with the run in quarter notes.",
        targets: [
          { instrument: "crash", count: 9 },
          { instrument: "ride", count: 3 },
        ],
        explanation: "Rise = 11 - 2 = 9. Run = 5 - 2 = 3. Slope = rise ÷ run = 9 ÷ 3 = 3.",
      },
    },
  },
  {
    slug: "math-g9-l10-slope-intercept-form",
    grade: 9,
    lessonNumber: 10,
    title: "Slope-Intercept Form — Graphing Lines",
    mathSkill: "Use Slope-Intercept Form to Find Points on a Line (F-IF.C.7a)",
    teaches: "Every slot gives a line as y = mx + b and an x-value — plug it in and work it out, then build the resulting y-value anywhere in the kit.",
    bpm: 130,
    challenges: {
      A: {
        prompt: "A line is y = 2x + 3. What is y when x = 5? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 13 }],
        explanation: "y = 2(5) + 3 = 10 + 3 = 13.",
      },
      B: {
        prompt: "A line is y = 3x - 1. What is y when x = 6? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 17 }],
        explanation: "y = 3(6) - 1 = 18 - 1 = 17.",
      },
      C: {
        prompt: "A line is y = 4x + 2. What is y when x = 4? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 18 }],
        explanation: "y = 4(4) + 2 = 16 + 2 = 18.",
      },
      D: {
        prompt: "A line is y = 5x - 3. What is y when x = 5? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 22 }],
        explanation: "y = 5(5) - 3 = 25 - 3 = 22.",
      },
    },
  },
  {
    slug: "math-g9-l11-writing-an-equation-of-a-line",
    grade: 9,
    lessonNumber: 11,
    title: "Writing an Equation of a Line from Two Points",
    mathSkill: "Write a Linear Equation Given Slope and a Point (A-CED.A.2)",
    teaches: "Every slot gives a slope and a point the line passes through — use b = y - mx to find the y-intercept, then build that many notes anywhere in the kit.",
    bpm: 130,
    challenges: {
      A: {
        prompt: "A line has slope 3 and passes through the point (2, 11). What is the y-intercept b (using b = y - mx)? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 5 }],
        explanation: "b = y - mx = 11 - 3(2) = 11 - 6 = 5.",
      },
      B: {
        prompt: "A line has slope 2 and passes through the point (4, 15). What is the y-intercept b (using b = y - mx)? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 7 }],
        explanation: "b = y - mx = 15 - 2(4) = 15 - 8 = 7.",
      },
      C: {
        prompt: "A line has slope 4 and passes through the point (3, 20). What is the y-intercept b (using b = y - mx)? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 8 }],
        explanation: "b = y - mx = 20 - 4(3) = 20 - 12 = 8.",
      },
      D: {
        prompt: "A line has slope 5 and passes through the point (2, 16). What is the y-intercept b (using b = y - mx)? Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 6 }],
        explanation: "b = y - mx = 16 - 5(2) = 16 - 10 = 6.",
      },
    },
  },
  {
    slug: "math-g9-l12-linear-inequalities-in-one-variable",
    grade: 9,
    lessonNumber: 12,
    title: "Linear Inequalities in One Variable",
    mathSkill: "Solve One-Variable Linear Inequalities (A-REI.B.3)",
    teaches: "Every slot is an inequality — solve it like an equation to find the boundary value, then build a row that lands on the correct side of that boundary.",
    bpm: 130,
    challenges: {
      A: {
        prompt: "Solve for x: x + 4 > 10. Build a snare drum row with MORE quarter notes than the boundary value, showing a number that satisfies the inequality.",
        targets: [{ instrument: "snare", count: 6, comparison: "gt" }],
        explanation: "x + 4 > 10 → x > 6. Any count of 7 or more satisfies it.",
      },
      B: {
        prompt: "Solve for x: 2x < 18. Build a hi-hat row with FEWER quarter notes than the boundary value, showing a number that satisfies the inequality.",
        targets: [{ instrument: "hihatClosed", count: 9, comparison: "lt" }],
        explanation: "2x < 18 → x < 9. Any count of 8 or fewer satisfies it.",
      },
      C: {
        prompt: "Solve for x: x - 3 > 5. Build a bass drum row with MORE quarter notes than the boundary value, showing a number that satisfies the inequality.",
        targets: [{ instrument: "kick", count: 8, comparison: "gt" }],
        explanation: "x - 3 > 5 → x > 8. Any count of 9 or more satisfies it.",
      },
      D: {
        prompt: "Solve for x: 3x < 21. Build a snare drum row with FEWER quarter notes than the boundary value, showing a number that satisfies the inequality.",
        targets: [{ instrument: "snare", count: 7, comparison: "lt" }],
        explanation: "3x < 21 → x < 7. Any count of 6 or fewer satisfies it.",
      },
    },
  },
  {
    slug: "math-g9-l13-compound-inequalities",
    grade: 9,
    lessonNumber: 13,
    title: "Compound Inequalities",
    mathSkill: "Solve and Represent Compound Inequalities (A-REI.B.3)",
    teaches: "Every slot is a compound inequality with two boundaries — build a snare row above the lower one and a hi-hat row below the upper one, together showing a value between them.",
    bpm: 130,
    challenges: {
      A: {
        prompt: "Solve the compound inequality: 5 < x < 12. Build a snare row with MORE than 5 quarter notes AND a hi-hat row with FEWER than 12 quarter notes, together showing a value of x between them.",
        targets: [
          { instrument: "snare", count: 5, comparison: "gt" },
          { instrument: "hihatClosed", count: 12, comparison: "lt" },
        ],
        explanation: "x must be greater than 5 and less than 12 — any snare count above 5 and hi-hat count below 12 shows a value in that range.",
      },
      B: {
        prompt: "Solve the compound inequality: 3 < x < 10. Build a snare row with MORE than 3 quarter notes AND a hi-hat row with FEWER than 10 quarter notes, together showing a value of x between them.",
        targets: [
          { instrument: "snare", count: 3, comparison: "gt" },
          { instrument: "hihatClosed", count: 10, comparison: "lt" },
        ],
        explanation: "x must be greater than 3 and less than 10 — any snare count above 3 and hi-hat count below 10 shows a value in that range.",
      },
      C: {
        prompt: "Solve the compound inequality: 7 < x < 15. Build a snare row with MORE than 7 quarter notes AND a hi-hat row with FEWER than 15 quarter notes, together showing a value of x between them.",
        targets: [
          { instrument: "snare", count: 7, comparison: "gt" },
          { instrument: "hihatClosed", count: 15, comparison: "lt" },
        ],
        explanation: "x must be greater than 7 and less than 15 — any snare count above 7 and hi-hat count below 15 shows a value in that range.",
      },
      D: {
        prompt: "Solve the compound inequality: 2 < x < 9. Build a snare row with MORE than 2 quarter notes AND a hi-hat row with FEWER than 9 quarter notes, together showing a value of x between them.",
        targets: [
          { instrument: "snare", count: 2, comparison: "gt" },
          { instrument: "hihatClosed", count: 9, comparison: "lt" },
        ],
        explanation: "x must be greater than 2 and less than 9 — any snare count above 2 and hi-hat count below 9 shows a value in that range.",
      },
    },
  },
  {
    slug: "math-g9-l14-systems-of-equations-by-graphing",
    grade: 9,
    lessonNumber: 14,
    title: "Systems of Equations by Graphing",
    mathSkill: "Solve Systems of Linear Equations Graphically (A-REI.C.6)",
    teaches: "Every slot gives two lines that cross at one point — set them equal to find where, then build the x-coordinate on the bass drum and the y-coordinate on the snare.",
    bpm: 132,
    challenges: {
      A: {
        prompt: "The graphs of y = x + 2 and y = -x + 8 cross at one point. Set x + 2 = -x + 8 to find x, then find y. Build a bass drum row with the x-coordinate and a snare row with the y-coordinate, in quarter notes.",
        targets: [
          { instrument: "kick", count: 3 },
          { instrument: "snare", count: 5 },
        ],
        explanation: "x + 2 = -x + 8 → 2x = 6 → x = 3. y = 3 + 2 = 5. The lines cross at (3, 5).",
      },
      B: {
        prompt: "The graphs of y = 2x + 1 and y = x + 5 cross at one point. Set 2x + 1 = x + 5 to find x, then find y. Build a bass drum row with the x-coordinate and a snare row with the y-coordinate, in quarter notes.",
        targets: [
          { instrument: "kick", count: 4 },
          { instrument: "snare", count: 9 },
        ],
        explanation: "2x + 1 = x + 5 → x = 4. y = 4 + 5 = 9. The lines cross at (4, 9).",
      },
      C: {
        prompt: "The graphs of y = 3x - 2 and y = x + 4 cross at one point. Set 3x - 2 = x + 4 to find x, then find y. Build a bass drum row with the x-coordinate and a snare row with the y-coordinate, in quarter notes.",
        targets: [
          { instrument: "kick", count: 3 },
          { instrument: "snare", count: 7 },
        ],
        explanation: "3x - 2 = x + 4 → 2x = 6 → x = 3. y = 3 + 4 = 7. The lines cross at (3, 7).",
      },
      D: {
        prompt: "The graphs of y = 2x - 1 and y = -x + 11 cross at one point. Set 2x - 1 = -x + 11 to find x, then find y. Build a bass drum row with the x-coordinate and a snare row with the y-coordinate, in quarter notes.",
        targets: [
          { instrument: "kick", count: 4 },
          { instrument: "snare", count: 7 },
        ],
        explanation: "2x - 1 = -x + 11 → 3x = 12 → x = 4. y = 2(4) - 1 = 7. The lines cross at (4, 7).",
      },
    },
  },
  {
    slug: "math-g9-l15-systems-of-equations-by-substitution",
    grade: 9,
    lessonNumber: 15,
    title: "Systems of Equations by Substitution",
    mathSkill: "Solve Systems of Linear Equations by Substitution (A-REI.C.6)",
    teaches: "Every slot gives a system where one equation is already solved for y — substitute it into the other equation to find x, then find y, and build x on the bass drum, y on the snare.",
    bpm: 132,
    challenges: {
      A: {
        prompt: "y = x + 4 and 2x + y = 16. Substitute the first equation into the second to solve for x, then find y. Build a bass drum row with the x-value and a snare row with the y-value, in quarter notes.",
        targets: [
          { instrument: "kick", count: 4 },
          { instrument: "snare", count: 8 },
        ],
        explanation: "2x + (x + 4) = 16 → 3x = 12 → x = 4. y = 4 + 4 = 8.",
      },
      B: {
        prompt: "y = x + 2 and 3x + y = 22. Substitute the first equation into the second to solve for x, then find y. Build a bass drum row with the x-value and a snare row with the y-value, in quarter notes.",
        targets: [
          { instrument: "kick", count: 5 },
          { instrument: "snare", count: 7 },
        ],
        explanation: "3x + (x + 2) = 22 → 4x = 20 → x = 5. y = 5 + 2 = 7.",
      },
      C: {
        prompt: "y = 2x + 1 and x + y = 16. Substitute the first equation into the second to solve for x, then find y. Build a bass drum row with the x-value and a snare row with the y-value, in quarter notes.",
        targets: [
          { instrument: "kick", count: 5 },
          { instrument: "snare", count: 11 },
        ],
        explanation: "x + (2x + 1) = 16 → 3x = 15 → x = 5. y = 2(5) + 1 = 11.",
      },
      D: {
        prompt: "y = x + 1 and 4x + y = 21. Substitute the first equation into the second to solve for x, then find y. Build a bass drum row with the x-value and a snare row with the y-value, in quarter notes.",
        targets: [
          { instrument: "kick", count: 4 },
          { instrument: "snare", count: 5 },
        ],
        explanation: "4x + (x + 1) = 21 → 5x = 20 → x = 4. y = 4 + 1 = 5.",
      },
    },
  },
  {
    slug: "math-g9-l16-systems-of-equations-by-elimination",
    grade: 9,
    lessonNumber: 16,
    title: "Systems of Equations by Elimination",
    mathSkill: "Solve Systems of Linear Equations by Elimination (A-REI.C.6)",
    teaches: "Every slot gives a system built to eliminate y when added — add the two equations to solve for x, then find y, and build x on the bass drum, y on the snare.",
    bpm: 132,
    challenges: {
      A: {
        prompt: "2x + y = 14 and x - y = 1. Add the two equations to eliminate y and solve for x, then find y. Build a bass drum row with the x-value and a snare row with the y-value, in quarter notes.",
        targets: [
          { instrument: "kick", count: 5 },
          { instrument: "snare", count: 4 },
        ],
        explanation: "(2x + y) + (x - y) = 14 + 1 → 3x = 15 → x = 5. y = 14 - 2(5) = 4.",
      },
      B: {
        prompt: "3x + y = 23 and x - y = 1. Add the two equations to eliminate y and solve for x, then find y. Build a bass drum row with the x-value and a snare row with the y-value, in quarter notes.",
        targets: [
          { instrument: "kick", count: 6 },
          { instrument: "snare", count: 5 },
        ],
        explanation: "(3x + y) + (x - y) = 23 + 1 → 4x = 24 → x = 6. y = 23 - 3(6) = 5.",
      },
      C: {
        prompt: "2x + y = 19 and x - y = 2. Add the two equations to eliminate y and solve for x, then find y. Build a bass drum row with the x-value and a snare row with the y-value, in quarter notes.",
        targets: [
          { instrument: "kick", count: 7 },
          { instrument: "snare", count: 5 },
        ],
        explanation: "(2x + y) + (x - y) = 19 + 2 → 3x = 21 → x = 7. y = 19 - 2(7) = 5.",
      },
      D: {
        prompt: "4x + y = 25 and x - y = 0. Add the two equations to eliminate y and solve for x, then find y. Build a bass drum row with the x-value and a snare row with the y-value, in quarter notes.",
        targets: [
          { instrument: "kick", count: 5 },
          { instrument: "snare", count: 5 },
        ],
        explanation: "(4x + y) + (x - y) = 25 + 0 → 5x = 25 → x = 5. y = 25 - 4(5) = 5.",
      },
    },
  },
  {
    slug: "math-g9-l17-properties-of-exponents",
    grade: 9,
    lessonNumber: 17,
    title: "Properties of Exponents",
    mathSkill: "Apply the Product and Power Rules for Exponents (A-SSE.A.2)",
    teaches: "Every slot simplifies a power expression using the product rule (add exponents) or the power rule (multiply exponents), then evaluates it — build that many notes anywhere in the kit.",
    bpm: 132,
    challenges: {
      A: {
        prompt: "Simplify 2³ × 2² using the product rule (add the exponents), then evaluate. Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 32 }],
        explanation: "2³ × 2² = 2⁵ = 32.",
      },
      B: {
        prompt: "Simplify 3² × 3¹ using the product rule (add the exponents), then evaluate. Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 27 }],
        explanation: "3² × 3¹ = 3³ = 27.",
      },
      C: {
        prompt: "Simplify (2²)³ using the power rule (multiply the exponents), then evaluate. Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 64 }],
        explanation: "(2²)³ = 2⁶ = 64.",
      },
      D: {
        prompt: "Simplify (3¹)⁴ using the power rule (multiply the exponents), then evaluate. Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 81 }],
        explanation: "(3¹)⁴ = 3⁴ = 81.",
      },
    },
  },
  {
    slug: "math-g9-l18-adding-and-subtracting-polynomials",
    grade: 9,
    lessonNumber: 18,
    title: "Adding and Subtracting Polynomials",
    mathSkill: "Add and Subtract Polynomials (A-APR.A.1)",
    teaches: "Every slot adds or subtracts two binomials — combine like terms, substitute the given x, then build that many notes anywhere in the kit.",
    bpm: 132,
    challenges: {
      A: {
        prompt: "Add (3x + 5) + (2x + 7), combine like terms, then evaluate the result when x = 4. Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 32 }],
        explanation: "(3x + 5) + (2x + 7) = 5x + 12. 5(4) + 12 = 20 + 12 = 32.",
      },
      B: {
        prompt: "Add (4x + 2) + (x + 9), combine like terms, then evaluate the result when x = 3. Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 26 }],
        explanation: "(4x + 2) + (x + 9) = 5x + 11. 5(3) + 11 = 15 + 11 = 26.",
      },
      C: {
        prompt: "Subtract (7x + 10) - (2x + 3), combine like terms, then evaluate the result when x = 5. Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 32 }],
        explanation: "(7x + 10) - (2x + 3) = 5x + 7. 5(5) + 7 = 25 + 7 = 32.",
      },
      D: {
        prompt: "Subtract (6x + 8) - (3x + 2), combine like terms, then evaluate the result when x = 6. Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 24 }],
        explanation: "(6x + 8) - (3x + 2) = 3x + 6. 3(6) + 6 = 18 + 6 = 24.",
      },
    },
  },
  {
    slug: "math-g9-l19-multiplying-binomials-foil",
    grade: 9,
    lessonNumber: 19,
    title: "Multiplying Binomials — FOIL",
    mathSkill: "Multiply Two Binomials (A-APR.A.1)",
    teaches: "Every slot multiplies two binomials with FOIL (First, Outer, Inner, Last) — combine like terms, substitute the given x, then build that many notes anywhere in the kit.",
    bpm: 132,
    challenges: {
      A: {
        prompt: "Multiply (x + 3)(x + 5) using FOIL, then evaluate the result when x = 2. Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 35 }],
        explanation: "(x + 3)(x + 5) = x² + 8x + 15. (2)² + 8(2) + 15 = 4 + 16 + 15 = 35.",
      },
      B: {
        prompt: "Multiply (x + 2)(x + 6) using FOIL, then evaluate the result when x = 3. Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 45 }],
        explanation: "(x + 2)(x + 6) = x² + 8x + 12. (3)² + 8(3) + 12 = 9 + 24 + 12 = 45.",
      },
      C: {
        prompt: "Multiply (x + 4)(x + 1) using FOIL, then evaluate the result when x = 4. Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 40 }],
        explanation: "(x + 4)(x + 1) = x² + 5x + 4. (4)² + 5(4) + 4 = 16 + 20 + 4 = 40.",
      },
      D: {
        prompt: "Multiply (x + 1)(x + 7) using FOIL, then evaluate the result when x = 2. Build a drum beat with that many notes in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 27 }],
        explanation: "(x + 1)(x + 7) = x² + 8x + 7. (2)² + 8(2) + 7 = 4 + 16 + 7 = 27.",
      },
    },
  },
  {
    slug: "math-g9-l20-factoring-trinomials",
    grade: 9,
    lessonNumber: 20,
    title: "Factoring Trinomials",
    mathSkill: "Factor Trinomials of the Form x² + bx + c (A-SSE.B.3a)",
    teaches: "Every slot is a trinomial to factor into two binomials — find the two numbers that multiply to c and add to b, then build the smaller one on the low tom and the larger one on the mid tom.",
    bpm: 134,
    challenges: {
      A: {
        prompt: "Factor x² + 9x + 20 into (x + a)(x + b) — find a and b, the two numbers that multiply to 20 and add to 9. Build a low tom row with the smaller number and a mid tom row with the larger number, in quarter notes.",
        targets: [
          { instrument: "lowTom", count: 4 },
          { instrument: "midTom", count: 5 },
        ],
        explanation: "4 × 5 = 20 and 4 + 5 = 9, so x² + 9x + 20 = (x + 4)(x + 5).",
      },
      B: {
        prompt: "Factor x² + 7x + 12 into (x + a)(x + b) — find a and b, the two numbers that multiply to 12 and add to 7. Build a low tom row with the smaller number and a mid tom row with the larger number, in quarter notes.",
        targets: [
          { instrument: "lowTom", count: 3 },
          { instrument: "midTom", count: 4 },
        ],
        explanation: "3 × 4 = 12 and 3 + 4 = 7, so x² + 7x + 12 = (x + 3)(x + 4).",
      },
      C: {
        prompt: "Factor x² + 11x + 18 into (x + a)(x + b) — find a and b, the two numbers that multiply to 18 and add to 11. Build a low tom row with the smaller number and a mid tom row with the larger number, in quarter notes.",
        targets: [
          { instrument: "lowTom", count: 2 },
          { instrument: "midTom", count: 9 },
        ],
        explanation: "2 × 9 = 18 and 2 + 9 = 11, so x² + 11x + 18 = (x + 2)(x + 9).",
      },
      D: {
        prompt: "Factor x² + 8x + 15 into (x + a)(x + b) — find a and b, the two numbers that multiply to 15 and add to 8. Build a low tom row with the smaller number and a mid tom row with the larger number, in quarter notes.",
        targets: [
          { instrument: "lowTom", count: 3 },
          { instrument: "midTom", count: 5 },
        ],
        explanation: "3 × 5 = 15 and 3 + 5 = 8, so x² + 8x + 15 = (x + 3)(x + 5).",
      },
    },
  },
  {
    slug: "math-g9-l21-solving-quadratics-by-factoring",
    grade: 9,
    lessonNumber: 21,
    title: "Solving Quadratic Equations by Factoring",
    mathSkill: "Solve Quadratic Equations by Factoring (A-REI.B.4b)",
    teaches: "Every slot is a quadratic that factors into two binomials — factor it, then read off the two roots, and build the smaller one on the high tom and the larger one on the rimshot.",
    bpm: 134,
    challenges: {
      A: {
        prompt: "Solve x² - 7x + 10 = 0 by factoring into (x - 2)(x - 5) = 0. What are the two roots? Build a high tom row with the smaller root and a rimshot row with the larger root, in quarter notes.",
        targets: [
          { instrument: "highTom", count: 2 },
          { instrument: "rimshot", count: 5 },
        ],
        explanation: "(x - 2)(x - 5) = 0 means x = 2 or x = 5.",
      },
      B: {
        prompt: "Solve x² - 9x + 18 = 0 by factoring into (x - 3)(x - 6) = 0. What are the two roots? Build a high tom row with the smaller root and a rimshot row with the larger root, in quarter notes.",
        targets: [
          { instrument: "highTom", count: 3 },
          { instrument: "rimshot", count: 6 },
        ],
        explanation: "(x - 3)(x - 6) = 0 means x = 3 or x = 6.",
      },
      C: {
        prompt: "Solve x² - 6x + 8 = 0 by factoring into (x - 2)(x - 4) = 0. What are the two roots? Build a high tom row with the smaller root and a rimshot row with the larger root, in quarter notes.",
        targets: [
          { instrument: "highTom", count: 2 },
          { instrument: "rimshot", count: 4 },
        ],
        explanation: "(x - 2)(x - 4) = 0 means x = 2 or x = 4.",
      },
      D: {
        prompt: "Solve x² - 10x + 21 = 0 by factoring into (x - 3)(x - 7) = 0. What are the two roots? Build a high tom row with the smaller root and a rimshot row with the larger root, in quarter notes.",
        targets: [
          { instrument: "highTom", count: 3 },
          { instrument: "rimshot", count: 7 },
        ],
        explanation: "(x - 3)(x - 7) = 0 means x = 3 or x = 7.",
      },
    },
  },
  {
    slug: "math-g9-l22-the-quadratic-formula",
    grade: 9,
    lessonNumber: 22,
    title: "The Quadratic Formula",
    mathSkill: "Solve Quadratic Equations Using the Quadratic Formula (A-REI.B.4a)",
    teaches: "Every slot solves x² + bx + c = 0 with the quadratic formula — work out the discriminant, take its square root, then build the larger root on the ride cymbal.",
    bpm: 134,
    challenges: {
      A: {
        prompt: "Use the quadratic formula to solve x² - 5x + 6 = 0. What is the larger root? Build a ride cymbal row with that many quarter notes.",
        targets: [{ instrument: "ride", count: 3 }],
        explanation: "x = (5 ± √(25 - 24)) ÷ 2 = (5 ± 1) ÷ 2 → x = 3 or x = 2. The larger root is 3.",
      },
      B: {
        prompt: "Use the quadratic formula to solve x² - 7x + 10 = 0. What is the larger root? Build a ride cymbal row with that many quarter notes.",
        targets: [{ instrument: "ride", count: 5 }],
        explanation: "x = (7 ± √(49 - 40)) ÷ 2 = (7 ± 3) ÷ 2 → x = 5 or x = 2. The larger root is 5.",
      },
      C: {
        prompt: "Use the quadratic formula to solve x² - 9x + 20 = 0. What is the larger root? Build a ride cymbal row with that many quarter notes.",
        targets: [{ instrument: "ride", count: 5 }],
        explanation: "x = (9 ± √(81 - 80)) ÷ 2 = (9 ± 1) ÷ 2 → x = 5 or x = 4. The larger root is 5.",
      },
      D: {
        prompt: "Use the quadratic formula to solve x² - 11x + 30 = 0. What is the larger root? Build a ride cymbal row with that many quarter notes.",
        targets: [{ instrument: "ride", count: 6 }],
        explanation: "x = (11 ± √(121 - 120)) ÷ 2 = (11 ± 1) ÷ 2 → x = 6 or x = 5. The larger root is 6.",
      },
    },
  },
  {
    slug: "math-g9-l23-arithmetic-sequences",
    grade: 9,
    lessonNumber: 23,
    title: "Arithmetic Sequences",
    mathSkill: "Find the nth Term of an Arithmetic Sequence (F-BF.A.2)",
    teaches: "Every slot gives a sequence that adds the same amount each time — find the requested term, then build it using exactly that many blocks, so the term's position becomes the beat's own time signature.",
    bpm: 136,
    challenges: {
      A: {
        prompt: "An arithmetic sequence starts at 3 and adds 4 each time: 3, 7, 11, 15, ... What is the 6th term? Build a drum beat using exactly 6 blocks that add up to the 6th term in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 23, blocksUsed: 6 }],
        explanation: "The 6th term is 3 + 5(4) = 23 — build it across exactly 6 blocks, one for each term up to the 6th.",
      },
      B: {
        prompt: "An arithmetic sequence starts at 2 and adds 5 each time: 2, 7, 12, 17, ... What is the 5th term? Build a drum beat using exactly 5 blocks that add up to the 5th term in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 22, blocksUsed: 5 }],
        explanation: "The 5th term is 2 + 4(5) = 22 — build it across exactly 5 blocks, one for each term up to the 5th.",
      },
      C: {
        prompt: "An arithmetic sequence starts at 4 and adds 6 each time: 4, 10, 16, 22, ... What is the 5th term? Build a drum beat using exactly 5 blocks that add up to the 5th term in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 28, blocksUsed: 5 }],
        explanation: "The 5th term is 4 + 4(6) = 28 — build it across exactly 5 blocks, one for each term up to the 5th.",
      },
      D: {
        prompt: "An arithmetic sequence starts at 1 and adds 7 each time: 1, 8, 15, 22, ... What is the 6th term? Build a drum beat using exactly 6 blocks that add up to the 6th term in all.",
        targets: [{ instrument: ANY_KIT_PIECE, count: 36, blocksUsed: 6 }],
        explanation: "The 6th term is 1 + 5(7) = 36 — build it across exactly 6 blocks, one for each term up to the 6th.",
      },
    },
  },
  {
    slug: "math-g9-l24-geometric-sequences-and-exponential-growth",
    grade: 9,
    lessonNumber: 24,
    title: "Geometric Sequences and Exponential Growth",
    mathSkill: "Find the nth Term of a Geometric Sequence (F-LE.A.1/A.2)",
    teaches: "Freshman year's last lesson: every slot is a sequence that doubles each time — find the requested term, then build it using exactly that many blocks on the crash cymbal for the big finish. This is a great one to drop into a Stack (the ‘…’ menu's Stacks link) and hear the growth repeat and build — or swap in any other kit piece you like.",
    bpm: 136,
    challenges: {
      A: {
        prompt: "A geometric sequence starts at 1 and doubles each time: 1, 2, 4, 8, 16, ... What is the 5th term? Build a crash cymbal beat using exactly 5 blocks that add up to the 5th term in all.",
        targets: [{ instrument: "crash", count: 16, blocksUsed: 5 }],
        explanation: "The 5th term is 1 × 2⁴ = 16 — build it across exactly 5 blocks, one for each term up to the 5th.",
      },
      B: {
        prompt: "A geometric sequence starts at 2 and doubles each time: 2, 4, 8, 16, ... What is the 4th term? Build a crash cymbal beat using exactly 4 blocks that add up to the 4th term in all.",
        targets: [{ instrument: "crash", count: 16, blocksUsed: 4 }],
        explanation: "The 4th term is 2 × 2³ = 16 — build it across exactly 4 blocks, one for each term up to the 4th.",
      },
      C: {
        prompt: "A geometric sequence starts at 1 and doubles each time: 1, 2, 4, 8, 16, 32, ... What is the 6th term? Build a crash cymbal beat using exactly 6 blocks that add up to the 6th term in all.",
        targets: [{ instrument: "crash", count: 32, blocksUsed: 6 }],
        explanation: "The 6th term is 1 × 2⁵ = 32 — build it across exactly 6 blocks, one for each term up to the 6th.",
      },
      D: {
        prompt: "A geometric sequence starts at 3 and doubles each time: 3, 6, 12, 24, ... What is the 4th term? Build a crash cymbal beat using exactly 4 blocks that add up to the 4th term in all.",
        targets: [{ instrument: "crash", count: 24, blocksUsed: 4 }],
        explanation: "The 4th term is 3 × 2³ = 24 — build it across exactly 4 blocks, one for each term up to the 4th.",
      },
    },
  },
];

export function mathLessonsForGrade(grade: number): MathLesson[] {
  return MATH_LESSONS.filter((l) => l.grade === grade);
}

// A slot still opens "blank" — no hits anywhere, nothing pre-built — but its
// starter lines now cover every instrument that slot's own challenge asks
// for, not just the Editor's normal three-piece starter (see
// DEFAULT_LINE_INSTRUMENTS in song.ts). Without this, a challenge reaching
// for a tom or a cymbal (which this Grade 2 batch does a lot more of, to
// bring more of the kit into the lessons) would leave the student stuck
// clicking "+ Add drum piece" one or more times before they could even
// start building their answer. Used by scripts/seedMathLessons.mts to build
// each lesson's slotA-D.
export function starterSlotForChallenge(bpm: number, challenge: MathChallenge): BoardSlotData {
  const instruments: InstrumentId[] = [...DEFAULT_LINE_INSTRUMENTS];
  for (const target of challenge.targets) {
    const targetInstruments = Array.isArray(target.instrument) ? target.instrument : [target.instrument];
    for (const instrument of targetInstruments) {
      if (!instruments.includes(instrument)) instruments.push(instrument);
    }
  }
  return {
    bpm,
    lines: instruments.map((instrument) => ({ instrument, blocks: Array(MAX_BEATS).fill(null) })),
  };
}

function mathStackStepId(slug: string, n: number): string {
  return `step-${slug}-${n}`;
}

// The shape every one of the 100 Drum School lessons converged on (6 groove
// steps, 2 fill/variation steps) — every RockBlocks Math lesson reuses it so
// a lesson's Stack isn't just "repeat A forever." Since every slot is blank
// until the student builds it, a fresh visitor's Stack plays back whatever
// they've answered so far (silence for anything not yet built). Shared by
// scripts/seedMathLessons.mts and the admin "create a lesson" API route so
// both paths produce the same default arrangement.
export function standardMathStack(slug: string, bpm: number): StackArrangement {
  const seq: SlotLetter[] = ["A", "A", "B", "A", "C", "A", "B", "D"];
  const steps: StackStep[] = seq.map((slot, i) => ({ id: mathStackStepId(slug, i + 1), slot }));
  return { bpm, steps, kitOverride: null };
}
