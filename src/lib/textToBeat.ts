// Turns pasted text into up to four RockBlocks grooves — one per sentence,
// dropped into Slots A-D in order. The sentence's *time signature* comes
// first: its character count modulo 5, plus 3, lands somewhere in 3-7 beats
// (see beatsPerMeasureFor) — a plain, deterministic formula rather than
// however many blocks the words happened to fill, which in practice almost
// always maxed out at 7/4 regardless of what the text said. The core idea
// for filling those beats: each word becomes one beat-block, and its
// syllable count picks how many hits subdivide that beat (a 1-syllable word
// is a single quarter hit, a 6-syllable word fills the beat with the
// busiest tile in the catalog). A sentence with more words than the target
// measure needs is truncated; one with fewer cycles back to its first word
// rather than leaving the bar short of the time signature the text called
// for. Which instrument plays a given word's rhythm round-robins across
// kick/snare/closed hi-hat by the word's position in the sentence — the
// same trio random mode anchors on — so the beat reads as one groove shared
// across the kit rather than everything piling onto the kick while the
// rest of the kit sits idle.
//
// On top of that per-word mapping, two whole-sentence properties set a
// "groove profile" before any word is generated — borrowed from a melody
// generator (github.com/ryanfox — "The Rejection Remix") whose drum rules
// were an afterthought but whose *melody* rules had exactly the shape worth
// stealing: read a couple of cheap, whole-text signals (last punctuation
// mark, first word's length) into a small set of named profiles, then let
// every word's generation lean on that profile rather than each word being
// generated in isolation. Independently-random word-by-word output tends to
// sound like noise; a shared profile gives the whole groove one identity.
//   - Density curve (from the sentence's ending punctuation): "?" builds
//     density toward the end (a rising, anticipatory feel), "!" stays dense
//     throughout (immediate energy), anything else is flat/steady.
//   - Voice width (from the first word's length): a long opening word widens
//     the groove to a second tom color on the sentence's second-longest
//     word, not just its longest.
// Two more per-word rules, also lifted from the same source: a short list of
// common function words ("the", "a", "is", ...) always renders as a single
// plain hit, so filler doesn't compete rhythmically with real content — and
// a word's *first letter* can trigger a phonetic accent on top of its own
// rhythm (plosives like b/k/p read as a kick punch, fricatives like s/f/z as
// a hi-hat sizzle, tongue-taps like t/d as a snare tap) — sound-symbolism
// rather than randomness, so the same word always accents the same way.
//
// Punctuation also becomes accents on separate lines — comma, exclamation,
// and question mark each read as a distinct hit — and each sentence's
// longest word gets a tom accent colored by its dominant vowel. Paragraphs
// have no effect: only sentence boundaries and word boundaries matter.
import { InstrumentId } from "./instruments";
import { RhythmTile, getTileById, tileFromHits } from "./rhythm";
import { DEFAULT_VOLUME, LineData, MAX_BEATS } from "./song";

export const MAX_TEXT_LENGTH = 280; // matches X's per-post limit
export const MAX_TEXT_SLOTS = 4; // one sentence per board slot, A-D

// One word's worth of generation decisions, kept around purely for the
// "rules used" diagnostic panel (see TextToBeatButton.tsx) — every field
// here is something generateSlotFromSentence already decided, just surfaced
// instead of thrown away once the tile lands in a line's blocks.
export interface WordRuleTrace {
  word: string;
  isFunctionWord: boolean;
  syllables: number;
  voice: InstrumentId;
  hits: number;
  tileId: string;
  phoneticAccent: "kick" | "hihatOpen" | "snare" | null;
  comma: boolean;
  exclaim: boolean;
  question: boolean;
}

export interface SentenceRuleTrace {
  sentence: string;
  beatsPerMeasure: number;
  densityCurve: DensityCurve;
  voiceWidth: VoiceWidth;
  words: WordRuleTrace[];
  longestWord: string | null;
  longestWordTom: InstrumentId | null;
  secondWord: string | null;
  secondWordTom: InstrumentId | null;
}

