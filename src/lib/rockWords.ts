// RockWords: a Wordle-style word game scoped by US grade level, the same
// grade-scoping convention RockBlocks Math already established (see
// gradeLabel/MATH_GRADES in mathSchool.ts) — pure game logic here, no DOM/
// React. See rockWordsBeat.ts for how a played round turns into a real
// RockBlocks pattern, and RockWordsGame.tsx for the interactive UI.

export interface RockWordsGrade {
  grade: number;
  label: string;
  // URL segment under /rockwords/[gradeSlug].
  slug: string;
  wordLength: number;
  bpm: number;
  // A grade with no seeded/published words yet renders "Coming soon" on its
  // play page instead of a dead end — false for any future grade added here
  // before its content exists.
  isLive: boolean;
}

export const RW_GRADES: RockWordsGrade[] = [
  { grade: 0, label: "Kindergarten", slug: "kindergarten", wordLength: 3, bpm: 90, isLive: true },
  { grade: 1, label: "Grade 1", slug: "grade-1", wordLength: 4, bpm: 92, isLive: true },
  { grade: 2, label: "Grade 2", slug: "grade-2", wordLength: 5, bpm: 94, isLive: true },
];

export function gradeBySlug(slug: string): RockWordsGrade | undefined {
  return RW_GRADES.find((g) => g.slug === slug);
}

export function gradeByNumber(grade: number): RockWordsGrade | undefined {
  return RW_GRADES.find((g) => g.grade === grade);
}

// How many total guesses the game allows — a single game-wide setting (see
// rock_words_settings in schema.ts), not per-grade: every grade shares the
// same guess ceiling regardless of word length. Admin-controlled from
// /rockwords/admin, defaulting to 8 (two 4-row blocks).
export const MAX_ROWS_OPTIONS = [4, 6, 8] as const;
export type MaxRows = (typeof MAX_ROWS_OPTIONS)[number];
export const DEFAULT_MAX_ROWS: MaxRows = 8;

export function isValidMaxRows(value: number): value is MaxRows {
  return (MAX_ROWS_OPTIONS as readonly number[]).includes(value);
}

// How guesses split into "Block" squares — the on-brand visual motif this
// game builds toward (see RockWordsGame.tsx): each entry is how many rows
// one square holds, in order. 6 splits evenly into two 3-row squares rather
// than a lopsided 4+2, and 8 is two full 4-row squares; a new square starts
// only once the previous one is completely full, and every earlier square
// stays visible once it's done.
export const ROWS_PER_BLOCK: Record<MaxRows, number[]> = {
  4: [4],
  6: [3, 3],
  8: [4, 4],
};

export type LetterStatus = "hit" | "present" | "miss";

const VOWELS = new Set(["a", "e", "i", "o", "u"]);

export function isVowel(letter: string): boolean {
  return VOWELS.has(letter.toLowerCase());
}

// Standard duplicate-safe Wordle grading: exact matches are claimed first,
// then any leftover letters in the guess are checked against whatever
// copies of that letter the target has left over — so guessing a repeated
// letter never reports more "present"s than the target actually has of it.
export function evaluateGuess(guess: string, target: string): LetterStatus[] {
  const g = guess.toLowerCase().split("");
  const t = target.toLowerCase().split("");
  const statuses: LetterStatus[] = new Array(g.length).fill("miss");
  const remaining = new Map<string, number>();

  for (let i = 0; i < g.length; i++) {
    if (g[i] === t[i]) {
      statuses[i] = "hit";
    } else {
      remaining.set(t[i], (remaining.get(t[i]) ?? 0) + 1);
    }
  }
  for (let i = 0; i < g.length; i++) {
    if (statuses[i] === "hit") continue;
    const left = remaining.get(g[i]) ?? 0;
    if (left > 0) {
      statuses[i] = "present";
      remaining.set(g[i], left - 1);
    }
  }
  return statuses;
}

export interface RockWordsRound {
  guess: string;
  statuses: LetterStatus[];
}

export function isWinningGuess(statuses: LetterStatus[]): boolean {
  return statuses.every((s) => s === "hit");
}
