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
export interface BeatChallengeTarget {
  instrument: InstrumentId | InstrumentId[];
  count: number;
  comparison?: "eq" | "gt" | "lt";
}

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

// Kindergarten through Grade 2 exist today — index/list pages derive their
// grade sections from this, not a hardcoded grade string. Kindergarten is
// grade 0 (so it sorts first via asc(grade) everywhere) but is never shown
// as "Grade 0" — see gradeLabel below, which every page uses instead of
// interpolating `Grade ${grade}` directly.
export const MATH_GRADES: MathGrade[] = [
  { grade: 0, label: "Kindergarten" },
  { grade: 1, label: "Grade 1" },
  { grade: 2, label: "Grade 2" },
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
        prompt: "Which is bigger: 3 or 7? Build a bass drum row with the BIGGER number of quarter notes.",
        targets: [{ instrument: "kick", count: 7 }],
        explanation: "7 is bigger than 3, so you build 7 quarter notes.",
      },
      B: {
        prompt: "Which is bigger: 5 or 2? Build a snare drum row with the BIGGER number of quarter notes.",
        targets: [{ instrument: "snare", count: 5 }],
        explanation: "5 is bigger than 2, so you build 5 quarter notes.",
      },
      C: {
        prompt: "Which is bigger: 4 or 8? Build a hi-hat row with the BIGGER number of quarter notes.",
        targets: [{ instrument: "hihatClosed", count: 8 }],
        explanation: "8 is bigger than 4, so you build 8 quarter notes.",
      },
      D: {
        prompt: "Which is bigger: 6 or 1? Build a bass drum row with the BIGGER number of quarter notes.",
        targets: [{ instrument: "kick", count: 6 }],
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
        prompt: "Count in order: 1, 2, 3, __, 5. What number is missing? Build a snare drum row with that many quarter notes.",
        targets: [{ instrument: "snare", count: 4 }],
        explanation: "1, 2, 3, 4, 5 — the missing number is 4.",
      },
      B: {
        prompt: "Count in order: 4, 5, __, 7, 8. What number is missing? Build a bass drum row with that many quarter notes.",
        targets: [{ instrument: "kick", count: 6 }],
        explanation: "4, 5, 6, 7, 8 — the missing number is 6.",
      },
      C: {
        prompt: "Count in order: 6, 7, __, 9, 10. What number is missing? Build a hi-hat row with that many quarter notes.",
        targets: [{ instrument: "hihatClosed", count: 8 }],
        explanation: "6, 7, 8, 9, 10 — the missing number is 8.",
      },
      D: {
        prompt: "Count in order: 2, __, 4, 5, 6. What number is missing? Build a snare drum row with that many quarter notes.",
        targets: [{ instrument: "snare", count: 3 }],
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
        prompt: "Count backward from 5: 5, 4, 3. What number do you land on after 2 backward steps? Build a bass drum row with that many quarter notes.",
        targets: [{ instrument: "kick", count: 3 }],
        explanation: "5, 4, 3 — two steps back from 5 lands on 3.",
      },
      B: {
        prompt: "Count backward from 7: 7, 6, 5, 4. What number do you land on after 3 backward steps? Build a snare drum row with that many quarter notes.",
        targets: [{ instrument: "snare", count: 4 }],
        explanation: "7, 6, 5, 4 — three steps back from 7 lands on 4.",
      },
      C: {
        prompt: "Count backward from 10: 10, 9, 8. What number do you land on after 2 backward steps? Build a hi-hat row with that many quarter notes.",
        targets: [{ instrument: "hihatClosed", count: 8 }],
        explanation: "10, 9, 8 — two steps back from 10 lands on 8.",
      },
      D: {
        prompt: "Count backward from 6: 6, 5, 4, 3. What number do you land on after 3 backward steps? Build a bass drum row with that many quarter notes.",
        targets: [{ instrument: "kick", count: 3 }],
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
        prompt: "You have 2 crayons. A friend gives you 1 more. How many crayons do you have now? Build a bass drum row with that many quarter notes.",
        targets: [{ instrument: "kick", count: 3 }],
        explanation: "2 and 1 more makes 3.",
      },
      B: {
        prompt: "You have 3 stickers. A friend gives you 2 more. How many stickers do you have now? Build a snare drum row with that many quarter notes.",
        targets: [{ instrument: "snare", count: 5 }],
        explanation: "3 and 2 more makes 5.",
      },
      C: {
        prompt: "You have 4 blocks. A friend gives you 1 more. How many blocks do you have now? Build a hi-hat row with that many quarter notes.",
        targets: [{ instrument: "hihatClosed", count: 5 }],
        explanation: "4 and 1 more makes 5.",
      },
      D: {
        prompt: "You have 1 marble. A friend gives you 3 more. How many marbles do you have now? Build a bass drum row with that many quarter notes.",
        targets: [{ instrument: "kick", count: 4 }],
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
        prompt: "2 + 2 = ? Build a bass drum row with the total number of quarter notes.",
        targets: [{ instrument: "kick", count: 4 }],
        explanation: "2 + 2 = 4.",
      },
      B: {
        prompt: "1 + 3 = ? Build a snare drum row with the total number of quarter notes.",
        targets: [{ instrument: "snare", count: 4 }],
        explanation: "1 + 3 = 4.",
      },
      C: {
        prompt: "3 + 2 = ? Build a hi-hat row with the total number of quarter notes.",
        targets: [{ instrument: "hihatClosed", count: 5 }],
        explanation: "3 + 2 = 5.",
      },
      D: {
        prompt: "0 + 4 = ? Build a bass drum row with the total number of quarter notes.",
        targets: [{ instrument: "kick", count: 4 }],
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
        prompt: "4 - 1 = ? Build a snare drum row with what's left, in quarter notes.",
        targets: [{ instrument: "snare", count: 3 }],
        explanation: "4 - 1 = 3.",
      },
      B: {
        prompt: "5 - 2 = ? Build a bass drum row with what's left, in quarter notes.",
        targets: [{ instrument: "kick", count: 3 }],
        explanation: "5 - 2 = 3.",
      },
      C: {
        prompt: "3 - 1 = ? Build a hi-hat row with what's left, in quarter notes.",
        targets: [{ instrument: "hihatClosed", count: 2 }],
        explanation: "3 - 1 = 2.",
      },
      D: {
        prompt: "5 - 4 = ? Build a snare drum row with what's left, in quarter notes.",
        targets: [{ instrument: "snare", count: 1 }],
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
        prompt: "A drummer plays 5 quarter notes, then stops 3 of them. How many quarter notes are left? Build a bass drum row with what's left, in quarter notes.",
        targets: [{ instrument: "kick", count: 2 }],
        explanation: "5 - 3 = 2.",
      },
      B: {
        prompt: "A drummer plays 4 quarter notes, then stops 2 of them. How many quarter notes are left? Build a snare drum row with what's left, in quarter notes.",
        targets: [{ instrument: "snare", count: 2 }],
        explanation: "4 - 2 = 2.",
      },
      C: {
        prompt: "A drummer plays 5 quarter notes, then stops 1 of them. How many quarter notes are left? Build a hi-hat row with what's left, in quarter notes.",
        targets: [{ instrument: "hihatClosed", count: 4 }],
        explanation: "5 - 1 = 4.",
      },
      D: {
        prompt: "A drummer plays 3 quarter notes, then stops 2 of them. How many quarter notes are left? Build a bass drum row with what's left, in quarter notes.",
        targets: [{ instrument: "kick", count: 1 }],
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
        prompt: "8 - 5 = ? Build a snare drum row with what's left, in quarter notes.",
        targets: [{ instrument: "snare", count: 3 }],
        explanation: "8 - 5 = 3.",
      },
      B: {
        prompt: "9 - 4 = ? Build a bass drum row with what's left, in quarter notes.",
        targets: [{ instrument: "kick", count: 5 }],
        explanation: "9 - 4 = 5.",
      },
      C: {
        prompt: "7 - 3 = ? Build a hi-hat row with what's left, in quarter notes.",
        targets: [{ instrument: "hihatClosed", count: 4 }],
        explanation: "7 - 3 = 4.",
      },
      D: {
        prompt: "10 - 6 = ? Build a snare drum row with what's left, in quarter notes.",
        targets: [{ instrument: "snare", count: 4 }],
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
        prompt: "8 - 3 = ? Build a bass drum row with what's left, in quarter notes.",
        targets: [{ instrument: "kick", count: 5 }],
        explanation: "8 - 3 = 5.",
      },
      C: {
        prompt: "10 - 7 = ? Build a hi-hat row with what's left, in quarter notes.",
        targets: [{ instrument: "hihatClosed", count: 3 }],
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
        prompt: "Count by 10s: 10, 20, __, 40, 50. The missing number is how many tens? Build a bass drum row with that many quarter notes.",
        targets: [{ instrument: "kick", count: 3 }],
        explanation: "10, 20, 30, 40, 50 — the missing number is 30, which is 3 tens.",
      },
      B: {
        prompt: "Count by 10s: 10, __, 30, 40. The missing number is how many tens? Build a snare drum row with that many quarter notes.",
        targets: [{ instrument: "snare", count: 2 }],
        explanation: "10, 20, 30, 40 — the missing number is 20, which is 2 tens.",
      },
      C: {
        prompt: "Count by 10s: 20, 30, 40, __, 60. The missing number is how many tens? Build a hi-hat row with that many quarter notes.",
        targets: [{ instrument: "hihatClosed", count: 5 }],
        explanation: "20, 30, 40, 50, 60 — the missing number is 50, which is 5 tens.",
      },
      D: {
        prompt: "Count by 10s: __, 20, 30. The missing number is how many tens? Build a bass drum row with that many quarter notes.",
        targets: [{ instrument: "kick", count: 1 }],
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
        prompt: "9 - 4 = ? Build a snare drum row with what's left, in quarter notes.",
        targets: [{ instrument: "snare", count: 5 }],
        explanation: "9 - 4 = 5.",
      },
      B: {
        prompt: "8 - 6 = ? Build a bass drum row with what's left, in quarter notes.",
        targets: [{ instrument: "kick", count: 2 }],
        explanation: "8 - 6 = 2.",
      },
      C: {
        prompt: "10 - 3 = ? Build a hi-hat row with what's left, in quarter notes.",
        targets: [{ instrument: "hihatClosed", count: 7 }],
        explanation: "10 - 3 = 7.",
      },
      D: {
        prompt: "7 - 5 = ? Build a snare drum row with what's left, in quarter notes.",
        targets: [{ instrument: "snare", count: 2 }],
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
        prompt: "Count by 10s: 10, 20, 30, __, 50, 60, 70. The missing number is how many tens? Build a bass drum row with that many quarter notes.",
        targets: [{ instrument: "kick", count: 4 }],
        explanation: "10, 20, 30, 40, 50, 60, 70 — the missing number is 40, which is 4 tens.",
      },
      B: {
        prompt: "Count by 10s: 20, 30, __, 50, 60. The missing number is how many tens? Build a snare drum row with that many quarter notes.",
        targets: [{ instrument: "snare", count: 4 }],
        explanation: "20, 30, 40, 50, 60 — the missing number is 40, which is 4 tens.",
      },
      C: {
        prompt: "Count by 10s: 50, 60, 70, __, 90, 100. The missing number is how many tens? Build a hi-hat row with that many quarter notes.",
        targets: [{ instrument: "hihatClosed", count: 8 }],
        explanation: "50, 60, 70, 80, 90, 100 — the missing number is 80, which is 8 tens.",
      },
      D: {
        prompt: "Count by 10s: __, 20, 30, 40. The missing number is how many tens? Build a bass drum row with that many quarter notes.",
        targets: [{ instrument: "kick", count: 1 }],
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
        prompt: "14 - 7 = ? Build a bass drum row with what's left, in quarter notes.",
        targets: [{ instrument: "kick", count: 7 }],
        explanation: "14 - 7 = 7.",
      },
      B: {
        prompt: "16 - 9 = ? Build a snare drum row with what's left, in quarter notes.",
        targets: [{ instrument: "snare", count: 7 }],
        explanation: "16 - 9 = 7.",
      },
      C: {
        prompt: "13 - 5 = ? Build a hi-hat row with what's left, in quarter notes.",
        targets: [{ instrument: "hihatClosed", count: 8 }],
        explanation: "13 - 5 = 8.",
      },
      D: {
        prompt: "15 - 8 = ? Build a bass drum row with what's left, in quarter notes.",
        targets: [{ instrument: "kick", count: 7 }],
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
        prompt: "Compare 47 and 52. 52 has 5 tens, 47 has 4 tens. Build a bass drum row with MORE than 4 quarter notes, so your number's tens would beat 47's.",
        targets: [{ instrument: "kick", count: 4, comparison: "gt" }],
        explanation: "52 has more tens than 47 (5 vs. 4), so 52 is greater. 5 or more quarter notes here beats 47.",
      },
      B: {
        prompt: "Compare 63 and 58. 63 has 6 tens, 58 has 5 tens. Build a snare drum row with MORE than 5 quarter notes, so your number's tens would beat 58's.",
        targets: [{ instrument: "snare", count: 5, comparison: "gt" }],
        explanation: "63 has more tens than 58 (6 vs. 5), so 63 is greater. 6 or more quarter notes here beats 58.",
      },
      C: {
        prompt: "Compare 24 and 31. 31 has 3 tens, 24 has 2 tens. Build a hi-hat row with FEWER than 3 quarter notes, so your number's tens would lose to 31's.",
        targets: [{ instrument: "hihatClosed", count: 3, comparison: "lt" }],
        explanation: "24 has fewer tens than 31 (2 vs. 3), so 24 is less. 1 or 2 quarter notes here loses to 31.",
      },
      D: {
        prompt: "Compare 89 and 76. 89 has 8 tens, 76 has 7 tens. Build a bass drum row with MORE than 7 quarter notes, so your number's tens would beat 76's.",
        targets: [{ instrument: "kick", count: 7, comparison: "gt" }],
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
        prompt: "17 - 9 = ? (Hint: 17 - 7 gets you down to 10, then subtract what's left of the 9.) Build a bass drum row with what's left, in quarter notes.",
        targets: [{ instrument: "kick", count: 8 }],
        explanation: "17-9 = 17-7-2 = 10-2 = 8 — bridging down through 10 works for subtraction too.",
      },
      B: {
        prompt: "15 - 7 = ? (Hint: 15 - 5 gets you down to 10, then subtract what's left of the 7.) Build a snare drum row with what's left, in quarter notes.",
        targets: [{ instrument: "snare", count: 8 }],
        explanation: "15-7 = 15-5-2 = 10-2 = 8.",
      },
      C: {
        prompt: "13 - 6 = ? (Hint: 13 - 3 gets you down to 10, then subtract what's left of the 6.) Build a hi-hat row with what's left, in quarter notes.",
        targets: [{ instrument: "hihatClosed", count: 7 }],
        explanation: "13-6 = 13-3-3 = 10-3 = 7.",
      },
      D: {
        prompt: "16 - 8 = ? (Hint: 16 - 6 gets you down to 10, then subtract what's left of the 8.) Build a bass drum row with what's left, in quarter notes.",
        targets: [{ instrument: "kick", count: 8 }],
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
        prompt: "If you cut a pizza into 2 equal pieces, what do we call each piece, and how many pieces are there? Build a hi-hat row with that many quarter notes.",
        targets: [{ instrument: "hihatClosed", count: 2 }],
        explanation: "Splitting into 2 equal shares makes halves — 2 pieces.",
      },
      B: {
        prompt: "If you cut a sandwich into 2 equal pieces (halves), how many pieces are there? Build a snare drum row with that many quarter notes.",
        targets: [{ instrument: "snare", count: 2 }],
        explanation: "Halves means 2 equal pieces.",
      },
      C: {
        prompt: "If you cut a brownie into 2 equal pieces (halves), how many pieces are there? Build a bass drum row with that many quarter notes.",
        targets: [{ instrument: "kick", count: 2 }],
        explanation: "Halves means 2 equal pieces.",
      },
      D: {
        prompt: "If you cut a granola bar into 2 equal pieces (halves), how many pieces are there? Build a hi-hat row with that many quarter notes.",
        targets: [{ instrument: "hihatClosed", count: 2 }],
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
    teaches: "Every slot is a fast addition fact within 20 — since the total is often too big for one row, build a drum beat with the total spread across a couple of rows.",
    bpm: 86,
    challenges: {
      A: {
        prompt: "7 + 8 = ? Build a drum beat with the total number of quarter notes, spread across the bass and snare rows.",
        targets: [{ instrument: ["kick", "snare"], count: 15 }],
        explanation: "7 + 8 = 15.",
      },
      B: {
        prompt: "9 + 5 = ? Build a drum beat with the total number of quarter notes, spread across the snare and hi-hat rows.",
        targets: [{ instrument: ["snare", "hihatClosed"], count: 14 }],
        explanation: "9 + 5 = 14.",
      },
      C: {
        prompt: "8 + 8 = ? Build a drum beat with the total number of quarter notes, spread across the hi-hat and bass rows.",
        targets: [{ instrument: ["hihatClosed", "kick"], count: 16 }],
        explanation: "8 + 8 = 16.",
      },
      D: {
        prompt: "7 + 6 = ? Build a drum beat with the total number of quarter notes, spread across the bass and snare rows.",
        targets: [{ instrument: ["kick", "snare"], count: 13 }],
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
    teaches: "Every slot is a fast subtraction fact within 20 — build what's left in one row.",
    bpm: 86,
    challenges: {
      A: {
        prompt: "15 - 6 = ? Build a drum beat with what's left, spread across the snare and bass rows.",
        targets: [{ instrument: ["snare", "kick"], count: 9 }],
        explanation: "15 - 6 = 9.",
      },
      B: {
        prompt: "12 - 4 = ? Build a bass drum row with what's left, in quarter notes.",
        targets: [{ instrument: "kick", count: 8 }],
        explanation: "12 - 4 = 8.",
      },
      C: {
        prompt: "17 - 8 = ? Build a drum beat with what's left, spread across the hi-hat and snare rows.",
        targets: [{ instrument: ["hihatClosed", "snare"], count: 9 }],
        explanation: "17 - 8 = 9.",
      },
      D: {
        prompt: "11 - 3 = ? Build a snare drum row with what's left, in quarter notes.",
        targets: [{ instrument: "snare", count: 8 }],
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
    teaches: "Every slot is a counting-by-5s sequence with one number missing — build how many FIVES that missing number is, not the number itself.",
    bpm: 86,
    challenges: {
      A: {
        prompt: "Count by 5s: 5, 10, 15, __, 25, 30. The missing number is how many fives? Build a bass drum row with that many quarter notes.",
        targets: [{ instrument: "kick", count: 4 }],
        explanation: "5, 10, 15, 20, 25, 30 — the missing number is 20, which is 4 fives.",
      },
      B: {
        prompt: "Count by 5s: 5, 10, __, 20, 25. The missing number is how many fives? Build a snare drum row with that many quarter notes.",
        targets: [{ instrument: "snare", count: 3 }],
        explanation: "5, 10, 15, 20, 25 — the missing number is 15, which is 3 fives.",
      },
      C: {
        prompt: "Count by 5s: 15, 20, 25, __, 35. The missing number is how many fives? Build a hi-hat row with that many quarter notes.",
        targets: [{ instrument: "hihatClosed", count: 6 }],
        explanation: "15, 20, 25, 30, 35 — the missing number is 30, which is 6 fives.",
      },
      D: {
        prompt: "Count by 5s: __, 10, 15, 20. The missing number is how many fives? Build a bass drum row with that many quarter notes.",
        targets: [{ instrument: "kick", count: 1 }],
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
    teaches: "Every slot arranges equal rows of something — build a rimshot row of quarter notes for the number of rows, and a second row with the total, added the same amount over and over.",
    bpm: 88,
    challenges: {
      A: {
        prompt:
          "A teacher arranges 4 rows of chairs, with 3 chairs in each row. Build a rimshot row of quarter notes for the number of rows, and the total number of chairs (3+3+3+3) in quarter notes spread across the bass and snare rows.",
        targets: [
          { instrument: "rimshot", count: 4 },
          { instrument: ["kick", "snare"], count: 12 },
        ],
        explanation: "4 rows means 3 added 4 times: 3+3+3+3 = 12 — repeated addition is the start of multiplication.",
      },
      B: {
        prompt:
          "A drummer arranges 3 rows of cymbals, with 5 cymbals in each row. Build a rimshot row of quarter notes for the number of rows, and the total number of cymbals (5+5+5) in quarter notes spread across the crash and ride rows.",
        targets: [
          { instrument: "rimshot", count: 3 },
          { instrument: ["crash", "ride"], count: 15 },
        ],
        explanation: "3 rows means 5 added 3 times: 5+5+5 = 15.",
      },
      C: {
        prompt:
          "A gardener plants 2 rows of flowers, with 6 flowers in each row. Build a rimshot row of quarter notes for the number of rows, and the total number of flowers (6+6) in quarter notes spread across the snare and hi-hat rows.",
        targets: [
          { instrument: "rimshot", count: 2 },
          { instrument: ["snare", "hihatClosed"], count: 12 },
        ],
        explanation: "2 rows means 6 added 2 times: 6+6 = 12.",
      },
      D: {
        prompt:
          "A drummer arranges 5 rows of tambourines, with 3 tambourines in each row. Build a rimshot row of quarter notes for the number of rows, and the total number of tambourines (3+3+3+3+3) in quarter notes spread across the ride and crash rows.",
        targets: [
          { instrument: "rimshot", count: 5 },
          { instrument: ["ride", "crash"], count: 15 },
        ],
        explanation: "5 rows means 3 added 5 times: 3+3+3+3+3 = 15.",
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
    teaches: "Every slot gives you two numbers with the same hundreds digit — since the hundreds tie, the tens digit decides which is bigger.",
    bpm: 88,
    challenges: {
      A: {
        prompt: "Compare 342 and 324. Both have 3 hundreds, so the tens decide: 342 has 4 tens, 324 has 2 tens. Build a bass drum row with MORE than 2 quarter notes, so your number's tens would beat 324's.",
        targets: [{ instrument: "kick", count: 2, comparison: "gt" }],
        explanation: "342 has more tens than 324 (4 vs. 2), so 342 is greater.",
      },
      B: {
        prompt: "Compare 521 and 567. Both have 5 hundreds, so the tens decide: 567 has 6 tens, 521 has 2 tens. Build a snare drum row with FEWER than 6 quarter notes, so your number's tens would lose to 567's.",
        targets: [{ instrument: "snare", count: 6, comparison: "lt" }],
        explanation: "521 has fewer tens than 567 (2 vs. 6), so 521 is less.",
      },
      C: {
        prompt: "Compare 418 and 463. Both have 4 hundreds, so the tens decide: 463 has 6 tens, 418 has 1 ten. Build a hi-hat row with MORE than 1 quarter note, so your number's tens would beat 418's.",
        targets: [{ instrument: "hihatClosed", count: 1, comparison: "gt" }],
        explanation: "463 has more tens than 418 (6 vs. 1), so 463 is greater.",
      },
      D: {
        prompt: "Compare 732 and 719. Both have 7 hundreds, so the tens decide: 732 has 3 tens, 719 has 1 ten. Build a bass drum row with FEWER than 3 quarter notes, so your number's tens would lose to 732's.",
        targets: [{ instrument: "kick", count: 3, comparison: "lt" }],
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
    teaches: "Every slot is a counting-by-100s sequence with one number missing — build how many HUNDREDS that missing number is.",
    bpm: 90,
    challenges: {
      A: {
        prompt: "Count by 100s: 100, 200, __, 400, 500. The missing number is how many hundreds? Build a bass drum row with that many quarter notes.",
        targets: [{ instrument: "kick", count: 3 }],
        explanation: "100, 200, 300, 400, 500 — the missing number is 300, which is 3 hundreds.",
      },
      B: {
        prompt: "Count by 100s: 200, 300, __, 500, 600. The missing number is how many hundreds? Build a snare drum row with that many quarter notes.",
        targets: [{ instrument: "snare", count: 4 }],
        explanation: "200, 300, 400, 500, 600 — the missing number is 400, which is 4 hundreds.",
      },
      C: {
        prompt: "Count by 100s: 400, 500, __, 700, 800. The missing number is how many hundreds? Build a hi-hat row with that many quarter notes.",
        targets: [{ instrument: "hihatClosed", count: 6 }],
        explanation: "400, 500, 600, 700, 800 — the missing number is 600, which is 6 hundreds.",
      },
      D: {
        prompt: "Count by 100s: __, 200, 300. The missing number is how many hundreds? Build a bass drum row with that many quarter notes.",
        targets: [{ instrument: "kick", count: 1 }],
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
    teaches: "Every slot splits something into 3 equal shares — thirds are always 3 pieces, no matter what you split.",
    bpm: 90,
    challenges: {
      A: {
        prompt: "If you divide a rectangle into 3 equal parts, what do we call each part, and how many parts are there? Build a hi-hat row with that many quarter notes.",
        targets: [{ instrument: "hihatClosed", count: 3 }],
        explanation: "Splitting into 3 equal shares makes thirds — 3 pieces.",
      },
      B: {
        prompt: "If you divide a chocolate bar into 3 equal parts (thirds), how many parts are there? Build a bass drum row with that many quarter notes.",
        targets: [{ instrument: "kick", count: 3 }],
        explanation: "Thirds means 3 equal parts.",
      },
      C: {
        prompt: "If you divide a garden bed into 3 equal parts (thirds), how many parts are there? Build a snare drum row with that many quarter notes.",
        targets: [{ instrument: "snare", count: 3 }],
        explanation: "Thirds means 3 equal parts.",
      },
      D: {
        prompt: "If you divide a ribbon into 3 equal parts (thirds), how many parts are there? Build a hi-hat row with that many quarter notes.",
        targets: [{ instrument: "hihatClosed", count: 3 }],
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