export interface TextToBeatResult {
  slots: (LineData[] | null)[]; // always length 4, index 0-3 = A-D
  usedSentences: string[]; // the sentences actually mapped, in order
  totalSentences: number; // how many non-empty sentences the input had
  traces: (SentenceRuleTrace | null)[]; // parallel to slots — see WordRuleTrace
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

// Every catalog shape that fits a given onset count — straight subdivisions
// for 2-4 (the most a beat can hold in plain sixteenths), triplet
// subdivisions for 4-6 (the only way to fit that many onsets in one beat, or
// to lend a 4-onset word a different feel than the straight default).
// Previously each count mapped to exactly one fixed tile, which is why most
// generated beats read as a wall of identical quarter/8th-note shapes no
// matter what the text said — same word length, same rhythm, every time.
const HIT_TILE_VARIANTS: Record<number, string[]> = {
  2: ["n-e-e", "n-de-s", "n-s-de"],
  3: ["n-e-s-s", "n-s-e-s", "n-s-s-e"],
  4: ["n-s-s-s-s", "t-e2-s2", "t-s2-e2"],
  5: ["t-e-s4", "t-s-e-s3", "t-s2-e-s2", "t-s3-e-s", "t-s4-e"],
  6: ["t-s6"],
};

// Sums character codes rather than just using word length, so two
// same-length words don't collapse onto the same variant.
function wordSeed(word: string): number {
  let sum = 0;
  for (let i = 0; i < word.length; i++) sum += word.charCodeAt(i);
  return sum;
}

// A lone onset gets pushed off the downbeat into a rest+note eighth pair
// when the word starts with a vowel, instead of always landing as a flat
// quarter hit — a plain quarter note on every 1-syllable word (the most
// common case in plain English text) was the single biggest source of
// "dull," since it's the one shape every short word shared. Consonant
// starts (generally the more percussive-sounding onset) stay square on the
// beat; vowel starts land on the "and" — deterministic by the word's own
// first letter, so the same word always phrases the same way.
function tileForSingleHit(word: string): RhythmTile {
  const first = word[0]?.toLowerCase() ?? "";
  if ("aeiou".includes(first)) {
    return tileFromHits([
      { type: "rest", note: "eighth" },
      { type: "note", note: "eighth" },
    ]);
  }
  return getTileById("n-quarter")!;
}

function tileForHitCount(hits: number, word: string): RhythmTile {
  const clamped = Math.max(1, Math.min(6, hits));
  if (clamped === 1) return tileForSingleHit(word);
  const variants = HIT_TILE_VARIANTS[clamped];
  const id = variants[wordSeed(word) % variants.length];
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

// Common short function words — pronouns, articles, prepositions, auxiliary
// verbs — that carry little content of their own. Forcing these to a single
// plain hit (skipping density bonuses and phonetic accents) keeps them from
// competing rhythmically with the words actually worth emphasizing.
const FUNCTION_WORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "am",
  "to", "of", "in", "on", "at", "it", "as", "so", "if", "or", "and", "but",
  "my", "no", "we", "he", "she", "you", "i", "us", "me", "him", "her",
  "this", "that", "with", "for", "do", "did", "does",
]);

// Plosives read as a kick punch, fricatives/sibilants as a hi-hat sizzle,
// tongue-tap consonants as a crisp snare tap — sound-symbolism rather than
// randomness, so a word accents the same way every time it appears.
const PHONETIC_ACCENT: Record<string, "kick" | "hihatOpen" | "snare"> = {
  b: "kick", k: "kick", g: "kick", p: "kick", c: "kick",
  s: "hihatOpen", f: "hihatOpen", z: "hihatOpen", v: "hihatOpen", h: "hihatOpen",
  t: "snare", d: "snare", j: "snare",
};

// The three voices that trade off carrying each word's own syllable-rhythm
// — same trio random mode anchors on (kick, snare, closed hi-hat) — cycled
// by each word's position in the sentence. Previously every word's rhythm
// landed on the kick alone, so the kick dominated every groove regardless
// of what the text said; round-robining by index is the simplest rule that
// guarantees an even split while staying entirely deterministic.
const RHYTHM_VOICES: InstrumentId[] = ["kick", "snare", "hihatClosed"];

function rhythmVoiceForWord(index: number): InstrumentId {
  return RHYTHM_VOICES[index % RHYTHM_VOICES.length];
}

// Only fills an accent tile into a block that's still empty — a word's own
// rhythm (written first) always wins over an accent that would otherwise
// land on that same block, e.g. a comma on a word whose rhythm happened to
// round-robin onto the snare.
function setAccentIfClear(blocks: (RhythmTile | null)[], index: number): void {
  if (blocks[index] == null) blocks[index] = ACCENT_TILE;
}

export type DensityCurve = "steady" | "building" | "punchy";
export type VoiceWidth = "focused" | "wide";

// The sentence-wide "groove profile" — see the file header for why this
// exists at all: two cheap whole-sentence signals (ending punctuation,
// first word's length) set a shared identity that every word's generation
// leans on, instead of each word rolling independently.
function densityCurveFor(sentence: string): DensityCurve {
  const lastChar = sentence.trim().slice(-1);
  if (lastChar === "?") return "building";
  if (lastChar === "!") return "punchy";
  return "steady";
}

