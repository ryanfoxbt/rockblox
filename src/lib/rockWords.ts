// RockWords: a Wordle-style word game scoped by US grade level, the same
// grade-scoping convention RockBlocks Math already established (see
// gradeLabel/MATH_GRADES in mathSchool.ts) — pure game logic here, no DOM/
// React. See rockWordsBeat.ts for how a played round turns into a real
// RockBlocks pattern, and RockWordsGame.tsx for the interactive UI.
import { MAX_BEATS } from "./song";

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

// Word length climbs every grade (never decreases) up to a K-12 capstone at
// 11 letters; grades that share a length (4/5, 6/7, 8/9, 10/11) differentiate
// through vocabulary rarity/abstraction instead, the same way real
// vocabulary tests stop just scaling raw length past a certain age. See
// beatsPerRow below for why 6 letters is the natural line between "fits in
// one beat" and "needs two."
export const RW_GRADES: RockWordsGrade[] = [
  { grade: 0, label: "Kindergarten", slug: "kindergarten", wordLength: 3, bpm: 90, isLive: true },
  { grade: 1, label: "Grade 1", slug: "grade-1", wordLength: 4, bpm: 92, isLive: true },
  { grade: 2, label: "Grade 2", slug: "grade-2", wordLength: 5, bpm: 94, isLive: true },
  { grade: 3, label: "Grade 3", slug: "grade-3", wordLength: 6, bpm: 96, isLive: true },
  { grade: 4, label: "Grade 4", slug: "grade-4", wordLength: 7, bpm: 98, isLive: true },
  { grade: 5, label: "Grade 5", slug: "grade-5", wordLength: 7, bpm: 100, isLive: true },
  { grade: 6, label: "Grade 6", slug: "grade-6", wordLength: 8, bpm: 102, isLive: true },
  { grade: 7, label: "Grade 7", slug: "grade-7", wordLength: 8, bpm: 104, isLive: true },
  { grade: 8, label: "Grade 8", slug: "grade-8", wordLength: 9, bpm: 106, isLive: true },
  { grade: 9, label: "Grade 9", slug: "grade-9", wordLength: 9, bpm: 108, isLive: true },
  { grade: 10, label: "Grade 10", slug: "grade-10", wordLength: 10, bpm: 110, isLive: true },
  { grade: 11, label: "Grade 11", slug: "grade-11", wordLength: 10, bpm: 112, isLive: true },
  { grade: 12, label: "Grade 12", slug: "grade-12", wordLength: 11, bpm: 114, isLive: true },
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

// How many beats of the measure one guess row needs (see rockWordsBeat.ts):
// a beat can only be evenly subdivided by real note values up to 6 letters
// at once (eighth-triplet=3, sixteenth=4, sixteenth-triplet=6 — there's no
// note value for 7+ equal slots), so any longer word spills into a second
// beat. No grade defined above ever needs a third.
export function beatsPerRow(wordLength: number): number {
  return Math.max(1, Math.ceil(wordLength / 6));
}

// The guess ceiling actually usable this grade: the admin's global 4/6/8
// setting, clamped so `effectiveMaxRows * beatsPerRow` never exceeds a
// pattern's own MAX_BEATS ceiling. For every 1-beat grade (K-3) this is just
// the admin setting, unchanged; for every 2-beat grade (4-12) this always
// resolves to 4, regardless of the admin setting — 2-beat rows physically
// can't fit more than 4 of themselves in an 8-beat pattern. See the "why 4
// guesses" FAQ entry in seo.ts for the player-facing explanation.
export function effectiveMaxRows(grade: RockWordsGrade, adminMaxRows: MaxRows): MaxRows {
  const cap = Math.floor(MAX_BEATS / beatsPerRow(grade.wordLength));
  let result: MaxRows = MAX_ROWS_OPTIONS[0];
  for (const option of MAX_ROWS_OPTIONS) {
    if (option <= adminMaxRows && option <= cap) result = option;
  }
  return result;
}

// Free letter reveals for the grades that got squeezed down to 4 guesses by
// the beat-count cap above (word length 7+) — those grades trade guess count
// for word length, and 4 tries at an 11-letter word is not a fair fight even
// with a good clue. A word that still fits in 1 beat (<=6 letters, K-3)
// already plays with up to 8 guesses, more forgiving than adult Wordle's 6
// guesses for 5 letters, so it gets none. Scales with how much length was
// traded away: +1 hint per 2 extra letters past 6, capped at 3 so the
// longest grade (11 letters) still has to solve most of it. A hint never
// consumes a guess row (or the beat it would have added) — it's pure
// information, on top of the guess budget, not instead of part of it.
export function hintsAllowed(wordLength: number): number {
  if (wordLength <= 6) return 0;
  return Math.min(3, Math.ceil((wordLength - 6) / 2));
}

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
