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
// One guess row is one beat of the measure — unless its word is longer than
// 6 letters, in which case it spills into a second consecutive beat (see
// splitWordIntoBeats and beatsPerRow in rockWords.ts for why 6 is the line:
// a beat can only be evenly subdivided by real note values up to 6 slots at
// once). Either way the pattern is exactly as long as how many beats the
// guesses played so far actually needed, up to the game's own guess limit —
// which, for any grade needing 2 beats/row, is itself capped at 4 so the
// total never exceeds a pattern's own 8-beat ceiling (see effectiveMaxRows).
// Within one beat, the letters landing there subdivide it evenly (3 ->
// eighth-note triplets, 4 -> straight sixteenths, 5-6 -> sixteenth-note
// triplets, a 6th slot rested when only 5 land there):
//   - hit or present (the letter's in the word, right spot or not) -> a
//     plain, unaccented hit, the hand's part
//   - miss (wrong letter) -> no hand hit here at all; instead the kick (the
//     *other* limb, a foot) fills that exact slot, so a wrong letter still
//     gets a real, full-volume, undeniably-there hit without ever asking a
//     hand to be in two places at once.
// Deliberately no accents or ghost notes for these grades (K-12, today) —
// every hand/foot hit plays at the same plain velocity, which is simpler
// and more consistent to follow. Reserved as a tool for a future, even
// harder tier rather than used here.
// Any vowel among the letters landing in one beat (right or wrong) swaps
// that beat's hand part from snare to a tom — front vowels (e/i) -> High
// Tom, back vowels (a/o/u) -> Low Tom, mixed/tied -> Mid Tom — a different
// drum, still one hand, decided per beat rather than per whole row so a
// long word's two beats can each have their own color. The hi-hat keeps
// time on every beat, including the round's last one — unless that final
// guess wins *and* does it within the first half of the guesses this grade
// allows (see isEfficientWin), in which case that last beat swaps to a crash
// instead. An ordinary win still closes on the hi-hat like any other beat.
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
import { beatsPerRow, isEfficientWin, isVowel, isWinningGuess, LetterStatus, MaxRows, RockWordsRound } from "./rockWords";

const KICK: InstrumentId = "kick";
const HAND_A_DEFAULT: InstrumentId = "hihatClosed";
const HAND_A_ON_WIN: InstrumentId = "crash";
const HAND_B_DEFAULT: InstrumentId = "snare";

// How many letters land in one beat subdivide it evenly — chosen so the
// slots always sum to exactly one beat (a tile's own hard rule) with real
// note values: 3 fits eighth-note triplets exactly, 4 fits straight
// sixteenths exactly, and 5 doesn't evenly divide the note vocabulary this
// app has, so it takes 5 of a 6-slot sixteenth-note-triplet grid and rests
// the 6th (6 itself fills that same grid completely). Nothing here ever
// needs to go past 6 — see splitWordIntoBeats, which is what keeps a beat
// from ever being asked to hold more than 6 letters at once.
const SUBDIVISION_BY_COUNT: Record<number, { noteName: NoteName; slots: number }> = {
  1: { noteName: "quarter", slots: 1 },
  2: { noteName: "eighth", slots: 2 },
  3: { noteName: "eighthTriplet", slots: 3 },
  4: { noteName: "sixteenth", slots: 4 },
  5: { noteName: "sixteenthTriplet", slots: 6 },
  6: { noteName: "sixteenthTriplet", slots: 6 },
};

function subdivisionFor(letterCount: number): { noteName: NoteName; slots: number } {
  return SUBDIVISION_BY_COUNT[letterCount] ?? { noteName: "sixteenth", slots: letterCount };
}