function voiceWidthFor(firstWord: string): VoiceWidth {
  return firstWord.length > 6 ? "wide" : "focused";
}

// How many extra syllable-hits a word's density curve adds, based on how
// far through the sentence it falls (0 = first word, 1 = last).
function densityBonus(curve: DensityCurve, position: number): number {
  if (curve === "punchy") return 1;
  if (curve === "building") return Math.floor(position * 2);
  return 0;
}

function nextTomVoice(tom: InstrumentId): InstrumentId {
  if (tom === "lowTom") return "midTom";
  if (tom === "midTom") return "highTom";
  return "lowTom";
}

const MIN_MEASURE_BEATS = 3;
const MAX_MEASURE_BEATS = MAX_BEATS; // 7 — the app's own per-pattern ceiling
const MEASURE_BEATS_OPTIONS = MAX_MEASURE_BEATS - MIN_MEASURE_BEATS + 1; // 3,4,5,6,7 = 5 choices

// Picks the sentence's time signature from its character count via a plain
// modulo, landing somewhere in 3-7 — a from-scratch beat used to almost
// always end up at 7/4 simply because that's the block-filling loop's hard
// ceiling, not because the text called for it. Character count (not word
// count) gives finer-grained, less clustered spread across the five
// options, and ties back to the feature's own 280-character framing.
function beatsPerMeasureFor(sentence: string): number {
  return MIN_MEASURE_BEATS + (sentence.trim().length % MEASURE_BEATS_OPTIONS);
}

interface SlotResult {
  lines: LineData[];
  trace: SentenceRuleTrace;
}

