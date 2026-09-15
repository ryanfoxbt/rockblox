// Turns a played RockWords round into a real RockBlocks pattern — the exact
// same LineData/RhythmTile model the rest of the app already uses (see
// textToBeat.ts for the sibling generator this one is styled after: text
// becomes a beat there, guesses become a beat here).
//
// Built to be physically playable, not just deterministic: at any instant
// this never asks for more than one foot (kick) plus one hit apiece from two
// hands (a hi-hat-or-crash hand and a snare-or-tom hand) — a real drummer's
// actual limb count, kick/snare/hi-hat-closed as the primary kit per the
// brief, with toms and a crash used only as substitutions for a hand's part,
// never stacked on top of it.
//
// One guess row = one beat of the measure (row 0 is beat 1, row 1 is beat 2,
// ...), so the pattern is exactly as long as how many guesses have actually
// been played, up to the game's own guess limit — which tops out at 8, the
// same as a pattern's own beat ceiling. Within that one beat, a row's own
// letters subdivide it evenly (3 letters -> eighth-note triplets, 4 ->
// straight sixteenths, 5 -> sixteenth-note triplets, one slot left as rest):
//   - hit or present (the letter's in the word, right spot or not) -> a
//     plain, unaccented hit, the hand's part
//   - miss (wrong letter) -> no hand hit here at all; instead the kick (the
//     *other* limb, a foot) fills that exact slot, so a wrong letter still
//     gets a real, full-volume, undeniably-there hit without ever asking a
//     hand to be in two places at once.
// Deliberately no accents or ghost notes for these grades (K-2) — every
// hand/foot hit plays at the same plain velocity, which is simpler and more
// consistent for the youngest players to follow. Reserved as a tool for a
// future, older grade rather than used here.
// Any vowel in the guess (right or wrong) swaps that whole beat's hand part
// from snare to a tom — front vowels (e/i) -> High Tom, back vowels
// (a/o/u) -> Low Tom, mixed/tied -> Mid Tom — a different drum, still one
// hand. The hi-hat keeps the beat on every row except the one that wins the
// round, where it swaps to a crash for the resolve.
//
// Pure and deterministic — the same rows always produce the same beat, and
// it never depends on the target word itself, only on what was actually
// typed and how it graded, so it's identical whether the round is won or
// lost and never leaks the answer.
//
// ROCKWORDS_BEAT_RULES below restates every rule here in plain English —
// built from these same constants rather than freehand prose, so the two
// can't drift apart — and is rendered as-is on /rockwords/admin so the
// rules are visible (and easy to point at when asking for a change) without
// reading this file.
import { NoteName, RhythmHit, RhythmTile, tileFromHits } from "./rhythm";
import { InstrumentId } from "./instruments";
import { DEFAULT_VOLUME, LineData, MAX_BEATS } from "./song";
import { isVowel, isWinningGuess, LetterStatus, RockWordsRound } from "./rockWords";

const KICK: InstrumentId = "kick";
const HAND_A_DEFAULT: InstrumentId = "hihatClosed";
const HAND_A_ON_WIN: InstrumentId = "crash";
const HAND_B_DEFAULT: InstrumentId = "snare";

// How one row's letters subdivide its one beat — chosen so the slots always
// sum to exactly one beat (a tile's own hard rule) with real note values:
// 3 fits eighth-note triplets exactly, 4 fits straight sixteenths exactly,
// and 5 doesn't evenly divide the note vocabulary this app has, so it takes
// 5 of a 6-slot sixteenth-note-triplet grid and rests the 6th.
const SUBDIVISION_BY_WORD_LENGTH: Record<number, { noteName: NoteName; slots: number }> = {
  3: { noteName: "eighthTriplet", slots: 3 },
  4: { noteName: "sixteenth", slots: 4 },
  5: { noteName: "sixteenthTriplet", slots: 6 },
};

function subdivisionFor(wordLength: number): { noteName: NoteName; slots: number } {
  return SUBDIVISION_BY_WORD_LENGTH[wordLength] ?? { noteName: "sixteenth", slots: wordLength };
}

