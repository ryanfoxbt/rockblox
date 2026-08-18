// Turns pasted text into up to four RockBlocks grooves — one per sentence,
// dropped into Slots A-D in order. The core idea: each word becomes one
// beat-block, and its syllable count picks how many hits subdivide that
// beat (a 1-syllable word is a single quarter hit, a 6-syllable word fills
// the beat with the busiest tile in the catalog). Punctuation becomes
// accents on separate lines — comma, exclamation, and question mark each
// read as a distinct hit — and each sentence's longest word gets a tom
// accent colored by its dominant vowel. Paragraphs have no effect: only
// sentence boundaries and word boundaries matter.
import { InstrumentId } from "./instruments";
import { RhythmTile, getTileById } from "./rhythm";
import { DEFAULT_VOLUME, LineData, MAX_BEATS } from "./song";

export const MAX_TEXT_LENGTH = 280; // matches X's per-post limit
export const MAX_TEXT_SLOTS = 4; // one sentence per board slot, A-D

export interface TextToBeatResult {
  slots: (LineData[] | null)[]; // always length 4, index 0-3 = A-D
  usedSentences: string[]; // the sentences actually mapped, in order
  totalSentences: number; // how many non-empty sentences the input had
}

// A syllable-counting heuristic, not a dictionary lookup — vowel-group
// counting with a few common-case fixes: a silent trailing "e" (except
// after a consonant + "le", which forms its own syllable, as in "table"),
// a silent "-ed" when it doesn't follow t/d ("covered" vs. "wanted"), and
// splitting "ia"/"ua" pairs that are almost always two syllables in
// English ("reliable", "actual") rather than a diphthong. It won't be
// linguistically perfect for every word, but it's close enough to read as
// "the rhythm of the word" for this purpose.
export function countSyllables(rawWord: string): number {
  const word = rawWord.toLowerCase().replace(/[^a-z]/g, "");
  if (word.length === 0) return 0;
  if (word.length <= 3) return 1;

  let w = word.replace(/([^aeioutd])ed$/, "$1");
  if (!/[^aeiou]le$/.test(w)) w = w.replace(/e$/, "");
  w = w.replace(/([iu])a/g, "$1 a");

  const groups = w.match(/[aeiouy]+/g) || [];
  return Math.max(1, groups.length);
}

interface Word {
  text: string;
  comma: boolean;
  exclaim: boolean;
  question: boolean;
}

// Splits on runs of non-terminator characters followed by any trailing
// .!? — keeps the terminator attached so a later pass can still see it,
// though only sentence *boundaries* matter here, not which mark ended one.
function splitSentences(text: string): string[] {
  return (text.match(/[^.!?]+[.!?]*/g) || []).map((s) => s.trim()).filter(Boolean);
}

function splitWords(sentence: string): Word[] {
  return sentence
    .split(/\s+/)
    .map((token) => ({
      text: token.replace(/[^a-zA-Z]/g, ""),
      comma: token.includes(","),
      exclaim: token.includes("!"),
      question: token.includes("?"),
    }))
    .filter((w) => w.text.length > 0);
}

// Maps a hit count (1-6) to a specific catalog tile — straight subdivisions
// for 1-4 (the most a beat can hold in plain sixteenths), triplet
// subdivisions for 5-6 (the only way to fit that many onsets in one beat).
const HITS_TO_TILE_ID: Record<number, string> = {
  1: "n-quarter",
  2: "n-e-e",
  3: "n-e-s-s",
  4: "n-s-s-s-s",
  5: "t-e-s4",
  6: "t-s6",
};

function tileForHitCount(hits: number): RhythmTile {
  const id = HITS_TO_TILE_ID[Math.max(1, Math.min(6, hits))];
  return getTileById(id)!;
}

// A single accent hit, reused across every accent line (comma/!/?/tom) —
// these are always one-shot hits, never subdivided.
const ACCENT_TILE = getTileById("n-quarter")!;

// Front vowels (e/i) read as tighter/higher, back vowels (a/o) as
// rounder/lower — a loose but defensible echo of vowel formant frequency,
// used to pick which tom accents a sentence's longest word.
function dominantVowelTom(word: string): InstrumentId {
  let back = 0;
  let front = 0;
  for (const ch of word.toLowerCase()) {
    if (ch === "a" || ch === "o") back++;
    else if (ch === "e" || ch === "i") front++;
  }
  if (back === 0 && front === 0) return "midTom";
  return back >= front ? "lowTom" : "highTom";
}

function randomLineId(index: number): string {
  return `line-${index}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyBlocks(): (RhythmTile | null)[] {
  return Array(MAX_BEATS).fill(null);
}

function generateSlotFromSentence(sentence: string): LineData[] | null {
  const words = splitWords(sentence);
  if (words.length === 0) return null;

  const kickBlocks = emptyBlocks();
  const snareBlocks = emptyBlocks();
  const crashBlocks = emptyBlocks();
  const openHihatBlocks = emptyBlocks();
  let longestWord: { text: string; block: number; syllables: number } | null = null;

  let blockIndex = 0;
  for (const word of words) {
    if (blockIndex >= MAX_BEATS) break;
    const syllables = countSyllables(word.text);
    if (!longestWord || syllables > longestWord.syllables) {
      longestWord = { text: word.text, block: blockIndex, syllables };
    }

    const startBlock = blockIndex;
    let remaining = syllables;
    while (remaining > 0 && blockIndex < MAX_BEATS) {
      const hits = Math.min(remaining, 6);
      kickBlocks[blockIndex] = tileForHitCount(hits);
      remaining -= hits;
      blockIndex++;
    }
    const endBlock = blockIndex - 1;

    if (word.comma) snareBlocks[endBlock] = ACCENT_TILE;
    if (word.exclaim) crashBlocks[startBlock] = ACCENT_TILE;
    if (word.question) openHihatBlocks[startBlock] = ACCENT_TILE;
  }

  const lines: LineData[] = [{ id: randomLineId(0), instrument: "kick", blocks: kickBlocks, volume: DEFAULT_VOLUME }];
  if (snareBlocks.some(Boolean)) {
    lines.push({ id: randomLineId(1), instrument: "snare", blocks: snareBlocks, volume: DEFAULT_VOLUME });
  }
  if (crashBlocks.some(Boolean)) {
    lines.push({ id: randomLineId(2), instrument: "crash", blocks: crashBlocks, volume: DEFAULT_VOLUME });
  }
  if (openHihatBlocks.some(Boolean)) {
    lines.push({ id: randomLineId(3), instrument: "hihatOpen", blocks: openHihatBlocks, volume: DEFAULT_VOLUME });
  }
  // Only accent a real multi-syllable word — a sentence of all 1-syllable
  // words has no standout to color.
  if (longestWord && longestWord.syllables >= 2) {
    const tomBlocks = emptyBlocks();
    tomBlocks[longestWord.block] = ACCENT_TILE;
    lines.push({
      id: randomLineId(4),
      instrument: dominantVowelTom(longestWord.text),
      blocks: tomBlocks,
      volume: DEFAULT_VOLUME,
    });
  }

  return lines;
}

export function generateBeatFromText(text: string): TextToBeatResult {
  const clipped = text.slice(0, MAX_TEXT_LENGTH);
  const sentences = splitSentences(clipped).filter((s) => splitWords(s).length > 0);
  const used = sentences.slice(0, MAX_TEXT_SLOTS);

  const slots: (LineData[] | null)[] = used.map((s) => generateSlotFromSentence(s));
  while (slots.length < MAX_TEXT_SLOTS) slots.push(null);

  return { slots, usedSentences: used, totalSentences: sentences.length };
}
