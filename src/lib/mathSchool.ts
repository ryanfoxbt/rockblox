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
// Weighted to match how Grade 1 Common Core actually distributes: 14 of its
// 21 standards are addition/subtraction/place value (1.OA has 8, 1.NBT has
// 6), with only 7 across measurement, data, and geometry combined — so this
// curriculum spends most of its lessons there too, rather than treating
// counting and shapes as equal to addition fluency. Multiplication and
// division aren't Grade 1 standards (they're Grade 3) and are deliberately
// left out of this batch rather than force-fit in as a rushed preview.
// Difficulty still climbs stepwise lesson to lesson: put-together/take-from
// addition and subtraction first, then the fluency strategies that make
// facts within 20 fast (doubles, making 10, bridging through 10), then
// place value, then measurement/data/geometry.
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

// One instrument a slot's answer has to reach a specific hit count on —
// graded by counting actual placed hits, not beat blocks, since a single
// tile can hold more than one hit. `comparison` defaults to "eq"; "gt"/"lt"
// cover the handful of lessons that are fundamentally about which of two
// numbers is bigger rather than an exact total. (A count of 0 never
// satisfies any comparison, "lt" included — see targetMet in
// MathLessonWorkspace.tsx — so an untouched row can never pass by accident.)
export interface BeatChallengeTarget {
  instrument: InstrumentId;
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

// Grades 1-2 exist today; more append here as they're written — index/list
// pages derive their grade sections from this, not a hardcoded grade string.
export const MATH_GRADES: MathGrade[] = [
  { grade: 1, label: "Grade 1" },
  { grade: 2, label: "Grade 2" },
];

export const MATH_LESSONS: MathLesson[] = [
  // --- Addition & Subtraction Foundations (1.OA.A/B) -----------------------
  {
    slug: "math-g1-l01-addition-put-together",
    grade: 1,
    lessonNumber: 1,
    title: "Addition Word Problems: Put Together",
    mathSkill: "Addition Word Problems (1.OA.A.1)",
    teaches:
      "Every slot is its own word problem — read it, then build the answer directly in the beat blocks. All four slots practice the same idea (putting two groups together) with different numbers and instruments.",
    bpm: 78,
    challenges: {
      A: {
        prompt:
          "A drummer plays 3 quarter notes on the bass drum, then a friend joins in right after with 4 more. How many bass drum quarter notes are there in all? Build the bass drum row with that many hits.",
        targets: [{ instrument: "kick", count: 7 }],
        explanation: "3 + 4 = 7 — putting two groups together is addition.",
      },
      B: {
        prompt:
          "A drummer plays 2 quarter notes on the snare drum, then a friend joins in right after with 4 more. How many snare drum quarter notes are there in all? Build the snare drum row with that many hits.",
        targets: [{ instrument: "snare", count: 6 }],
        explanation: "2 + 4 = 6 — putting two groups together is addition.",
      },
      C: {
        prompt:
          "A drummer plays 5 quarter notes on the hi-hat, then a friend joins in right after with 3 more. How many hi-hat quarter notes are there in all? Build the hi-hat row with that many hits.",
        targets: [{ instrument: "hihatClosed", count: 8 }],
        explanation: "5 + 3 = 8 — putting two groups together is addition.",
      },
      D: {
        prompt:
          "A drummer plays 4 quarter notes on the bass drum, then a friend joins in right after with 3 more. How many bass drum quarter notes are there in all? Build the bass drum row with that many hits.",
        targets: [{ instrument: "kick", count: 7 }],
        explanation: "4 + 3 = 7 — the same two numbers as Slot A, just flipped, still add up to 7.",
      },
    },
  },
  {
    slug: "math-g1-l02-subtraction-take-from",
    grade: 1,
    lessonNumber: 2,
    title: "Subtraction Word Problems: Take From",
    mathSkill: "Subtraction Word Problems (1.OA.A.1)",
    teaches:
      "Every slot is its own word problem — a starting group of quarter notes, minus a few taken away. Build only what's left, in the beat blocks, one instrument at a time.",
    bpm: 78,
    challenges: {
      A: {
        prompt:
          "A drummer plays 8 quarter notes on the snare drum. 3 of them get taken away. How many snare drum quarter notes are left? Build the snare drum row with that many hits.",
        targets: [{ instrument: "snare", count: 5 }],
        explanation: "8 - 3 = 5 — taking hits away is subtraction.",
      },
      B: {
        prompt:
          "A drummer plays 6 quarter notes on the bass drum. 2 of them get taken away. How many bass drum quarter notes are left? Build the bass drum row with that many hits.",
        targets: [{ instrument: "kick", count: 4 }],
        explanation: "6 - 2 = 4 — taking hits away is subtraction.",
      },
      C: {
        prompt:
          "A drummer plays 7 quarter notes on the hi-hat. 4 of them get taken away. How many hi-hat quarter notes are left? Build the hi-hat row with that many hits.",
        targets: [{ instrument: "hihatClosed", count: 3 }],
        explanation: "7 - 4 = 3 — taking hits away is subtraction.",
      },
      D: {
        prompt:
          "A drummer plays 5 quarter notes on the snare drum. 1 of them gets taken away. How many snare drum quarter notes are left? Build the snare drum row with that many hits.",
        targets: [{ instrument: "snare", count: 4 }],
        explanation: "5 - 1 = 4 — taking hits away is subtraction.",
      },
    },
  },
  {
    slug: "math-g1-l03-comparing-how-many-more",
    grade: 1,
    lessonNumber: 3,
    title: "Comparison Problems: How Many More?",
    mathSkill: "Comparison Word Problems (1.OA.A.1)",
    teaches:
      "Every slot describes two imaginary groups of quarter notes without building them — your job is to find the difference and build only that, on a third instrument, so the answer is never mixed up with the numbers in the question.",
    bpm: 80,
    challenges: {
      A: {
        prompt:
          "Imagine the bass drum plays 6 quarter notes and the snare drum plays 2 quarter notes. How many more bass drum quarter notes are there than snare drum quarter notes? Build a hi-hat row with exactly that many hits.",
        targets: [{ instrument: "hihatClosed", count: 4 }],
        explanation: "6 - 2 = 4 more — comparing finds the difference between two groups.",
      },
      B: {
        prompt:
          "Imagine the snare drum plays 5 quarter notes and the bass drum plays 3 quarter notes. How many more snare drum quarter notes are there than bass drum quarter notes? Build a hi-hat row with exactly that many hits.",
        targets: [{ instrument: "hihatClosed", count: 2 }],
        explanation: "5 - 3 = 2 more — comparing finds the difference between two groups.",
      },
      C: {
        prompt:
          "Imagine the hi-hat plays 7 quarter notes and the bass drum plays 4 quarter notes. How many more hi-hat quarter notes are there than bass drum quarter notes? Build a snare drum row with exactly that many hits.",
        targets: [{ instrument: "snare", count: 3 }],
        explanation: "7 - 4 = 3 more — comparing finds the difference between two groups.",
      },
      D: {
        prompt:
          "Imagine the bass drum plays 8 quarter notes and the hi-hat plays 5 quarter notes. How many more bass drum quarter notes are there than hi-hat quarter notes? Build a snare drum row with exactly that many hits.",
        targets: [{ instrument: "snare", count: 3 }],
        explanation: "8 - 5 = 3 more — comparing finds the difference between two groups.",
      },
    },
  },
  {
    slug: "math-g1-l04-adding-three-numbers",
    grade: 1,
    lessonNumber: 4,
    title: "Adding Three Numbers",
    mathSkill: "Adding Three Numbers (1.OA.A.2)",
    teaches:
      "Every slot is its own word problem — three groups joining one after another on the same instrument. Add them one at a time, in any order, and build the total.",
    bpm: 80,
    challenges: {
      A: {
        prompt:
          "A drummer plays 2 quarter notes on the snare drum. 2 more join in, then 3 more join in. How many snare drum quarter notes are there in all? Build the snare drum row with that many hits.",
        targets: [{ instrument: "snare", count: 7 }],
        explanation: "2 + 2 + 3 = 7 — you can add three numbers the same way you add two, one at a time.",
      },
      B: {
        prompt:
          "A drummer plays 1 quarter note on the bass drum. 3 more join in, then 2 more join in. How many bass drum quarter notes are there in all? Build the bass drum row with that many hits.",
        targets: [{ instrument: "kick", count: 6 }],
        explanation: "1 + 3 + 2 = 6 — add the numbers left to right, one at a time.",
      },
      C: {
        prompt:
          "A drummer plays 4 quarter notes on the hi-hat. 1 more joins in, then 3 more join in. How many hi-hat quarter notes are there in all? Build the hi-hat row with that many hits.",
        targets: [{ instrument: "hihatClosed", count: 8 }],
        explanation: "4 + 1 + 3 = 8 — three numbers, added one at a time.",
      },
      D: {
        prompt:
          "A drummer plays 3 quarter notes on the snare drum. 3 more join in, then 1 more joins in. How many snare drum quarter notes are there in all? Build the snare drum row with that many hits.",
        targets: [{ instrument: "snare", count: 7 }],
        explanation: "3 + 3 + 1 = 7 — same idea, different order.",
      },
    },
  },
  {
    slug: "math-g1-l05-flip-it-commutative-property",
    grade: 1,
    lessonNumber: 5,
    title: "Flip It! The Commutative Property",
    mathSkill: "Properties of Addition (1.OA.B.3)",
    teaches:
      "Every slot gives you two numbers to add — the point isn't which slot you're on, it's noticing the total never changes no matter which of the two numbers you start with.",
    bpm: 82,
    challenges: {
      A: {
        prompt: "3 and 5 add up the same no matter which order you add them. Build a bass drum row with their total.",
        targets: [{ instrument: "kick", count: 8 }],
        explanation: "3 + 5 = 8 and 5 + 3 = 8 — addition can be done in any order and the total stays the same, the commutative property.",
      },
      B: {
        prompt: "4 and 5 add up the same no matter which order you add them. Build a snare drum row with their total.",
        targets: [{ instrument: "snare", count: 9 }],
        explanation: "4 + 5 = 9 and 5 + 4 = 9 — the order never changes the total.",
      },
      C: {
        prompt: "2 and 5 add up the same no matter which order you add them. Build a hi-hat row with their total.",
        targets: [{ instrument: "hihatClosed", count: 7 }],
        explanation: "2 + 5 = 7 and 5 + 2 = 7 — the order never changes the total.",
      },
      D: {
        prompt: "2 and 4 add up the same no matter which order you add them. Build a bass drum row with their total.",
        targets: [{ instrument: "kick", count: 6 }],
        explanation: "2 + 4 = 6 and 4 + 2 = 6 — the commutative property, every time.",
      },
    },
  },
  {
    slug: "math-g1-l06-fact-families",
    grade: 1,
    lessonNumber: 6,
    title: "Fact Families",
    mathSkill: "Related Facts (1.OA.B.4)",
    teaches:
      "Every slot gives you a whole number split into two parts — build both parts, on two different instruments, to show the pair that makes up that fact family.",
    bpm: 82,
    challenges: {
      A: {
        prompt: "Build a bass drum row with 3 hits and a snare row with 4 hits — the two addends in the 3, 4, 7 fact family.",
        targets: [
          { instrument: "kick", count: 3 },
          { instrument: "snare", count: 4 },
        ],
        explanation: "3 and 4 are the fact family's two parts; together they make the whole, 7 (3+4=7, 4+3=7, 7-3=4, 7-4=3).",
      },
      B: {
        prompt: "Build a bass drum row with 2 hits and a snare row with 5 hits — the two addends in the 2, 5, 7 fact family.",
        targets: [
          { instrument: "kick", count: 2 },
          { instrument: "snare", count: 5 },
        ],
        explanation: "2 and 5 are the fact family's two parts; together they make the whole, 7 (2+5=7, 5+2=7, 7-2=5, 7-5=2).",
      },
      C: {
        prompt: "Build a bass drum row with 6 hits and a snare row with 2 hits — the two addends in the 6, 2, 8 fact family.",
        targets: [
          { instrument: "kick", count: 6 },
          { instrument: "snare", count: 2 },
        ],
        explanation: "6 and 2 are the fact family's two parts; together they make the whole, 8 (6+2=8, 2+6=8, 8-6=2, 8-2=6).",
      },
      D: {
        prompt: "Build a bass drum row with 3 hits and a snare row with 6 hits — the two addends in the 3, 6, 9 fact family.",
        targets: [
          { instrument: "kick", count: 3 },
          { instrument: "snare", count: 6 },
        ],
        explanation: "3 and 6 are the fact family's two parts; together they make the whole, 9 (3+6=9, 6+3=9, 9-3=6, 9-6=3).",
      },
    },
  },
  {
    slug: "math-g1-l07-doubles-facts",
    grade: 1,
    lessonNumber: 7,
    title: "Doubles Facts",
    mathSkill: "Doubles Facts (1.OA.C.6)",
    teaches: "Every slot asks for a double — the same number added to itself. Build the total in one row.",
    bpm: 84,
    challenges: {
      A: {
        prompt: "Double 4. Build a bass drum row with the total of 4 + 4.",
        targets: [{ instrument: "kick", count: 8 }],
        explanation: "A double adds a number to itself: 4 + 4 = 8.",
      },
      B: {
        prompt: "Double 3. Build a snare drum row with the total of 3 + 3.",
        targets: [{ instrument: "snare", count: 6 }],
        explanation: "3 + 3 = 6 — a double.",
      },
      C: {
        prompt: "Double 5. Build a hi-hat row with the total of 5 + 5.",
        targets: [{ instrument: "hihatClosed", count: 10 }],
        explanation: "5 + 5 = 10 — a double.",
      },
      D: {
        prompt: "Double 2. Build a bass drum row with the total of 2 + 2.",
        targets: [{ instrument: "kick", count: 4 }],
        explanation: "2 + 2 = 4 — a double.",
      },
    },
  },
  {
    slug: "math-g1-l08-doubles-plus-one",
    grade: 1,
    lessonNumber: 8,
    title: "Doubles Plus One",
    mathSkill: "Near Doubles (1.OA.C.6)",
    teaches:
      "Every slot reminds you of a double you already know, then asks for the fact just one more than it — reuse the double instead of starting the count over.",
    bpm: 84,
    challenges: {
      A: {
        prompt: "You know 4 + 4 = 8. Build a bass drum row with the total for 4 + 5 instead.",
        targets: [{ instrument: "kick", count: 9 }],
        explanation: "4+5 is one more than the double 4+4=8, so 4+5=9 — near-doubles reuse a fact you already know.",
      },
      B: {
        prompt: "You know 3 + 3 = 6. Build a snare drum row with the total for 3 + 4 instead.",
        targets: [{ instrument: "snare", count: 7 }],
        explanation: "3+4 is one more than the double 3+3=6, so 3+4=7.",
      },
      C: {
        prompt: "You know 5 + 5 = 10. Build a hi-hat row with the total for 5 + 6 instead.",
        targets: [{ instrument: "hihatClosed", count: 11 }],
        explanation: "5+6 is one more than the double 5+5=10, so 5+6=11.",
      },
      D: {
        prompt: "You know 2 + 2 = 4. Build a bass drum row with the total for 2 + 3 instead.",
        targets: [{ instrument: "kick", count: 5 }],
        explanation: "2+3 is one more than the double 2+2=4, so 2+3=5.",
      },
    },
  },
  // --- Fluency Strategies Within 20 (1.OA.C, 1.OA.D) ------------------------
  {
    slug: "math-g1-l09-counting-on",
    grade: 1,
    lessonNumber: 9,
    title: "Counting On",
    mathSkill: "Counting On (1.OA.C.5)",
    teaches: "Every slot gives you a starting number and asks you to count on a few more — land on the total and build that many hits.",
    bpm: 84,
    challenges: {
      A: {
        prompt: "Start at 6 and count on 3 more: 7, 8, 9. Build a bass drum row with as many hits as where you land.",
        targets: [{ instrument: "kick", count: 9 }],
        explanation: "Counting on from 6 three more times — 7, 8, 9 — lands on 9, the same answer as 6+3.",
      },
      B: {
        prompt: "Start at 8 and count on 2 more: 9, 10. Build a snare drum row with as many hits as where you land.",
        targets: [{ instrument: "snare", count: 10 }],
        explanation: "Counting on from 8 two more times — 9, 10 — lands on 10, the same answer as 8+2.",
      },
      C: {
        prompt: "Start at 5 and count on 4 more: 6, 7, 8, 9. Build a hi-hat row with as many hits as where you land.",
        targets: [{ instrument: "hihatClosed", count: 9 }],
        explanation: "Counting on from 5 four more times lands on 9, the same answer as 5+4.",
      },
      D: {
        prompt: "Start at 7 and count on 3 more: 8, 9, 10. Build a bass drum row with as many hits as where you land.",
        targets: [{ instrument: "kick", count: 10 }],
        explanation: "Counting on from 7 three more times lands on 10, the same answer as 7+3.",
      },
    },
  },
  {
    slug: "math-g1-l10-making-ten",
    grade: 1,
    lessonNumber: 10,
    title: "Making 10",
    mathSkill: "Making 10 (1.OA.C.6)",
    teaches:
      "Every slot asks a different question with the same answer: what goes with this number to make 10? Build the total of 10 every time, however you split it.",
    bpm: 84,
    challenges: {
      A: {
        prompt: "6 and how many more make 10? Build a bass drum row with the total of 10.",
        targets: [{ instrument: "kick", count: 10 }],
        explanation: "6 and 4 make 10 — one of the pairs you can build with your fingers.",
      },
      B: {
        prompt: "2 and how many more make 10? Build a snare drum row with the total of 10.",
        targets: [{ instrument: "snare", count: 10 }],
        explanation: "2 and 8 make 10.",
      },
      C: {
        prompt: "7 and how many more make 10? Build a hi-hat row with the total of 10.",
        targets: [{ instrument: "hihatClosed", count: 10 }],
        explanation: "7 and 3 make 10.",
      },
      D: {
        prompt: "9 and how many more make 10? Build a bass drum row with the total of 10.",
        targets: [{ instrument: "kick", count: 10 }],
        explanation: "9 and 1 make 10.",
      },
    },
  },
  {
    slug: "math-g1-l11-bridging-through-ten-add",
    grade: 1,
    lessonNumber: 11,
    title: "Bridging Through 10 to Add",
    mathSkill: "Add Within 20 (1.OA.C.6)",
    teaches:
      "Every slot is an addition fact just over 10 — bridge through an even ten first (an easier, smaller step), then add what's left, and build the full total.",
    bpm: 84,
    challenges: {
      A: {
        prompt: "8 + 6 = ? (Hint: 8 + 2 makes 10, then add what's left of the 6.) Build a bass drum row with the total.",
        targets: [{ instrument: "kick", count: 14 }],
        explanation: "8+6 = 8+2+4 = 10+4 = 14 — bridging through 10 turns a hard fact into two easy ones.",
      },
      B: {
        prompt: "7 + 5 = ? (Hint: 7 + 3 makes 10, then add what's left of the 5.) Build a snare drum row with the total.",
        targets: [{ instrument: "snare", count: 12 }],
        explanation: "7+5 = 7+3+2 = 10+2 = 12.",
      },
      C: {
        prompt: "9 + 4 = ? (Hint: 9 + 1 makes 10, then add what's left of the 4.) Build a hi-hat row with the total.",
        targets: [{ instrument: "hihatClosed", count: 13 }],
        explanation: "9+4 = 9+1+3 = 10+3 = 13.",
      },
      D: {
        prompt: "6 + 7 = ? (Hint: 6 + 4 makes 10, then add what's left of the 7.) Build a bass drum row with the total.",
        targets: [{ instrument: "kick", count: 13 }],
        explanation: "6+7 = 6+4+3 = 10+3 = 13.",
      },
    },
  },
  {
    slug: "math-g1-l12-bridging-through-ten-subtract",
    grade: 1,
    lessonNumber: 12,
    title: "Bridging Through 10 to Subtract",
    mathSkill: "Subtract Within 20 (1.OA.C.6)",
    teaches:
      "Every slot is a subtraction fact that dips below an even ten — bridge down to ten first, then subtract what's left, and build what remains.",
    bpm: 84,
    challenges: {
      A: {
        prompt: "13 - 4 = ? (Hint: 13 - 3 gets you down to 10, then subtract what's left of the 4.) Build a snare drum row with what's left.",
        targets: [{ instrument: "snare", count: 9 }],
        explanation: "13-4 = 13-3-1 = 10-1 = 9 — bridging down through 10 works for subtraction too.",
      },
      B: {
        prompt: "12 - 5 = ? (Hint: 12 - 2 gets you down to 10, then subtract what's left of the 5.) Build a bass drum row with what's left.",
        targets: [{ instrument: "kick", count: 7 }],
        explanation: "12-5 = 12-2-3 = 10-3 = 7.",
      },
      C: {
        prompt: "15 - 6 = ? (Hint: 15 - 5 gets you down to 10, then subtract what's left of the 6.) Build a hi-hat row with what's left.",
        targets: [{ instrument: "hihatClosed", count: 9 }],
        explanation: "15-6 = 15-5-1 = 10-1 = 9.",
      },
      D: {
        prompt: "11 - 3 = ? (Hint: 11 - 1 gets you down to 10, then subtract what's left of the 3.) Build a snare drum row with what's left.",
        targets: [{ instrument: "snare", count: 8 }],
        explanation: "11-3 = 11-1-2 = 10-2 = 8.",
      },
    },
  },
  {
    slug: "math-g1-l13-true-or-false-equal-sign",
    grade: 1,
    lessonNumber: 13,
    title: "True or False? The Equal Sign",
    mathSkill: "Meaning of the Equal Sign (1.OA.D.7)",
    teaches:
      "Every slot makes a claim about an addition fact — sometimes true, sometimes false. Your job is always the same: build the row with the real, correct total.",
    bpm: 84,
    challenges: {
      A: {
        prompt: "Someone claims 2 + 2 = 5. Build a bass drum row with the CORRECT total for 2 + 2.",
        targets: [{ instrument: "kick", count: 4 }],
        explanation: "2 + 2 = 4, not 5 — so the claim was false, and 4 is the real total.",
      },
      B: {
        prompt: "Someone claims 3 + 3 = 6. Build a snare drum row with the CORRECT total for 3 + 3.",
        targets: [{ instrument: "snare", count: 6 }],
        explanation: "3 + 3 = 6 — that claim was actually true.",
      },
      C: {
        prompt: "Someone claims 4 + 2 = 7. Build a hi-hat row with the CORRECT total for 4 + 2.",
        targets: [{ instrument: "hihatClosed", count: 6 }],
        explanation: "4 + 2 = 6, not 7 — so the claim was false, and 6 is the real total.",
      },
      D: {
        prompt: "Someone claims 5 + 1 = 6. Build a bass drum row with the CORRECT total for 5 + 1.",
        targets: [{ instrument: "kick", count: 6 }],
        explanation: "5 + 1 = 6 — that claim was actually true.",
      },
    },
  },
  {
    slug: "math-g1-l14-missing-number-mystery",
    grade: 1,
    lessonNumber: 14,
    title: "Missing Number Mystery",
    mathSkill: "Unknown Numbers in Equations (1.OA.D.8)",
    teaches:
      "Every slot hides a different number in the equation — sometimes the answer, sometimes the starting number. Figure out what's missing and build that many hits.",
    bpm: 84,
    challenges: {
      A: {
        prompt: "? - 3 = 4. Build a snare drum row with as many hits as the missing number.",
        targets: [{ instrument: "snare", count: 7 }],
        explanation: "7 - 3 = 4, so the missing number is 7 — the unknown can be the starting number, not just the answer.",
      },
      B: {
        prompt: "? - 2 = 5. Build a bass drum row with as many hits as the missing number.",
        targets: [{ instrument: "kick", count: 7 }],
        explanation: "7 - 2 = 5, so the missing number is 7.",
      },
      C: {
        prompt: "6 + ? = 9. Build a hi-hat row with as many hits as the missing number.",
        targets: [{ instrument: "hihatClosed", count: 3 }],
        explanation: "6 + 3 = 9, so the missing number is 3 — this time the unknown is the second addend.",
      },
      D: {
        prompt: "? + 4 = 9. Build a snare drum row with as many hits as the missing number.",
        targets: [{ instrument: "snare", count: 5 }],
        explanation: "5 + 4 = 9, so the missing number is 5 — the unknown can be the first addend too.",
      },
    },
  },
  // --- Place Value (1.NBT) ---------------------------------------------------
  {
    slug: "math-g1-l15-skip-counting-2s-5s",
    grade: 1,
    lessonNumber: 15,
    title: "Counting Patterns: Skip Counting by 2s & 5s",
    mathSkill: "Counting Patterns (1.NBT.A.1)",
    teaches:
      "Every slot asks how many equal jumps of 2 or 5 it takes to reach a number — skip count up to it and build the number of jumps, not the number itself.",
    bpm: 84,
    challenges: {
      A: {
        prompt: "20 is how many groups of 5? Build a bass drum row with that many hits.",
        targets: [{ instrument: "kick", count: 4 }],
        explanation: "5, 10, 15, 20 — that's 4 jumps of 5, so 20 has 4 groups of 5 in it.",
      },
      B: {
        prompt: "30 is how many groups of 5? Build a snare drum row with that many hits.",
        targets: [{ instrument: "snare", count: 6 }],
        explanation: "5, 10, 15, 20, 25, 30 — 6 jumps of 5.",
      },
      C: {
        prompt: "16 is how many groups of 2? Build a hi-hat row with that many hits.",
        targets: [{ instrument: "hihatClosed", count: 8 }],
        explanation: "2, 4, 6, 8, 10, 12, 14, 16 — 8 jumps of 2.",
      },
      D: {
        prompt: "12 is how many groups of 2? Build a bass drum row with that many hits.",
        targets: [{ instrument: "kick", count: 6 }],
        explanation: "2, 4, 6, 8, 10, 12 — 6 jumps of 2.",
      },
    },
  },
  {
    slug: "math-g1-l16-skip-counting-10s",
    grade: 1,
    lessonNumber: 16,
    title: "Skip Counting by 10s",
    mathSkill: "Counting by Tens (1.NBT.A.1)",
    teaches: "Every slot asks how many jumps of 10 it takes to reach a bigger number — skip count by tens and build the number of jumps.",
    bpm: 84,
    challenges: {
      A: {
        prompt: "40 is how many groups of 10? Build a bass drum row with that many hits.",
        targets: [{ instrument: "kick", count: 4 }],
        explanation: "10, 20, 30, 40 — that's 4 jumps of 10, so 40 has 4 tens in it.",
      },
      B: {
        prompt: "60 is how many groups of 10? Build a snare drum row with that many hits.",
        targets: [{ instrument: "snare", count: 6 }],
        explanation: "10, 20, 30, 40, 50, 60 — 6 jumps of 10.",
      },
      C: {
        prompt: "80 is how many groups of 10? Build a hi-hat row with that many hits.",
        targets: [{ instrument: "hihatClosed", count: 8 }],
        explanation: "10, 20, 30, 40, 50, 60, 70, 80 — 8 jumps of 10.",
      },
      D: {
        prompt: "50 is how many groups of 10? Build a bass drum row with that many hits.",
        targets: [{ instrument: "kick", count: 5 }],
        explanation: "10, 20, 30, 40, 50 — 5 jumps of 10.",
      },
    },
  },
  {
    slug: "math-g1-l17-place-value-tens-and-ones",
    grade: 1,
    lessonNumber: 17,
    title: "Place Value: Tens and Ones",
    mathSkill: "Place Value (1.NBT.B.2)",
    teaches: "Every slot gives you a two-digit number — build its tens on the bass drum and its ones on the hi-hat, the same two rows every time.",
    bpm: 86,
    challenges: {
      A: {
        prompt: "13 has 1 ten and 3 ones. Build a bass drum row for the tens and a hi-hat row for the ones.",
        targets: [
          { instrument: "kick", count: 1 },
          { instrument: "hihatClosed", count: 3 },
        ],
        explanation: "1 ten is 10, plus 3 ones is 13.",
      },
      B: {
        prompt: "24 has 2 tens and 4 ones. Build a bass drum row for the tens and a hi-hat row for the ones.",
        targets: [
          { instrument: "kick", count: 2 },
          { instrument: "hihatClosed", count: 4 },
        ],
        explanation: "2 tens is 20, plus 4 ones is 24.",
      },
      C: {
        prompt: "32 has 3 tens and 2 ones. Build a bass drum row for the tens and a hi-hat row for the ones.",
        targets: [
          { instrument: "kick", count: 3 },
          { instrument: "hihatClosed", count: 2 },
        ],
        explanation: "3 tens is 30, plus 2 ones is 32.",
      },
      D: {
        prompt: "41 has 4 tens and 1 one. Build a bass drum row for the tens and a hi-hat row for the ones.",
        targets: [
          { instrument: "kick", count: 4 },
          { instrument: "hihatClosed", count: 1 },
        ],
        explanation: "4 tens is 40, plus 1 one is 41.",
      },
    },
  },
  {
    slug: "math-g1-l18-ten-more-ten-less",
    grade: 1,
    lessonNumber: 18,
    title: "Ten More, Ten Less",
    mathSkill: "Ten More / Ten Less (1.NBT.C.5)",
    teaches: "Every slot gives you a two-digit number and asks for ten more or ten less — build the new tens and ones; only the tens ever change.",
    bpm: 86,
    challenges: {
      A: {
        prompt: "24 is 2 tens and 4 ones. Build the tens and ones rows for the number that's 10 MORE than 24.",
        targets: [
          { instrument: "kick", count: 3 },
          { instrument: "hihatClosed", count: 4 },
        ],
        explanation: "10 more than 24 is 34 — the tens go from 2 to 3, the ones stay at 4.",
      },
      B: {
        prompt: "26 is 2 tens and 6 ones. Build the tens and ones rows for the number that's 10 LESS than 26.",
        targets: [
          { instrument: "kick", count: 1 },
          { instrument: "hihatClosed", count: 6 },
        ],
        explanation: "10 less than 26 is 16 — the tens go from 2 to 1, the ones stay at 6.",
      },
      C: {
        prompt: "48 is 4 tens and 8 ones. Build the tens and ones rows for the number that's 10 MORE than 48.",
        targets: [
          { instrument: "kick", count: 5 },
          { instrument: "hihatClosed", count: 8 },
        ],
        explanation: "10 more than 48 is 58 — the tens go from 4 to 5, the ones stay at 8.",
      },
      D: {
        prompt: "33 is 3 tens and 3 ones. Build the tens and ones rows for the number that's 10 LESS than 33.",
        targets: [
          { instrument: "kick", count: 2 },
          { instrument: "hihatClosed", count: 3 },
        ],
        explanation: "10 less than 33 is 23 — the tens go from 3 to 2, the ones stay at 3.",
      },
    },
  },
  {
    slug: "math-g1-l19-comparing-two-digit-numbers",
    grade: 1,
    lessonNumber: 19,
    title: "Comparing Two-Digit Numbers",
    mathSkill: "Comparing Numbers (1.NBT.B.3)",
    teaches:
      "Every slot gives you a number by its tens digit and asks you to beat it, or lose to it — build a row with more, or fewer, hits than that many tens.",
    bpm: 86,
    challenges: {
      A: {
        prompt: "42 has 4 tens. Build a bass drum row with MORE than 4 hits, so your number would beat it.",
        targets: [{ instrument: "kick", count: 4, comparison: "gt" }],
        explanation: "42 has 4 tens. Any number with more tens than that — 5 or more hits here — is greater than 42.",
      },
      B: {
        prompt: "67 has 6 tens. Build a snare drum row with MORE than 6 hits, so your number would beat it.",
        targets: [{ instrument: "snare", count: 6, comparison: "gt" }],
        explanation: "67 has 6 tens. 7 or more hits here makes your number greater than 67.",
      },
      C: {
        prompt: "51 has 5 tens. Build a hi-hat row with MORE than 5 hits, so your number would beat it.",
        targets: [{ instrument: "hihatClosed", count: 5, comparison: "gt" }],
        explanation: "51 has 5 tens. 6 or more hits here makes your number greater than 51.",
      },
      D: {
        prompt: "38 has 3 tens. Build a bass drum row with FEWER than 3 hits, so your number would lose to it.",
        targets: [{ instrument: "kick", count: 3, comparison: "lt" }],
        explanation: "38 has 3 tens. 1 or 2 hits here makes your number less than 38.",
      },
    },
  },
  {
    slug: "math-g1-l20-adding-within-100",
    grade: 1,
    lessonNumber: 20,
    title: "Adding Within 100",
    mathSkill: "Add Within 100 (1.NBT.C.4)",
    teaches: "Every slot adds a small number onto a two-digit number — the tens never move, so just build the new ones total.",
    bpm: 86,
    challenges: {
      A: {
        prompt: "23 + 5 = ? The tens don't change — just add the ones. Build a hi-hat row with the new ones total.",
        targets: [{ instrument: "hihatClosed", count: 8 }],
        explanation: "The 2 tens stay put; just add the ones: 3 + 5 = 8, so 23 + 5 = 28.",
      },
      B: {
        prompt: "41 + 6 = ? The tens don't change — just add the ones. Build a hi-hat row with the new ones total.",
        targets: [{ instrument: "hihatClosed", count: 7 }],
        explanation: "The 4 tens stay put; just add the ones: 1 + 6 = 7, so 41 + 6 = 47.",
      },
      C: {
        prompt: "52 + 3 = ? The tens don't change — just add the ones. Build a hi-hat row with the new ones total.",
        targets: [{ instrument: "hihatClosed", count: 5 }],
        explanation: "The 5 tens stay put; just add the ones: 2 + 3 = 5, so 52 + 3 = 55.",
      },
      D: {
        prompt: "61 + 4 = ? The tens don't change — just add the ones. Build a hi-hat row with the new ones total.",
        targets: [{ instrument: "hihatClosed", count: 5 }],
        explanation: "The 6 tens stay put; just add the ones: 1 + 4 = 5, so 61 + 4 = 65.",
      },
    },
  },
  // --- Measurement, Data, Geometry (1.MD, 1.G) ------------------------------
  {
    slug: "math-g1-l21-measuring-length",
    grade: 1,
    lessonNumber: 21,
    title: "Measuring Length with Units",
    mathSkill: "Measuring Length (1.MD.A.2)",
    teaches: "Every slot measures the exact same length with a smaller unit — smaller units always need more of them, so build however many it takes.",
    bpm: 88,
    challenges: {
      A: {
        prompt:
          "A drum fill measures 4 big tom hits long. Using units half the size instead, build a low tom row with how many small units cover that same length.",
        targets: [{ instrument: "lowTom", count: 8 }],
        explanation: "Units half the size take twice as many to cover the same length: 4 x 2 = 8.",
      },
      B: {
        prompt:
          "A drum fill measures 3 big tom hits long. Using units half the size instead, build a low tom row with how many small units cover that same length.",
        targets: [{ instrument: "lowTom", count: 6 }],
        explanation: "3 x 2 = 6 small units cover the same length as 3 big ones.",
      },
      C: {
        prompt:
          "A drum fill measures 5 big tom hits long. Using units half the size instead, build a low tom row with how many small units cover that same length.",
        targets: [{ instrument: "lowTom", count: 10 }],
        explanation: "5 x 2 = 10 small units cover the same length as 5 big ones.",
      },
      D: {
        prompt:
          "A drum fill measures 2 big tom hits long. Using units half the size instead, build a low tom row with how many small units cover that same length.",
        targets: [{ instrument: "lowTom", count: 4 }],
        explanation: "2 x 2 = 4 small units cover the same length as 2 big ones.",
      },
    },
  },
  {
    slug: "math-g1-l22-telling-time-hour-half-hour",
    grade: 1,
    lessonNumber: 22,
    title: "Telling Time: Hour & Half Hour",
    mathSkill: "Telling Time (1.MD.B.3)",
    teaches: "Every slot counts ticks in our clock groove — a set number of ticks per hour, or half hour — multiply out and build the total.",
    bpm: 84,
    challenges: {
      A: {
        prompt: "One hour is 4 ticks in our clock groove. Build a bass drum row with how many ticks are in 2 hours.",
        targets: [{ instrument: "kick", count: 8 }],
        explanation: "2 hours is double 1 hour: 4 + 4 = 8 ticks.",
      },
      B: {
        prompt: "One hour is 4 ticks in our clock groove. Build a snare drum row with how many ticks are in 3 hours.",
        targets: [{ instrument: "snare", count: 12 }],
        explanation: "3 hours is three groups of 4 ticks: 4 + 4 + 4 = 12.",
      },
      C: {
        prompt: "One hour is 4 ticks in our clock groove. Build a hi-hat row with how many ticks are in 4 hours.",
        targets: [{ instrument: "hihatClosed", count: 16 }],
        explanation: "4 hours is four groups of 4 ticks: 4 + 4 + 4 + 4 = 16.",
      },
      D: {
        prompt: "A half hour is 2 ticks in our clock groove (half of an hour's 4). Build a bass drum row with how many ticks are in 3 half hours.",
        targets: [{ instrument: "kick", count: 6 }],
        explanation: "3 half hours is three groups of 2 ticks: 2 + 2 + 2 = 6.",
      },
    },
  },
  {
    slug: "math-g1-l23-data-and-graphs-tally-marks",
    grade: 1,
    lessonNumber: 23,
    title: "Data & Graphs: Tally Marks",
    mathSkill: "Reading Tally Marks (1.MD.C.4)",
    teaches: "Every slot gives you a number as full tally groups of 5 plus some leftovers — build just the number of full groups, not the total itself.",
    bpm: 88,
    challenges: {
      A: {
        prompt: "17 is 3 full tally groups of 5, plus 2 leftover hits. Build a bass drum row with just the number of full groups.",
        targets: [{ instrument: "kick", count: 3 }],
        explanation: "3 groups of 5 is 15, plus 2 more leftover hits makes 17 — 3 is how many full groups there are.",
      },
      B: {
        prompt: "23 is 4 full tally groups of 5, plus 3 leftover hits. Build a snare drum row with just the number of full groups.",
        targets: [{ instrument: "snare", count: 4 }],
        explanation: "4 groups of 5 is 20, plus 3 leftover makes 23.",
      },
      C: {
        prompt: "12 is 2 full tally groups of 5, plus 2 leftover hits. Build a hi-hat row with just the number of full groups.",
        targets: [{ instrument: "hihatClosed", count: 2 }],
        explanation: "2 groups of 5 is 10, plus 2 leftover makes 12.",
      },
      D: {
        prompt: "28 is 5 full tally groups of 5, plus 3 leftover hits. Build a bass drum row with just the number of full groups.",
        targets: [{ instrument: "kick", count: 5 }],
        explanation: "5 groups of 5 is 25, plus 3 leftover makes 28.",
      },
    },
  },
  {
    slug: "math-g1-l24-shapes-composing-and-partitioning",
    grade: 1,
    lessonNumber: 24,
    title: "Shapes: Composing & Partitioning",
    mathSkill: "Shapes & Equal Shares (1.G.A.2, 1.G.A.3)",
    teaches: "Every slot is a shape or an equal share — count the sides, or the pieces, and build that many hits.",
    bpm: 88,
    challenges: {
      A: {
        prompt: "A square has 4 equal sides. Build a bass drum row with that many hits.",
        targets: [{ instrument: "kick", count: 4 }],
        explanation: "A square has 4 sides — one hit for each.",
      },
      B: {
        prompt: "A triangle has 3 sides. Build a snare drum row with that many hits.",
        targets: [{ instrument: "snare", count: 3 }],
        explanation: "A triangle has 3 sides — one hit for each.",
      },
      C: {
        prompt: "If you split a beat into 2 equal pieces (halves), how many pieces are there? Build a hi-hat row with that many hits.",
        targets: [{ instrument: "hihatClosed", count: 2 }],
        explanation: "Splitting something into 2 equal shares makes halves — 2 pieces.",
      },
      D: {
        prompt: "If you split a beat into 4 equal pieces (fourths), how many pieces are there? Build a bass drum row with that many hits.",
        targets: [{ instrument: "kick", count: 4 }],
        explanation: "Splitting something into 4 equal shares makes fourths, also called quarters — 4 pieces.",
      },
    },
  },

  // ============================================================
  // GRADE 2
  // ============================================================
  // Grade 2 Common Core spends most of its weight on base-ten place value
  // (2.NBT has 9 standards spanning hundreds/tens/ones, skip counting to
  // 1000, and adding/subtracting within 100 and 1000) with operations &
  // algebraic thinking (2.OA: fluency within 20, odd/even, arrays as the
  // seed of multiplication) a close second — so this batch does the same,
  // then measurement/data and geometry. A 2nd grader's numbers are bigger
  // than 1st grade's, often too big to build as one row of individual hits
  // (nobody should have to place 65 hits by hand) — so wherever an answer
  // is a 2- or 3-digit number, it's built split across a hundreds/tens/ones
  // row per place, the same trick Grade 1's own place-value lessons used,
  // just extended. That split is also exactly where "multiple drum pieces"
  // earns its keep pedagogically, not just as variety for its own sake:
  // arrays split into a rows row and a columns row, a length comparison
  // splits into both lengths plus their difference, four addends that
  // cross 100 split into hundreds/tens/ones — every extra instrument here
  // is standing in for a real, separate quantity in the problem.
  {
    slug: "math-g2-l01-addition-word-problems-within-100",
    grade: 2,
    lessonNumber: 1,
    title: "Addition Word Problems Within 100",
    mathSkill: "Addition Word Problems Within 100 (2.OA.A.1)",
    teaches:
      "Every slot is a two-digit addition word problem. The total is too big to build as one long row, so split it: a bass drum row for the tens, a hi-hat row for the ones.",
    bpm: 86,
    challenges: {
      A: {
        prompt:
          "A drum shop sells 24 sticks in the morning and 35 more in the afternoon. How many sticks were sold in all? Build the tens row and the ones row for the total.",
        targets: [
          { instrument: "kick", count: 5 },
          { instrument: "hihatClosed", count: 9 },
        ],
        explanation: "24 + 35 = 59 — 5 tens and 9 ones.",
      },
      B: {
        prompt:
          "A pet store has 18 fish in one tank and 46 fish in another. How many fish are there in all? Build the tens row and the ones row for the total.",
        targets: [
          { instrument: "kick", count: 6 },
          { instrument: "hihatClosed", count: 4 },
        ],
        explanation: "18 + 46 = 64 — 6 tens and 4 ones.",
      },
      C: {
        prompt:
          "A school has 27 first graders and 38 second graders. How many students are there in all? Build the tens row and the ones row for the total.",
        targets: [
          { instrument: "kick", count: 6 },
          { instrument: "hihatClosed", count: 5 },
        ],
        explanation: "27 + 38 = 65 — 6 tens and 5 ones.",
      },
      D: {
        prompt:
          "A farmer picks 16 apples in the morning and 29 more in the afternoon. How many apples in all? Build the tens row and the ones row for the total.",
        targets: [
          { instrument: "kick", count: 4 },
          { instrument: "hihatClosed", count: 5 },
        ],
        explanation: "16 + 29 = 45 — 4 tens and 5 ones.",
      },
    },
  },
  {
    slug: "math-g2-l02-subtraction-word-problems-within-100",
    grade: 2,
    lessonNumber: 2,
    title: "Subtraction Word Problems Within 100",
    mathSkill: "Subtraction Word Problems Within 100 (2.OA.A.1)",
    teaches:
      "Every slot is a two-digit subtraction word problem — build what's left split into a tens row and a ones row.",
    bpm: 86,
    challenges: {
      A: {
        prompt:
          "A recording studio has 84 drumsticks. 37 of them get used up during the session. How many drumsticks are left? Build the tens row and the ones row for what's left.",
        targets: [
          { instrument: "kick", count: 4 },
          { instrument: "hihatClosed", count: 7 },
        ],
        explanation: "84 - 37 = 47 — 4 tens and 7 ones.",
      },
      B: {
        prompt:
          "A marching band has 62 members. 28 of them go home early. How many band members are left? Build the tens row and the ones row for what's left.",
        targets: [
          { instrument: "kick", count: 3 },
          { instrument: "hihatClosed", count: 4 },
        ],
        explanation: "62 - 28 = 34 — 3 tens and 4 ones.",
      },
      C: {
        prompt:
          "A music store has 73 cymbals in stock. 45 of them get sold. How many cymbals are left? Build the tens row and the ones row for what's left.",
        targets: [
          { instrument: "kick", count: 2 },
          { instrument: "hihatClosed", count: 8 },
        ],
        explanation: "73 - 45 = 28 — 2 tens and 8 ones.",
      },
      D: {
        prompt:
          "A drum circle sets up 91 seats. 56 people are sitting in them. How many seats are still empty? Build the tens row and the ones row for what's left.",
        targets: [
          { instrument: "kick", count: 3 },
          { instrument: "hihatClosed", count: 5 },
        ],
        explanation: "91 - 56 = 35 — 3 tens and 5 ones.",
      },
    },
  },
  {
    slug: "math-g2-l03-two-step-word-problems",
    grade: 2,
    lessonNumber: 3,
    title: "Two-Step Word Problems",
    mathSkill: "Two-Step Word Problems (2.OA.A.1)",
    teaches:
      "Every slot happens in two steps — work through them in order, and build only the final total in one row.",
    bpm: 88,
    challenges: {
      A: {
        prompt:
          "A drummer has 8 drumsticks. She buys 5 more, then gives 3 away. How many drumsticks does she have now? Build a bass drum row with that many hits.",
        targets: [{ instrument: "kick", count: 10 }],
        explanation: "8 + 5 = 13, then 13 - 3 = 10 — work through two steps in order.",
      },
      B: {
        prompt:
          "A band has 6 members. 4 more join, then 2 leave. How many members are in the band now? Build a snare drum row with that many hits.",
        targets: [{ instrument: "snare", count: 8 }],
        explanation: "6 + 4 = 10, then 10 - 2 = 8.",
      },
      C: {
        prompt:
          "A drum kit has 12 pieces. 3 break and get removed, then 5 new pieces are added. How many pieces does the kit have now? Build a hi-hat row with that many hits.",
        targets: [{ instrument: "hihatClosed", count: 14 }],
        explanation: "12 - 3 = 9, then 9 + 5 = 14.",
      },
      D: {
        prompt:
          "A concert has 15 songs planned. 4 get cut, then 2 encore songs get added. How many songs will be played? Build a bass drum row with that many hits.",
        targets: [{ instrument: "kick", count: 13 }],
        explanation: "15 - 4 = 11, then 11 + 2 = 13.",
      },
    },
  },
  {
    slug: "math-g2-l04-odd-and-even-numbers",
    grade: 2,
    lessonNumber: 4,
    title: "Odd and Even Numbers",
    mathSkill: "Odd and Even Numbers (2.OA.C.3)",
    teaches:
      "Every slot gives you an even number — show it's even by splitting it into two EQUAL groups on two different instruments.",
    bpm: 88,
    challenges: {
      A: {
        prompt:
          "Is 8 even? An even number splits into two equal groups. Build a bass drum row and a snare drum row with 4 hits each to show 8 = 4 + 4.",
        targets: [
          { instrument: "kick", count: 4 },
          { instrument: "snare", count: 4 },
        ],
        explanation: "8 is even because it splits evenly into two equal groups: 4 + 4 = 8.",
      },
      B: {
        prompt:
          "Is 10 even? Build a bass drum row and a snare drum row with 5 hits each to show 10 = 5 + 5.",
        targets: [
          { instrument: "kick", count: 5 },
          { instrument: "snare", count: 5 },
        ],
        explanation: "10 is even: 5 + 5 = 10.",
      },
      C: {
        prompt:
          "Is 14 even? Build a bass drum row and a snare drum row with 7 hits each to show 14 = 7 + 7.",
        targets: [
          { instrument: "kick", count: 7 },
          { instrument: "snare", count: 7 },
        ],
        explanation: "14 is even: 7 + 7 = 14.",
      },
      D: {
        prompt:
          "Is 18 even? Build a bass drum row and a snare drum row with 9 hits each to show 18 = 9 + 9.",
        targets: [
          { instrument: "kick", count: 9 },
          { instrument: "snare", count: 9 },
        ],
        explanation: "18 is even: 9 + 9 = 18 — every even number splits into two equal groups; an odd number always has one left over.",
      },
    },
  },
  {
    slug: "math-g2-l05-repeated-addition-and-arrays",
    grade: 2,
    lessonNumber: 5,
    title: "Repeated Addition & Arrays",
    mathSkill: "Repeated Addition & Arrays (2.OA.C.4)",
    teaches:
      "Every slot arranges equal rows of something — build a rimshot row with the number of rows, and a second row with the total, added the same amount over and over.",
    bpm: 88,
    challenges: {
      A: {
        prompt:
          "A drummer arranges 4 rows of drum pads, with 3 pads in each row. Build a rimshot row with the number of rows, and a bass drum row with the total number of pads (3+3+3+3).",
        targets: [
          { instrument: "rimshot", count: 4 },
          { instrument: "kick", count: 12 },
        ],
        explanation: "4 rows means 3 added 4 times: 3+3+3+3 = 12 — repeated addition is the start of multiplication.",
      },
      B: {
        prompt:
          "A drummer arranges 3 rows of cymbals, with 5 cymbals in each row. Build a rimshot row with the number of rows, and a crash cymbal row with the total number of cymbals (5+5+5).",
        targets: [
          { instrument: "rimshot", count: 3 },
          { instrument: "crash", count: 15 },
        ],
        explanation: "3 rows means 5 added 3 times: 5+5+5 = 15.",
      },
      C: {
        prompt:
          "A drummer arranges 5 rows of tambourines, with 2 tambourines in each row. Build a rimshot row with the number of rows, and a snare drum row with the total number of tambourines (2+2+2+2+2).",
        targets: [
          { instrument: "rimshot", count: 5 },
          { instrument: "snare", count: 10 },
        ],
        explanation: "5 rows means 2 added 5 times: 2+2+2+2+2 = 10.",
      },
      D: {
        prompt:
          "A drummer arranges 2 rows of triangles, with 6 triangles in each row. Build a rimshot row with the number of rows, and a ride cymbal row with the total number of triangles (6+6).",
        targets: [
          { instrument: "rimshot", count: 2 },
          { instrument: "ride", count: 12 },
        ],
        explanation: "2 rows means 6 added 2 times: 6+6 = 12.",
      },
    },
  },
  {
    slug: "math-g2-l06-fluency-within-20",
    grade: 2,
    lessonNumber: 6,
    title: "Building Fluency: Sums and Differences Within 20",
    mathSkill: "Fluency Within 20 (2.OA.B.2)",
    teaches: "Every slot is a fast fact, addition or subtraction — build the answer in one row.",
    bpm: 90,
    challenges: {
      A: {
        prompt: "9 + 6 = ? Build a bass drum row with the total.",
        targets: [{ instrument: "kick", count: 15 }],
        explanation: "9 + 6 = 15.",
      },
      B: {
        prompt: "13 - 7 = ? Build a snare drum row with what's left.",
        targets: [{ instrument: "snare", count: 6 }],
        explanation: "13 - 7 = 6.",
      },
      C: {
        prompt: "8 + 8 = ? Build a hi-hat row with the total.",
        targets: [{ instrument: "hihatClosed", count: 16 }],
        explanation: "8 + 8 = 16.",
      },
      D: {
        prompt: "17 - 9 = ? Build a bass drum row with what's left.",
        targets: [{ instrument: "kick", count: 8 }],
        explanation: "17 - 9 = 8.",
      },
    },
  },
  // --- Number & Operations in Base Ten (2.NBT) --------------------------
  {
    slug: "math-g2-l07-place-value-hundreds-tens-ones",
    grade: 2,
    lessonNumber: 7,
    title: "Place Value: Hundreds, Tens, and Ones",
    mathSkill: "Three-Digit Place Value (2.NBT.A.1)",
    teaches:
      "Every slot gives you a three-digit number — build its hundreds on the bass drum, its tens on the snare, and its ones on the hi-hat.",
    bpm: 88,
    challenges: {
      A: {
        prompt:
          "243 has 2 hundreds, 4 tens, and 3 ones. Build a bass drum row for the hundreds, a snare drum row for the tens, and a hi-hat row for the ones.",
        targets: [
          { instrument: "kick", count: 2 },
          { instrument: "snare", count: 4 },
          { instrument: "hihatClosed", count: 3 },
        ],
        explanation: "243 = 2 hundreds + 4 tens + 3 ones.",
      },
      B: {
        prompt: "516 has 5 hundreds, 1 ten, and 6 ones. Build the hundreds, tens, and ones rows.",
        targets: [
          { instrument: "kick", count: 5 },
          { instrument: "snare", count: 1 },
          { instrument: "hihatClosed", count: 6 },
        ],
        explanation: "516 = 5 hundreds + 1 ten + 6 ones.",
      },
      C: {
        prompt: "372 has 3 hundreds, 7 tens, and 2 ones. Build the hundreds, tens, and ones rows.",
        targets: [
          { instrument: "kick", count: 3 },
          { instrument: "snare", count: 7 },
          { instrument: "hihatClosed", count: 2 },
        ],
        explanation: "372 = 3 hundreds + 7 tens + 2 ones.",
      },
      D: {
        prompt:
          "608 has 6 hundreds, 0 tens, and 8 ones. Build the hundreds row and the ones row — there are no tens, so that row just stays empty.",
        targets: [
          { instrument: "kick", count: 6 },
          { instrument: "hihatClosed", count: 8 },
        ],
        explanation: "608 = 6 hundreds + 0 tens + 8 ones — when a place is zero, that row simply stays empty.",
      },
    },
  },
  {
    slug: "math-g2-l08-expanded-form",
    grade: 2,
    lessonNumber: 8,
    title: "Expanded Form",
    mathSkill: "Reading & Writing Numbers in Expanded Form (2.NBT.A.3)",
    teaches:
      "Every slot gives you a number already broken into hundreds, tens, and ones — build each digit on its own tom, low to high matching big to small.",
    bpm: 88,
    challenges: {
      A: {
        prompt:
          "300 + 40 + 2 = 342. Build a low tom row for the hundreds digit, a mid tom row for the tens digit, and a high tom row for the ones digit.",
        targets: [
          { instrument: "lowTom", count: 3 },
          { instrument: "midTom", count: 4 },
          { instrument: "highTom", count: 2 },
        ],
        explanation: "300 + 40 + 2 = 342 — 3 hundreds, 4 tens, 2 ones.",
      },
      B: {
        prompt: "600 + 70 + 5 = 675. Build the hundreds, tens, and ones rows using low tom, mid tom, and high tom.",
        targets: [
          { instrument: "lowTom", count: 6 },
          { instrument: "midTom", count: 7 },
          { instrument: "highTom", count: 5 },
        ],
        explanation: "600 + 70 + 5 = 675 — 6 hundreds, 7 tens, 5 ones.",
      },
      C: {
        prompt: "100 + 90 + 8 = 198. Build the hundreds, tens, and ones rows using low tom, mid tom, and high tom.",
        targets: [
          { instrument: "lowTom", count: 1 },
          { instrument: "midTom", count: 9 },
          { instrument: "highTom", count: 8 },
        ],
        explanation: "100 + 90 + 8 = 198 — 1 hundred, 9 tens, 8 ones.",
      },
      D: {
        prompt:
          "500 + 20 = 520. There's no ones digit to add — build just the hundreds row and the tens row.",
        targets: [
          { instrument: "lowTom", count: 5 },
          { instrument: "midTom", count: 2 },
        ],
        explanation: "500 + 20 = 520 — 5 hundreds, 2 tens, and 0 ones, so the ones row stays empty.",
      },
    },
  },
  {
    slug: "math-g2-l09-skip-counting-5s-10s-100s",
    grade: 2,
    lessonNumber: 9,
    title: "Skip Counting by 5s, 10s, and 100s",
    mathSkill: "Skip Counting to 1000 (2.NBT.A.2)",
    teaches: "Every slot asks how many equal jumps it takes to reach a number — skip count and build the number of jumps, not the number itself.",
    bpm: 90,
    challenges: {
      A: {
        prompt: "300 is how many groups of 100? Build a bass drum row with that many hits.",
        targets: [{ instrument: "kick", count: 3 }],
        explanation: "100, 200, 300 — that's 3 jumps of 100.",
      },
      B: {
        prompt: "700 is how many groups of 100? Build a snare drum row with that many hits.",
        targets: [{ instrument: "snare", count: 7 }],
        explanation: "100, 200, 300, 400, 500, 600, 700 — 7 jumps of 100.",
      },
      C: {
        prompt: "45 is how many groups of 5? Build a hi-hat row with that many hits.",
        targets: [{ instrument: "hihatClosed", count: 9 }],
        explanation: "5, 10, 15, ... up to 45 — that's 9 jumps of 5.",
      },
      D: {
        prompt: "90 is how many groups of 10? Build a bass drum row with that many hits.",
        targets: [{ instrument: "kick", count: 9 }],
        explanation: "10, 20, 30, ... up to 90 — that's 9 jumps of 10.",
      },
    },
  },
  {
    slug: "math-g2-l10-comparing-three-digit-numbers",
    grade: 2,
    lessonNumber: 10,
    title: "Comparing Three-Digit Numbers",
    mathSkill: "Comparing Numbers to 1000 (2.NBT.A.4)",
    teaches:
      "Every slot gives you a number by its hundreds digit and asks you to beat it, or lose to it — a bigger hundreds digit always makes the whole number bigger.",
    bpm: 90,
    challenges: {
      A: {
        prompt: "426 has 4 hundreds. Build a bass drum row with MORE than 4 hits, so your number's hundreds digit would beat it.",
        targets: [{ instrument: "kick", count: 4, comparison: "gt" }],
        explanation: "426 has 4 hundreds. 5 or more hits here gives a bigger hundreds digit, and a bigger hundreds digit always wins.",
      },
      B: {
        prompt: "719 has 7 hundreds. Build a snare drum row with MORE than 7 hits, so your number's hundreds digit would beat it.",
        targets: [{ instrument: "snare", count: 7, comparison: "gt" }],
        explanation: "719 has 7 hundreds. 8 or more hits here makes your number greater than 719.",
      },
      C: {
        prompt: "382 has 3 hundreds. Build a hi-hat row with FEWER than 3 hits, so your number's hundreds digit would lose to it.",
        targets: [{ instrument: "hihatClosed", count: 3, comparison: "lt" }],
        explanation: "382 has 3 hundreds. 1 or 2 hits here makes your number less than 382.",
      },
      D: {
        prompt: "555 has 5 hundreds. Build a bass drum row with FEWER than 5 hits, so your number's hundreds digit would lose to it.",
        targets: [{ instrument: "kick", count: 5, comparison: "lt" }],
        explanation: "555 has 5 hundreds. Fewer than 5 hits here makes your number less than 555.",
      },
    },
  },
  {
    slug: "math-g2-l11-ten-hundred-more-less",
    grade: 2,
    lessonNumber: 11,
    title: "Ten More, Ten Less, Hundred More, Hundred Less",
    mathSkill: "Ten/Hundred More or Less (2.NBT.B.8)",
    teaches:
      "Slots A-B change the number by 10 — only the tens (and ones) matter. Slots C-D change it by 100 — only the hundreds (and tens) matter.",
    bpm: 90,
    challenges: {
      A: {
        prompt: "156 is 1 hundred, 5 tens, 6 ones. Build the tens row and the ones row for the number that's 10 MORE than 156.",
        targets: [
          { instrument: "kick", count: 6 },
          { instrument: "hihatClosed", count: 6 },
        ],
        explanation: "10 more than 156 is 166 — the tens go from 5 to 6, the ones stay at 6.",
      },
      B: {
        prompt: "283 is 2 hundreds, 8 tens, 3 ones. Build the tens row and the ones row for the number that's 10 LESS than 283.",
        targets: [
          { instrument: "kick", count: 7 },
          { instrument: "hihatClosed", count: 3 },
        ],
        explanation: "10 less than 283 is 273 — the tens go from 8 to 7, the ones stay at 3.",
      },
      C: {
        prompt: "156 is 1 hundred, 5 tens, 6 ones. Build the hundreds row and the tens row for the number that's 100 MORE than 156.",
        targets: [
          { instrument: "kick", count: 2 },
          { instrument: "hihatClosed", count: 5 },
        ],
        explanation: "100 more than 156 is 256 — the hundreds go from 1 to 2, the tens stay at 5.",
      },
      D: {
        prompt: "412 is 4 hundreds, 1 ten, 2 ones. Build the hundreds row and the tens row for the number that's 100 LESS than 412.",
        targets: [
          { instrument: "kick", count: 3 },
          { instrument: "hihatClosed", count: 1 },
        ],
        explanation: "100 less than 412 is 312 — the hundreds go from 4 to 3, the tens stay at 1.",
      },
    },
  },
  {
    slug: "math-g2-l12-adding-two-digit-numbers-with-regrouping",
    grade: 2,
    lessonNumber: 12,
    title: "Adding Two-Digit Numbers, With Regrouping",
    mathSkill: "Add Within 100 With Regrouping (2.NBT.B.5)",
    teaches:
      "Every slot's ones add up past 10 — carry a new ten into the tens place, then build the total split into a tens row and a ones row.",
    bpm: 92,
    challenges: {
      A: {
        prompt: "27 + 38 = ? Build the tens row and the ones row for the total.",
        targets: [
          { instrument: "kick", count: 6 },
          { instrument: "hihatClosed", count: 5 },
        ],
        explanation: "27 + 38 = 65 — the 7 and 8 ones make 15, carry a ten, so it's 6 tens and 5 ones.",
      },
      B: {
        prompt: "45 + 19 = ? Build the tens row and the ones row for the total.",
        targets: [
          { instrument: "kick", count: 6 },
          { instrument: "hihatClosed", count: 4 },
        ],
        explanation: "45 + 19 = 64 — 6 tens and 4 ones.",
      },
      C: {
        prompt: "58 + 26 = ? Build the tens row and the ones row for the total.",
        targets: [
          { instrument: "kick", count: 8 },
          { instrument: "hihatClosed", count: 4 },
        ],
        explanation: "58 + 26 = 84 — 8 tens and 4 ones.",
      },
      D: {
        prompt: "34 + 49 = ? Build the tens row and the ones row for the total.",
        targets: [
          { instrument: "kick", count: 8 },
          { instrument: "hihatClosed", count: 3 },
        ],
        explanation: "34 + 49 = 83 — 8 tens and 3 ones.",
      },
    },
  },
  {
    slug: "math-g2-l13-subtracting-two-digit-numbers-with-regrouping",
    grade: 2,
    lessonNumber: 13,
    title: "Subtracting Two-Digit Numbers, With Regrouping",
    mathSkill: "Subtract Within 100 With Regrouping (2.NBT.B.5)",
    teaches:
      "Every slot needs to borrow a ten to subtract the ones — then build what's left split into a tens row and a ones row.",
    bpm: 92,
    challenges: {
      A: {
        prompt: "62 - 27 = ? Build the tens row and the ones row for what's left.",
        targets: [
          { instrument: "kick", count: 3 },
          { instrument: "hihatClosed", count: 5 },
        ],
        explanation: "62 - 27 = 35 — borrow a ten to take 7 ones from 2, then subtract the tens: 3 tens and 5 ones.",
      },
      B: {
        prompt: "81 - 36 = ? Build the tens row and the ones row for what's left.",
        targets: [
          { instrument: "kick", count: 4 },
          { instrument: "hihatClosed", count: 5 },
        ],
        explanation: "81 - 36 = 45 — 4 tens and 5 ones.",
      },
      C: {
        prompt: "50 - 24 = ? Build the tens row and the ones row for what's left.",
        targets: [
          { instrument: "kick", count: 2 },
          { instrument: "hihatClosed", count: 6 },
        ],
        explanation: "50 - 24 = 26 — 2 tens and 6 ones.",
      },
      D: {
        prompt: "93 - 58 = ? Build the tens row and the ones row for what's left.",
        targets: [
          { instrument: "kick", count: 3 },
          { instrument: "hihatClosed", count: 5 },
        ],
        explanation: "93 - 58 = 35 — 3 tens and 5 ones.",
      },
    },
  },
  {
    slug: "math-g2-l14-adding-four-two-digit-numbers",
    grade: 2,
    lessonNumber: 14,
    title: "Adding Four Two-Digit Numbers",
    mathSkill: "Add Up To Four Two-Digit Numbers (2.NBT.B.6)",
    teaches:
      "Every slot adds four two-digit numbers at once — add them one pair at a time, and the total crosses 100, so build it split into hundreds, tens, and ones.",
    bpm: 92,
    challenges: {
      A: {
        prompt: "24 + 38 + 41 + 34 = ? Add them one at a time, then build the hundreds, tens, and ones rows for the total.",
        targets: [
          { instrument: "kick", count: 1 },
          { instrument: "snare", count: 3 },
          { instrument: "hihatClosed", count: 7 },
        ],
        explanation: "24+38=62, 62+41=103, 103+34=137 — 1 hundred, 3 tens, 7 ones.",
      },
      B: {
        prompt: "26 + 35 + 48 + 45 = ? Add them one at a time, then build the hundreds, tens, and ones rows for the total.",
        targets: [
          { instrument: "kick", count: 1 },
          { instrument: "snare", count: 5 },
          { instrument: "hihatClosed", count: 4 },
        ],
        explanation: "26+35=61, 61+48=109, 109+45=154 — 1 hundred, 5 tens, 4 ones.",
      },
      C: {
        prompt: "19 + 27 + 38 + 44 = ? Add them one at a time, then build the hundreds, tens, and ones rows for the total.",
        targets: [
          { instrument: "kick", count: 1 },
          { instrument: "snare", count: 2 },
          { instrument: "hihatClosed", count: 8 },
        ],
        explanation: "19+27=46, 46+38=84, 84+44=128 — 1 hundred, 2 tens, 8 ones.",
      },
      D: {
        prompt: "32 + 41 + 53 + 37 = ? Add them one at a time, then build the hundreds, tens, and ones rows for the total.",
        targets: [
          { instrument: "kick", count: 1 },
          { instrument: "snare", count: 6 },
          { instrument: "hihatClosed", count: 3 },
        ],
        explanation: "32+41=73, 73+53=126, 126+37=163 — 1 hundred, 6 tens, 3 ones.",
      },
    },
  },
  {
    slug: "math-g2-l15-adding-within-1000",
    grade: 2,
    lessonNumber: 15,
    title: "Adding Within 1000",
    mathSkill: "Add Within 1000 (2.NBT.B.7)",
    teaches:
      "Every slot adds two three-digit numbers — add each place separately, then build the total's hundreds, tens, and ones as their own rows.",
    bpm: 94,
    challenges: {
      A: {
        prompt: "234 + 142 = ? Build the hundreds, tens, and ones rows for the total.",
        targets: [
          { instrument: "kick", count: 3 },
          { instrument: "snare", count: 7 },
          { instrument: "hihatClosed", count: 6 },
        ],
        explanation: "234 + 142 = 376 — 3 hundreds, 7 tens, 6 ones.",
      },
      B: {
        prompt: "315 + 263 = ? Build the hundreds, tens, and ones rows for the total.",
        targets: [
          { instrument: "kick", count: 5 },
          { instrument: "snare", count: 7 },
          { instrument: "hihatClosed", count: 8 },
        ],
        explanation: "315 + 263 = 578 — 5 hundreds, 7 tens, 8 ones.",
      },
      C: {
        prompt: "428 + 351 = ? Build the hundreds, tens, and ones rows for the total.",
        targets: [
          { instrument: "kick", count: 7 },
          { instrument: "snare", count: 7 },
          { instrument: "hihatClosed", count: 9 },
        ],
        explanation: "428 + 351 = 779 — 7 hundreds, 7 tens, 9 ones.",
      },
      D: {
        prompt: "256 + 133 = ? Build the hundreds, tens, and ones rows for the total.",
        targets: [
          { instrument: "kick", count: 3 },
          { instrument: "snare", count: 8 },
          { instrument: "hihatClosed", count: 9 },
        ],
        explanation: "256 + 133 = 389 — 3 hundreds, 8 tens, 9 ones.",
      },
    },
  },
  {
    slug: "math-g2-l16-subtracting-within-1000",
    grade: 2,
    lessonNumber: 16,
    title: "Subtracting Within 1000",
    mathSkill: "Subtract Within 1000 (2.NBT.B.7)",
    teaches:
      "Every slot subtracts two three-digit numbers — subtract each place separately, then build what's left as hundreds, tens, and ones rows.",
    bpm: 94,
    challenges: {
      A: {
        prompt: "486 - 253 = ? Build the hundreds, tens, and ones rows for what's left.",
        targets: [
          { instrument: "kick", count: 2 },
          { instrument: "snare", count: 3 },
          { instrument: "hihatClosed", count: 3 },
        ],
        explanation: "486 - 253 = 233 — 2 hundreds, 3 tens, 3 ones.",
      },
      B: {
        prompt: "579 - 324 = ? Build the hundreds, tens, and ones rows for what's left.",
        targets: [
          { instrument: "kick", count: 2 },
          { instrument: "snare", count: 5 },
          { instrument: "hihatClosed", count: 5 },
        ],
        explanation: "579 - 324 = 255 — 2 hundreds, 5 tens, 5 ones.",
      },
      C: {
        prompt: "648 - 216 = ? Build the hundreds, tens, and ones rows for what's left.",
        targets: [
          { instrument: "kick", count: 4 },
          { instrument: "snare", count: 3 },
          { instrument: "hihatClosed", count: 2 },
        ],
        explanation: "648 - 216 = 432 — 4 hundreds, 3 tens, 2 ones.",
      },
      D: {
        prompt: "795 - 462 = ? Build the hundreds, tens, and ones rows for what's left.",
        targets: [
          { instrument: "kick", count: 3 },
          { instrument: "snare", count: 3 },
          { instrument: "hihatClosed", count: 3 },
        ],
        explanation: "795 - 462 = 333 — 3 hundreds, 3 tens, 3 ones.",
      },
    },
  },
  // --- Measurement & Data (2.MD) ------------------------------------------
  {
    slug: "math-g2-l17-measuring-and-comparing-lengths",
    grade: 2,
    lessonNumber: 17,
    title: "Measuring and Comparing Lengths",
    mathSkill: "Measure & Compare Lengths (2.MD.A.1, 2.MD.A.4)",
    teaches:
      "Every slot measures two objects — build each one's length on its own tom, then build the difference between them on the rimshot.",
    bpm: 88,
    challenges: {
      A: {
        prompt:
          "A drumstick is 9 units long. A mallet is 6 units long. Build a low tom row for the drumstick's length, a mid tom row for the mallet's length, and a rimshot row for how much longer the drumstick is.",
        targets: [
          { instrument: "lowTom", count: 9 },
          { instrument: "midTom", count: 6 },
          { instrument: "rimshot", count: 3 },
        ],
        explanation: "9 - 6 = 3 — the drumstick is 3 units longer than the mallet.",
      },
      B: {
        prompt:
          "A snare stand is 12 units tall. A cymbal stand is 7 units tall. Build a low tom row for the snare stand, a mid tom row for the cymbal stand, and a rimshot row for how much taller the snare stand is.",
        targets: [
          { instrument: "lowTom", count: 12 },
          { instrument: "midTom", count: 7 },
          { instrument: "rimshot", count: 5 },
        ],
        explanation: "12 - 7 = 5 — the snare stand is 5 units taller.",
      },
      C: {
        prompt:
          "A guitar is 14 units long. A ukulele is 8 units long. Build a low tom row for the guitar, a mid tom row for the ukulele, and a rimshot row for how much longer the guitar is.",
        targets: [
          { instrument: "lowTom", count: 14 },
          { instrument: "midTom", count: 8 },
          { instrument: "rimshot", count: 6 },
        ],
        explanation: "14 - 8 = 6 — the guitar is 6 units longer.",
      },
      D: {
        prompt:
          "A conga is 11 units tall. A bongo is 5 units tall. Build a low tom row for the conga, a mid tom row for the bongo, and a rimshot row for how much taller the conga is.",
        targets: [
          { instrument: "lowTom", count: 11 },
          { instrument: "midTom", count: 5 },
          { instrument: "rimshot", count: 6 },
        ],
        explanation: "11 - 5 = 6 — the conga is 6 units taller.",
      },
    },
  },
  {
    slug: "math-g2-l18-telling-time-five-minutes",
    grade: 2,
    lessonNumber: 18,
    title: "Telling Time to Five Minutes",
    mathSkill: "Telling Time to Five Minutes (2.MD.C.7)",
    teaches: "Every slot counts ticks in our clock groove — one tick every 5 minutes. Skip count and build the total.",
    bpm: 88,
    challenges: {
      A: {
        prompt: "Our clock groove ticks once every 5 minutes. Build a bass drum row with how many ticks happen in 20 minutes.",
        targets: [{ instrument: "kick", count: 4 }],
        explanation: "20 minutes is four 5-minute ticks: 5, 10, 15, 20.",
      },
      B: {
        prompt: "Our clock groove ticks once every 5 minutes. Build a snare drum row with how many ticks happen in 35 minutes.",
        targets: [{ instrument: "snare", count: 7 }],
        explanation: "35 minutes is seven 5-minute ticks.",
      },
      C: {
        prompt: "Our clock groove ticks once every 5 minutes. Build a hi-hat row with how many ticks happen in 50 minutes.",
        targets: [{ instrument: "hihatClosed", count: 10 }],
        explanation: "50 minutes is ten 5-minute ticks.",
      },
      D: {
        prompt: "Our clock groove ticks once every 5 minutes. Build a bass drum row with how many ticks happen in half an hour (30 minutes).",
        targets: [{ instrument: "kick", count: 6 }],
        explanation: "Half an hour is 30 minutes, six 5-minute ticks.",
      },
    },
  },
  {
    slug: "math-g2-l19-counting-money",
    grade: 2,
    lessonNumber: 19,
    title: "Counting Money",
    mathSkill: "Counting Coin Values (2.MD.C.8)",
    teaches:
      "Slots A-B skip count one coin at a time to reach a value. Slots C-D mix two coins — build each coin's own count on its own row.",
    bpm: 90,
    challenges: {
      A: {
        prompt: "A nickel is worth 5 cents. Build a bass drum row with how many nickels it takes to make 40 cents.",
        targets: [{ instrument: "kick", count: 8 }],
        explanation: "5, 10, 15, ... up to 40 — that's 8 nickels.",
      },
      B: {
        prompt: "A dime is worth 10 cents. Build a snare drum row with how many dimes it takes to make 70 cents.",
        targets: [{ instrument: "snare", count: 7 }],
        explanation: "10, 20, 30, ... up to 70 — that's 7 dimes.",
      },
      C: {
        prompt: "You have 3 dimes and 4 pennies. Build a snare drum row for the dimes and a rimshot row for the pennies.",
        targets: [
          { instrument: "snare", count: 3 },
          { instrument: "rimshot", count: 4 },
        ],
        explanation: "3 dimes and 4 pennies is 30 + 4 = 34 cents — build each coin's own count.",
      },
      D: {
        prompt: "You have 2 quarters and 6 pennies. Build a crash cymbal row for the quarters and a rimshot row for the pennies.",
        targets: [
          { instrument: "crash", count: 2 },
          { instrument: "rimshot", count: 6 },
        ],
        explanation: "2 quarters and 6 pennies is 50 + 6 = 56 cents — build each coin's own count.",
      },
    },
  },
  {
    slug: "math-g2-l20-picture-and-bar-graphs",
    grade: 2,
    lessonNumber: 20,
    title: "Picture Graphs and Bar Graphs",
    mathSkill: "Reading Graphs (2.MD.D.10)",
    teaches:
      "Every slot reads off a graph with two categories — build each one's count on its own row; some slots also ask how many more one category got.",
    bpm: 90,
    challenges: {
      A: {
        prompt: "A class graph shows 6 votes for cats and 4 votes for dogs. Build a snare drum row for the cat votes and a bass drum row for the dog votes.",
        targets: [
          { instrument: "snare", count: 6 },
          { instrument: "kick", count: 4 },
        ],
        explanation: "Read each bar straight off the graph: cats = 6, dogs = 4.",
      },
      B: {
        prompt: "A class graph shows 3 votes for pizza and 8 votes for tacos. Build a snare drum row for the pizza votes and a bass drum row for the taco votes.",
        targets: [
          { instrument: "snare", count: 3 },
          { instrument: "kick", count: 8 },
        ],
        explanation: "Read each bar straight off the graph: pizza = 3, tacos = 8.",
      },
      C: {
        prompt:
          "A class graph shows 7 votes for red and 2 votes for blue. Build a snare drum row for the red votes, a bass drum row for the blue votes, and a hi-hat row for how many more votes red got.",
        targets: [
          { instrument: "snare", count: 7 },
          { instrument: "kick", count: 2 },
          { instrument: "hihatClosed", count: 5 },
        ],
        explanation: "Red = 7, blue = 2, and 7 - 2 = 5 more votes for red.",
      },
      D: {
        prompt:
          "A class graph shows 9 votes for summer and 5 votes for winter. Build a snare drum row for the summer votes, a bass drum row for the winter votes, and a hi-hat row for how many more votes summer got.",
        targets: [
          { instrument: "snare", count: 9 },
          { instrument: "kick", count: 5 },
          { instrument: "hihatClosed", count: 4 },
        ],
        explanation: "Summer = 9, winter = 5, and 9 - 5 = 4 more votes for summer.",
      },
    },
  },
  // --- Geometry (2.G) -------------------------------------------------------
  {
    slug: "math-g2-l21-2d-and-3d-shapes",
    grade: 2,
    lessonNumber: 21,
    title: "2D and 3D Shapes",
    mathSkill: "Shape Attributes (2.G.A.1)",
    teaches: "Every slot is a shape — count its sides, angles, or faces, and build that many hits.",
    bpm: 88,
    challenges: {
      A: {
        prompt: "A pentagon has 5 sides. Build a bass drum row with that many hits.",
        targets: [{ instrument: "kick", count: 5 }],
        explanation: "A pentagon has 5 sides — one hit for each.",
      },
      B: {
        prompt: "A hexagon has 6 sides. Build a snare drum row with that many hits.",
        targets: [{ instrument: "snare", count: 6 }],
        explanation: "A hexagon has 6 sides — one hit for each.",
      },
      C: {
        prompt: "A quadrilateral has 4 angles. Build a hi-hat row with that many hits.",
        targets: [{ instrument: "hihatClosed", count: 4 }],
        explanation: "Any quadrilateral — square, rectangle, or otherwise — has 4 angles.",
      },
      D: {
        prompt: "A cube has 6 faces. Build a bass drum row with that many hits.",
        targets: [{ instrument: "kick", count: 6 }],
        explanation: "A cube has 6 faces — one hit for each.",
      },
    },
  },
  {
    slug: "math-g2-l22-rows-and-columns-arrays",
    grade: 2,
    lessonNumber: 22,
    title: "Partitioning Rectangles: Rows and Columns",
    mathSkill: "Rows & Columns of Squares (2.G.A.2)",
    teaches:
      "Every slot splits a rectangle into equal-size squares — build the number of rows and the number of columns; two slots also ask for the total.",
    bpm: 90,
    challenges: {
      A: {
        prompt:
          "A rectangle is split into 3 rows and 4 columns of equal squares. Build a rimshot row with the number of rows and a ride cymbal row with the number of columns.",
        targets: [
          { instrument: "rimshot", count: 3 },
          { instrument: "ride", count: 4 },
        ],
        explanation: "3 rows and 4 columns — the rectangle has 12 squares in all, even without building the total.",
      },
      B: {
        prompt:
          "A rectangle is split into 5 rows and 2 columns of equal squares. Build a rimshot row with the number of rows and a ride cymbal row with the number of columns.",
        targets: [
          { instrument: "rimshot", count: 5 },
          { instrument: "ride", count: 2 },
        ],
        explanation: "5 rows and 2 columns — 10 squares in all.",
      },
      C: {
        prompt:
          "A rectangle is split into 4 rows and 4 columns of equal squares. Build a rimshot row with the number of rows, a ride cymbal row with the number of columns, and a bass drum row with the total number of squares.",
        targets: [
          { instrument: "rimshot", count: 4 },
          { instrument: "ride", count: 4 },
          { instrument: "kick", count: 16 },
        ],
        explanation: "4 rows of 4 is 4+4+4+4 = 16 squares in all.",
      },
      D: {
        prompt:
          "A rectangle is split into 3 rows and 5 columns of equal squares. Build a rimshot row with the number of rows, a ride cymbal row with the number of columns, and a bass drum row with the total number of squares.",
        targets: [
          { instrument: "rimshot", count: 3 },
          { instrument: "ride", count: 5 },
          { instrument: "kick", count: 15 },
        ],
        explanation: "3 rows of 5 is 5+5+5 = 15 squares in all.",
      },
    },
  },
  {
    slug: "math-g2-l23-equal-shares-halves-thirds-fourths",
    grade: 2,
    lessonNumber: 23,
    title: "Equal Shares: Halves, Thirds, and Fourths",
    mathSkill: "Partitioning Shapes into Equal Shares (2.G.A.3)",
    teaches: "Every slot splits a shape into equal shares — build the number of pieces that split makes.",
    bpm: 90,
    challenges: {
      A: {
        prompt: "If you split a pizza into 2 equal shares (halves), how many pieces are there? Build a hi-hat row with that many hits.",
        targets: [{ instrument: "hihatClosed", count: 2 }],
        explanation: "Halves means 2 equal shares.",
      },
      B: {
        prompt: "If you split a pizza into 3 equal shares (thirds), how many pieces are there? Build a snare drum row with that many hits.",
        targets: [{ instrument: "snare", count: 3 }],
        explanation: "Thirds means 3 equal shares.",
      },
      C: {
        prompt: "If you split a pizza into 4 equal shares (fourths), how many pieces are there? Build a bass drum row with that many hits.",
        targets: [{ instrument: "kick", count: 4 }],
        explanation: "Fourths, also called quarters, means 4 equal shares.",
      },
      D: {
        prompt:
          "One drum head is split into halves, and another drum head is split into fourths. Build a hi-hat row with the number of halves, and a bass drum row with the number of fourths.",
        targets: [
          { instrument: "hihatClosed", count: 2 },
          { instrument: "kick", count: 4 },
        ],
        explanation: "Halves means 2 equal shares; fourths means 4 equal shares — two different splits of the same size whole.",
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
    if (!instruments.includes(target.instrument)) instruments.push(target.instrument);
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