// Builds the hand's tile for one row: a plain, unaccented hit for every
// letter that's in the word (hit or present), and a rest wherever the
// letter was wrong (the kick takes that slot instead — see buildKickTile).
// No accents or ghost notes for these grades — see the file header. Returns
// null when the row has no hits or presents at all, so an all-wrong guess
// leaves this hand's line untouched at that beat rather than storing a tile
// that's silent end to end.
function buildHandTile(statuses: LetterStatus[]): RhythmTile | null {
  const { noteName, slots } = subdivisionFor(statuses.length);
  const hits: RhythmHit[] = [];
  let hasNote = false;
  for (let i = 0; i < slots; i++) {
    const status = i < statuses.length ? statuses[i] : undefined;
    if (status === "hit" || status === "present") {
      hits.push({ type: "note", note: noteName });
      hasNote = true;
    } else {
      hits.push({ type: "rest", note: noteName });
    }
  }
  return hasNote ? tileFromHits(hits) : null;
}

// The kick's tile for the same row/beat: a real, full-volume hit in exactly
// the slots the hand rested on (the wrong letters) — the foot picking up
// what the hand didn't play, never both at the same instant. Returns null
// when the row has no wrong letters, same reasoning as buildHandTile.
function buildKickTile(statuses: LetterStatus[]): RhythmTile | null {
  const { noteName, slots } = subdivisionFor(statuses.length);
  const hits: RhythmHit[] = [];
  let hasNote = false;
  for (let i = 0; i < slots; i++) {
    if (i < statuses.length && statuses[i] === "miss") {
      hits.push({ type: "note", note: noteName });
      hasNote = true;
    } else {
      hits.push({ type: "rest", note: noteName });
    }
  }
  return hasNote ? tileFromHits(hits) : null;
}

// A steady quarter-note pulse — the hi-hat's part on every row that isn't
// the winning one, and the crash's part on the one that is.
const HAND_A_TILE: RhythmTile = tileFromHits([{ type: "note", note: "quarter" }]);

// Front vowels (e/i) read as tighter/higher, back vowels (a/o/u) as rounder/
// lower — the same loose vowel-formant heuristic textToBeat.ts's
// dominantVowelTom uses, applied here to every vowel in the row's own guess
// (right or wrong) rather than to one word.
function dominantVowelTom(letters: string[]): InstrumentId {
  let back = 0;
  let front = 0;
  for (const letter of letters) {
    if (letter === "a" || letter === "o" || letter === "u") back++;
    else if (letter === "e" || letter === "i") front++;
  }
  if (back === 0 && front === 0) return "midTom";
  return back >= front ? "lowTom" : "highTom";
}

function emptyBlocks(): (RhythmTile | null)[] {
  return Array(MAX_BEATS).fill(null);
}

function randomLineId(seed: string): string {
  return `line-${seed}-${Math.random().toString(36).slice(2, 8)}`;
}