// Splits a word's letters across however many beats it needs (see
// beatsPerRow), as evenly as possible rather than packing the first beat to
// its 6-letter max and leaving an awkward leftover — e.g. 7 letters becomes
// [4, 3], 11 becomes [6, 5], never [6, 1]. A word that already fits in one
// beat (<=6 letters) returns a single-element array unchanged.
export function splitWordIntoBeats(wordLength: number): number[] {
  const beats = beatsPerRow(wordLength);
  if (beats <= 1) return [wordLength];
  const base = Math.floor(wordLength / beats);
  const extra = wordLength % beats;
  return Array.from({ length: beats }, (_, i) => base + (i < extra ? 1 : 0));
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

// One beat's worth of a flattened, row-agnostic timeline — a long word's
// row becomes more than one of these (see splitWordIntoBeats), so
// everything downstream (hand/kick tiles, vowel color, the win-cymbal swap)
// operates on "the letters landing in this beat," never on "the whole row,"
// and never needs to know which original row a beat came from except for
// `isWinningBeat`.
interface BeatChunk {
  column: number;
  statuses: LetterStatus[];
  letters: string[];
  isWinningBeat: boolean;
}

function flattenIntoBeatChunks(rows: RockWordsRound[], maxRows: MaxRows): BeatChunk[] {
  const chunks: BeatChunk[] = [];
  let column = 0;
  rows.forEach((row, rowIndex) => {
    const letters = row.guess.toLowerCase().split("");
    const sizes = splitWordIntoBeats(letters.length);
    // Only an efficient win (see isEfficientWin) earns the crash — an
    // ordinary win still closes the pattern on the hi-hat like every other
    // beat, so the crash stays a marker of a genuinely good round instead of
    // firing identically every single time.
    const isRowWin =
      rowIndex === rows.length - 1 && isWinningGuess(row.statuses) && isEfficientWin(rows.length, maxRows);
    let offset = 0;
    sizes.forEach((size, chunkIndex) => {
      chunks.push({
        column,
        statuses: row.statuses.slice(offset, offset + size),
        letters: letters.slice(offset, offset + size),
        isWinningBeat: isRowWin && chunkIndex === sizes.length - 1,
      });
      offset += size;
      column++;
    });
  });
  return chunks;
}

export function generateRockWordsBeat(rows: RockWordsRound[], maxRows: MaxRows): LineData[] {
  const kickBlocks = emptyBlocks();
  const hihatBlocks = emptyBlocks();
  const crashBlocks = emptyBlocks();
  const snareBlocks = emptyBlocks();
  const lowTomBlocks = emptyBlocks();
  const midTomBlocks = emptyBlocks();
  const highTomBlocks = emptyBlocks();

  for (const chunk of flattenIntoBeatChunks(rows, maxRows)) {
    const { column } = chunk;
    // Guards against ever writing past a pattern's own MAX_BEATS ceiling —
    // shouldn't happen given effectiveMaxRows already keeps total beats
    // within budget, but a beat this generator can't actually hold is worth
    // silently dropping rather than corrupting a fixed-length blocks array.
    if (column >= MAX_BEATS) continue;

    // Hand A: the hi-hat keeps time on every beat except the very last one
    // of the round, which swaps to a crash instead when that final guess
    // actually wins — a substitution, so it's still ever only one hand's
    // hit at this beat.
    if (chunk.isWinningBeat) {
      crashBlocks[column] = HAND_A_TILE;
    } else {
      hihatBlocks[column] = HAND_A_TILE;
    }

    // Hand B: snare by default, swapped for a tom (never both) when the
    // letters landing in *this beat* include any vowel at all — still one
    // hand, just a different drum. Decided per beat, not per whole row, so
    // a long word's two beats can each have their own color.
    const handTile = buildHandTile(chunk.statuses);
    if (handTile) {
      const vowelsInBeat = chunk.letters.filter(isVowel);
      if (vowelsInBeat.length > 0) {
        const tomVoice = dominantVowelTom(vowelsInBeat);
        if (tomVoice === "lowTom") lowTomBlocks[column] = handTile;
        else if (tomVoice === "highTom") highTomBlocks[column] = handTile;
        else midTomBlocks[column] = handTile;
      } else {
        snareBlocks[column] = handTile;
      }
    }

    // The foot: picks up exactly the slots the hand rested on (the wrong
    // letters), so a miss still gets a real, undeniable hit without ever
    // needing a third hand.
    const kickTile = buildKickTile(chunk.statuses);
    if (kickTile) kickBlocks[column] = kickTile;
  }

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
    title: "One beat per guess row — two for a longer word",
    detail: "A word up to 6 letters fits in a single beat; longer than that (Grade 4 and up), it splits as evenly as possible across two consecutive beats instead (7 letters → 4+3, 11 → 6+5) — a beat can only be evenly subdivided by real note values up to 6 slots at once. The pattern is exactly as long as how many beats the guesses played so far actually needed.",
  },
  {
    title: "Playable by two hands and a foot, never more",
    detail: "At any instant this asks for at most one kick (a foot) plus one hit apiece from two hands — never a third simultaneous hand part. Extra colors (toms, crash) always substitute for a hand's part, never stack on top of it.",
  },
  {
    title: "Longer words mean fewer guesses",
    detail: "A pattern maxes out at 8 beats total, so a grade whose words need 2 beats each can only ever fit 4 guesses (4 × 2 = 8) — regardless of the admin's 4/6/8 setting, which only has room to matter for grades whose words still fit in 1 beat.",
  },
  {
    title: "A letter that's in the word → a plain hand hit",
    detail: "Right spot or not, a plain, unaccented hit, subdividing whichever beat it landed in evenly by how many letters share that beat (eighth-note triplets for 3, straight sixteenths for 4, sixteenth-note triplets for 5-6). No accents or ghost notes for any grade today — every hit plays at the same volume, which is simpler and more consistent to follow. Held in reserve as a tool for a future, even harder tier.",
  },
  {
    title: "Wrong letter → the kick takes that slot",
    detail: "The hand rests exactly where a letter was wrong — instead of silence, the kick (a foot, not a third hand) plays a real, full-volume hit in that same slot, so a wrong letter still lands somewhere audible without ever needing more limbs than a drummer has.",
  },
  {
    title: "Any vowel swaps the hand's drum, not its count",
    detail: "Whichever beat has a vowel in it (right or wrong) plays that beat's hand part on a tom instead of the snare — front vowels (e/i) → High Tom, back vowels (a/o/u) → Low Tom, mixed or tied → Mid Tom. Decided per beat, not per whole row, so a long word's two beats can each have their own color. Still one hand, just a different drum.",
  },
  {
    title: "The hi-hat holds time; a crash marks a genuinely efficient win",
    detail: "The hi-hat plays every beat of the round, including its last one — unless that final guess wins *and* it happened within the first half of the guesses this grade allows (round up), in which case the very last beat swaps to a crash cymbal instead. An ordinary win still closes on the hi-hat like any other beat, so the crash stays a marker of a fast solve rather than firing identically on every single win.",
  },
  {
    title: "Never depends on the answer",
    detail: "The beat is built purely from what was guessed and how it graded, never from the target word itself — identical whether the round is won or lost, and never gives anything away.",
  },
];
