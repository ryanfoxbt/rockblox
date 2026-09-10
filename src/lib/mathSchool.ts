import type { InstrumentId } from "@/lib/instruments";
import type { SlotLetter } from "@/lib/board";

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

// Only Grade 1 exists today; more grades append here as they're written —
// index/list pages derive their grade sections from this, not a hardcoded
// "Grade 1" string.
export const MATH_GRADES: MathGrade[] = [{ grade: 1, label: "Grade 1" }];

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
];

export function mathLessonsForGrade(grade: number): MathLesson[] {
  return MATH_LESSONS.filter((l) => l.grade === grade);
}