function generateSlotFromSentence(sentence: string): SlotResult | null {
  const words = splitWords(sentence);
  if (words.length === 0) return null;

  const curve = densityCurveFor(sentence);
  const width = voiceWidthFor(words[0].text);
  const beatsPerMeasure = beatsPerMeasureFor(sentence);

  const kickBlocks = emptyBlocks();
  const snareBlocks = emptyBlocks();
  const hihatClosedBlocks = emptyBlocks();
  const crashBlocks = emptyBlocks();
  const openHihatBlocks = emptyBlocks();
  const rhythmBlocksByVoice: Partial<Record<InstrumentId, (RhythmTile | null)[]>> = {
    kick: kickBlocks,
    snare: snareBlocks,
    hihatClosed: hihatClosedBlocks,
  };
  // Tracks the two longest *content* words (function words never qualify)
  // seen so far, longest first — the tom-accent candidates.
  let longestWord: { text: string; block: number; syllables: number } | null = null;
  let secondWord: { text: string; block: number; syllables: number } | null = null;
  const wordTraces: WordRuleTrace[] = [];

  // Cycles back to the sentence's first word if it runs out before filling
  // beatsPerMeasure — a short sentence in a wide measure repeats rather than
  // leaving the bar short of the time signature the text called for. A long
  // sentence simply stops early, same truncation as before. Either way each
  // word (repeats included) still gets its own round-robin voice turn and
  // density-curve position, both driven off the running slot index/block
  // position rather than the word array's own length.
  let blockIndex = 0;
  for (let wordSlot = 0; blockIndex < beatsPerMeasure; wordSlot++) {
    const word = words[wordSlot % words.length];
    const lower = word.text.toLowerCase();
    const isFunctionWord = FUNCTION_WORDS.has(lower);
    const startBlock = blockIndex;
    const voice = rhythmVoiceForWord(wordSlot);
    const rhythmBlocks = rhythmBlocksByVoice[voice]!;
    let phoneticAccent: WordRuleTrace["phoneticAccent"] = null;
    let hitsUsed = 0;
    let firstTileId = "";

    if (isFunctionWord) {
      const tile = tileForHitCount(1, word.text);
      rhythmBlocks[blockIndex] = tile;
      firstTileId = tile.id;
      hitsUsed = 1;
      blockIndex++;
    } else {
      const syllables = countSyllables(word.text);
      const candidate = { text: word.text, block: startBlock, syllables };
      if (!longestWord || syllables > longestWord.syllables) {
        secondWord = longestWord;
        longestWord = candidate;
      } else if (!secondWord || syllables > secondWord.syllables) {
        secondWord = candidate;
      }

      let remaining = syllables + densityBonus(curve, startBlock / Math.max(1, beatsPerMeasure - 1));
      while (remaining > 0 && blockIndex < beatsPerMeasure) {
        const hits = Math.min(remaining, 6);
        const tile = tileForHitCount(hits, word.text);
        rhythmBlocks[blockIndex] = tile;
        if (firstTileId === "") firstTileId = tile.id;
        hitsUsed += hits;
        remaining -= hits;
        blockIndex++;
      }

      const accent = PHONETIC_ACCENT[lower[0]];
      if (accent === "hihatOpen") { setAccentIfClear(openHihatBlocks, startBlock); phoneticAccent = "hihatOpen"; }
      else if (accent === "snare") { setAccentIfClear(snareBlocks, startBlock); phoneticAccent = "snare"; }
      else if (accent === "kick") { setAccentIfClear(kickBlocks, startBlock); phoneticAccent = "kick"; }
    }
    const endBlock = blockIndex - 1;

    if (word.comma) setAccentIfClear(snareBlocks, endBlock);
    if (word.exclaim) setAccentIfClear(crashBlocks, startBlock);
    if (word.question) setAccentIfClear(openHihatBlocks, startBlock);

    wordTraces.push({
      word: word.text,
      isFunctionWord,
      syllables: isFunctionWord ? 0 : countSyllables(word.text),
      voice,
      hits: hitsUsed,
      tileId: firstTileId,
      phoneticAccent,
      comma: word.comma,
      exclaim: word.exclaim,
      question: word.question,
    });
  }

  const lines: LineData[] = [];
  if (kickBlocks.some(Boolean)) {
    lines.push({ id: randomLineId(0), instrument: "kick", blocks: kickBlocks, volume: DEFAULT_VOLUME });
  }
  if (snareBlocks.some(Boolean)) {
    lines.push({ id: randomLineId(1), instrument: "snare", blocks: snareBlocks, volume: DEFAULT_VOLUME });
  }
  if (hihatClosedBlocks.some(Boolean)) {
    lines.push({ id: randomLineId(6), instrument: "hihatClosed", blocks: hihatClosedBlocks, volume: DEFAULT_VOLUME });
  }
  if (crashBlocks.some(Boolean)) {
    lines.push({ id: randomLineId(2), instrument: "crash", blocks: crashBlocks, volume: DEFAULT_VOLUME });
  }
  if (openHihatBlocks.some(Boolean)) {
    lines.push({ id: randomLineId(3), instrument: "hihatOpen", blocks: openHihatBlocks, volume: DEFAULT_VOLUME });
  }
  // Only accent a real multi-syllable word — a sentence of all 1-syllable
  // words has no standout to color.
  let longestWordTom: InstrumentId | null = null;
  let secondWordTom: InstrumentId | null = null;
  if (longestWord && longestWord.syllables >= 2) {
    const tomBlocks = emptyBlocks();
    tomBlocks[longestWord.block] = ACCENT_TILE;
    const tomVoice = dominantVowelTom(longestWord.text);
    longestWordTom = tomVoice;
    lines.push({ id: randomLineId(4), instrument: tomVoice, blocks: tomBlocks, volume: DEFAULT_VOLUME });

    // A wide-voiced sentence spreads a second tom color onto the runner-up
    // word instead of leaving every other word to the kick alone.
    if (width === "wide" && secondWord && secondWord.syllables >= 2 && secondWord.block !== longestWord.block) {
      const secondTomBlocks = emptyBlocks();
      secondTomBlocks[secondWord.block] = ACCENT_TILE;
      let secondVoice = dominantVowelTom(secondWord.text);
      if (secondVoice === tomVoice) secondVoice = nextTomVoice(secondVoice);
      secondWordTom = secondVoice;
      lines.push({ id: randomLineId(5), instrument: secondVoice, blocks: secondTomBlocks, volume: DEFAULT_VOLUME });
    }
  }

  const trace: SentenceRuleTrace = {
    sentence,
    beatsPerMeasure,
    densityCurve: curve,
    voiceWidth: width,
    words: wordTraces,
    longestWord: longestWord && longestWord.syllables >= 2 ? longestWord.text : null,
    longestWordTom,
    secondWord: width === "wide" && secondWordTom ? secondWord!.text : null,
    secondWordTom,
  };

  return { lines, trace };
}

export function generateBeatFromText(text: string): TextToBeatResult {
  const clipped = text.slice(0, MAX_TEXT_LENGTH);
  const sentences = splitSentences(clipped).filter((s) => splitWords(s).length > 0);
  const used = sentences.slice(0, MAX_TEXT_SLOTS);

  const results = used.map((s) => generateSlotFromSentence(s));
  const slots: (LineData[] | null)[] = results.map((r) => r?.lines ?? null);
  const traces: (SentenceRuleTrace | null)[] = results.map((r) => r?.trace ?? null);
  while (slots.length < MAX_TEXT_SLOTS) slots.push(null);
  while (traces.length < MAX_TEXT_SLOTS) traces.push(null);

  return { slots, usedSentences: used, totalSentences: sentences.length, traces };
}