export function generateRockWordsBeat(rows: RockWordsRound[]): LineData[] {
  const kickBlocks = emptyBlocks();
  const hihatBlocks = emptyBlocks();
  const crashBlocks = emptyBlocks();
  const snareBlocks = emptyBlocks();
  const lowTomBlocks = emptyBlocks();
  const midTomBlocks = emptyBlocks();
  const highTomBlocks = emptyBlocks();

  rows.forEach((row, i) => {
    const letters = row.guess.toLowerCase().split("");
    const isFinalRow = i === rows.length - 1;

    // Hand A: the hi-hat keeps time on every beat except the one that wins
    // the round, which swaps it for a crash instead — a substitution, so
    // it's still ever only one hand's hit at this beat.
    if (isFinalRow && isWinningGuess(row.statuses)) {
      crashBlocks[i] = HAND_A_TILE;
    } else {
      hihatBlocks[i] = HAND_A_TILE;
    }

    // Hand B: snare by default, swapped for a tom (never both) when the
    // guess has any vowel in it at all — still one hand, just a different
    // drum. Which tom is picked from every vowel actually guessed this row,
    // correct or not.
    const handTile = buildHandTile(row.statuses);
    if (handTile) {
      const vowelsInRow = letters.filter(isVowel);
      if (vowelsInRow.length > 0) {
        const tomVoice = dominantVowelTom(vowelsInRow);
        if (tomVoice === "lowTom") lowTomBlocks[i] = handTile;
        else if (tomVoice === "highTom") highTomBlocks[i] = handTile;
        else midTomBlocks[i] = handTile;
      } else {
        snareBlocks[i] = handTile;
      }
    }

    // The foot: picks up exactly the slots the hand rested on (the wrong
    // letters), so a miss still gets a real, undeniable hit without ever
    // needing a third hand.
    const kickTile = buildKickTile(row.statuses);
    if (kickTile) kickBlocks[i] = kickTile;
  });

  const lines: LineData[] = [];
  const addLine = (instrument: InstrumentId, blocks: (RhythmTile | null)[]) => {
    if (blocks.some(Boolean)) lines.push({ id: randomLineId(instrument), instrument, blocks, volume: DEFAULT_VOLUME });
  };
  addLine(KICK, kickBlocks);
  addLine(HAND_A_DEFAULT, hihatBlocks);
  addLine(HAND_A_ON_WIN, crashBlocks);
  addLine(HAND_B_DEFAULT, snareBlocks);
  addLine("lowTom", lowTomBlocks);
  addLine("midTom", midTomBlocks);
  addLine("highTom", highTomBlocks);
  return lines;
}

export interface RockWordsBeatRule {
  title: string;
  detail: string;
}

// Restates the rules above in plain English, built from the same constants
// so the admin-facing copy can't silently drift from what the code actually
// does — see the file header. Rendered verbatim on /rockwords/admin.
export const ROCKWORDS_BEAT_RULES: RockWordsBeatRule[] = [
  {
    title: "One beat per guess row",
    detail: "Row 1 is beat 1 of the measure, row 2 is beat 2, and so on — the pattern is exactly as long as how many guesses have actually been played, up to the game's own guess limit (4, 6, or 8).",
  },
  {
    title: "Playable by two hands and a foot, never more",
    detail: "At any instant this asks for at most one kick (a foot) plus one hit apiece from two hands — never a third simultaneous hand part. Extra colors (toms, crash) always substitute for a hand's part, never stack on top of it.",
  },
  {
    title: "A letter that's in the word → a plain hand hit",
    detail: "Right spot or not, a plain, unaccented hit, subdividing the row's own beat evenly by word length (eighth-note triplets for 3 letters, straight sixteenths for 4, sixteenth-note triplets for 5). No accents or ghost notes for these grades (K-2) — every hit plays at the same volume, which is simpler and more consistent for young players. Held in reserve as a tool for a future, older grade.",
  },
  {
    title: "Wrong letter → the kick takes that slot",
    detail: "The hand rests exactly where a letter was wrong — instead of silence, the kick (a foot, not a third hand) plays a real, full-volume hit in that same slot, so a wrong letter still lands somewhere audible without ever needing more limbs than a drummer has.",
  },
  {
    title: "Any vowel swaps the hand's drum, not its count",
    detail: "A guess with a vowel in it (right or wrong) plays that whole beat's hand part on a tom instead of the snare — front vowels (e/i) → High Tom, back vowels (a/o/u) → Low Tom, mixed or tied → Mid Tom. Still one hand, just a different drum.",
  },
  {
    title: "The hi-hat holds time; a crash marks the win",
    detail: "The hi-hat plays every beat except the one that actually wins the round, where it swaps to a crash cymbal for the resolve — again a substitution, not an addition.",
  },
  {
    title: "Never depends on the answer",
    detail: "The beat is built purely from what was guessed and how it graded, never from the target word itself — identical whether the round is won or lost, and never gives anything away.",
  },
];
