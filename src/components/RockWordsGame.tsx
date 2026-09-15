"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import { RockBloxPlayer } from "@/lib/audioEngine";
import { DEFAULT_KIT } from "@/lib/drumKits";
import { saveDraft } from "@/lib/draftStorage";
import { generateRockWordsBeat } from "@/lib/rockWordsBeat";
import {
  evaluateGuess,
  isVowel,
  isWinningGuess,
  LetterStatus,
  MaxRows,
  RockWordsGrade,
  ROWS_PER_BLOCK,
  RockWordsRound,
} from "@/lib/rockWords";
import { serializeLines } from "@/lib/song";

export interface RockWordsRoundData {
  id: number;
  word: string;
  clue: string;
  clueShownByDefault: boolean;
}

// Checks a guess against a real dictionary (see the API route for why: a
// free lookup a kid learns from, not just a puzzle mechanic) before it's
// allowed to consume one of their limited guesses. Fails open — a network
// hiccup or a slow/unreachable third party lets the guess through rather
// than blocking play over our own plumbing.
async function isRealWord(word: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/rockwords/validate-word?word=${encodeURIComponent(word)}`);
    if (!res.ok) return true;
    const data = (await res.json().catch(() => null)) as { valid?: boolean } | null;
    return data?.valid !== false;
  } catch {
    return true;
  }
}

const RECENT_LIMIT = 6;

function recentKey(gradeSlug: string): string {
  return `rockwords:recent:${gradeSlug}`;
}

function loadRecentIds(gradeSlug: string): number[] {
  try {
    const raw = window.localStorage.getItem(recentKey(gradeSlug));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((n) => typeof n === "number") : [];
  } catch {
    return [];
  }
}

function saveRecentId(gradeSlug: string, id: number) {
  try {
    const next = [id, ...loadRecentIds(gradeSlug).filter((n) => n !== id)].slice(0, RECENT_LIMIT);
    window.localStorage.setItem(recentKey(gradeSlug), JSON.stringify(next));
  } catch {
    // Best-effort only — a blocked/full localStorage just means replays
    // might repeat a word sooner than usual, nothing worse.
  }
}

// Outer wrapper: owns which round is currently loaded and how "Play Again"
// fetches the next one. Actual gameplay state (guesses, current input, clue
// visibility, ...) lives in RoundPlay below, remounted fresh per round via
// `key={round.id}` — simpler and safer than hand-resetting a dozen pieces of
// state whenever the round changes.
export function RockWordsGame({
  grade,
  initialRound,
  maxRows,
}: {
  grade: RockWordsGrade;
  initialRound: RockWordsRoundData;
  maxRows: MaxRows;
}) {
  const [round, setRound] = useState(initialRound);
  const [loadingNext, setLoadingNext] = useState(false);

  useEffect(() => {
    saveRecentId(grade.slug, initialRound.id);
    // Only ever seed the recent list with the round this component mounted
    // with — later rounds are recorded as they're fetched, in playAgain.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const playAgain = useCallback(async () => {
    setLoadingNext(true);
    try {
      const exclude = loadRecentIds(grade.slug).join(",");
      const res = await fetch(`/api/rockwords/word?grade=${grade.grade}&exclude=${exclude}`);
      const data = (await res.json().catch(() => null)) as { round?: RockWordsRoundData } | null;
      if (res.ok && data?.round) {
        saveRecentId(grade.slug, data.round.id);
        setRound(data.round);
      }
    } finally {
      setLoadingNext(false);
    }
  }, [grade.grade, grade.slug]);

  return (
    <RoundPlay
      key={round.id}
      grade={grade}
      round={round}
      maxRows={maxRows}
      onPlayAgain={playAgain}
      loadingNext={loadingNext}
    />
  );
}

interface KeyboardRowProps {
  rows: string[][];
  keyStatus: Map<string, LetterStatus>;
  onKey: (letter: string) => void;
  onEnter: () => void;
  onBackspace: () => void;
  disabled: boolean;
}

const KEY_COLOR: Record<LetterStatus | "unknown", string> = {
  hit: "bg-green-600 text-white border-green-500",
  present: "bg-amber-500 text-slate-900 border-amber-400",
  miss: "bg-slate-700 text-white/40 border-slate-600",
  unknown: "bg-white/10 text-white/80 border-white/15 hover:border-yellow-400",
};

function OnScreenKeyboard({ rows, keyStatus, onKey, onEnter, onBackspace, disabled }: KeyboardRowProps) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      {rows.map((row, i) => (
        <div key={i} className="flex gap-1">
          {i === rows.length - 1 && (
            <button
              type="button"
              disabled={disabled}
              onClick={onEnter}
              className="rounded-md border border-white/15 bg-white/10 px-2 text-[10px] font-bold uppercase text-white/70 transition hover:border-yellow-400 disabled:opacity-30"
            >
              Enter
            </button>
          )}
          {row.map((letter) => (
            <button
              key={letter}
              type="button"
              disabled={disabled}
              onClick={() => onKey(letter)}
              className={`h-9 w-7 rounded-md border text-sm font-bold uppercase transition disabled:opacity-30 sm:w-8 ${
                KEY_COLOR[keyStatus.get(letter) ?? "unknown"]
              }`}
            >
              {letter}
            </button>
          ))}
          {i === rows.length - 1 && (
            <button
              type="button"
              disabled={disabled}
              onClick={onBackspace}
              className="rounded-md border border-white/15 bg-white/10 px-2 text-[10px] font-bold uppercase text-white/70 transition hover:border-red-400 disabled:opacity-30"
            >
              ⌫
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

const KEYBOARD_ROWS = [
  "qwertyuiop".split(""),
  "asdfghjkl".split(""),
  "zxcvbnm".split(""),
];

const CELL_COLOR: Record<LetterStatus, string> = {
  hit: "border-green-500 bg-green-600 text-white",
  present: "border-amber-400 bg-amber-500 text-slate-900",
  miss: "border-slate-600 bg-slate-700 text-white/50",
};

// Every Block is sized to this same square footprint regardless of grade or
// row-config — cells are rectangular (word-length columns × rows-per-block
// rows dividing the same fixed side) rather than forced square themselves,
// which is what actually makes the *block* read as a square "Block" tile
// (on brand with the app's own 2×2 logo) instead of a tall rectangle for a
// short word or a wide one for a long word.
const BLOCK_SIDE_PX = 220;

function cellSizeForBlock(cols: number, rowsInBlock: number): { width: number; height: number } {
  return {
    width: Math.round(BLOCK_SIDE_PX / cols),
    height: Math.round(BLOCK_SIDE_PX / rowsInBlock),
  };
}

interface BlockRow {
  key: string;
  letters: string[];
  statuses?: LetterStatus[];
}

function RoundPlay({
  grade,
  round,
  maxRows,
  onPlayAgain,
  loadingNext,
}: {
  grade: RockWordsGrade;
  round: RockWordsRoundData;
  maxRows: MaxRows;
  onPlayAgain: () => void;
  loadingNext: boolean;
}) {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const isSignedIn = !!session?.user;

  const [guesses, setGuesses] = useState<RockWordsRound[]>([]);
  const [currentInput, setCurrentInput] = useState("");
  const [clueVisible, setClueVisible] = useState(round.clueShownByDefault);
  const [shake, setShake] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [checkingWord, setCheckingWord] = useState(false);
  const [notAWordMessage, setNotAWordMessage] = useState<string | null>(null);

  const playerRef = useRef<RockBloxPlayer | null>(null);
  useEffect(() => {
    return () => {
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, []);

  const lastWin = guesses.length > 0 && isWinningGuess(guesses[guesses.length - 1].statuses);
  const phase: "playing" | "won" | "lost" = lastWin ? "won" : guesses.length >= maxRows ? "lost" : "playing";

  // One guess row is one beat of the measure (see generateRockWordsBeat's
  // own comment), so the measure is exactly as long as how many guesses
  // have actually been played — not the word length, and not the game's
  // guess limit until every allowed guess has actually been used.
  const beatLines = useMemo(() => generateRockWordsBeat(guesses), [guesses]);

  const playBeatSoFar = useCallback(() => {
    if (beatLines.length === 0) return;
    if (!playerRef.current) playerRef.current = new RockBloxPlayer(DEFAULT_KIT);
    const player = playerRef.current;
    player.updateSong(beatLines, grade.bpm, guesses.length, null);
    if (player.isPlaying()) player.stop();
    void player.playOnce(() => {});
  }, [beatLines, grade.bpm, guesses.length]);

  // Auto-plays the accumulated beat right after each submitted guess — kids
  // hear their own song grow with every row, not just when they press play.
  const playedRowsRef = useRef(0);
  useEffect(() => {
    if (guesses.length > playedRowsRef.current) {
      playedRowsRef.current = guesses.length;
      playBeatSoFar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guesses.length]);

  const keyStatus = useMemo(() => {
    const map = new Map<string, LetterStatus>();
    const rank: Record<LetterStatus, number> = { miss: 0, present: 1, hit: 2 };
    for (const g of guesses) {
      for (let i = 0; i < g.guess.length; i++) {
        const letter = g.guess[i];
        const status = g.statuses[i];
        const existing = map.get(letter);
        if (!existing || rank[status] > rank[existing]) map.set(letter, status);
      }
    }
    return map;
  }, [guesses]);

  const submitGuess = useCallback(async () => {
    if (checkingWord || phase !== "playing" || currentInput.length !== grade.wordLength) {
      setShake(true);
      window.setTimeout(() => setShake(false), 400);
      return;
    }
    const guess = currentInput.toLowerCase();
    setCheckingWord(true);
    const real = await isRealWord(guess);
    setCheckingWord(false);
    if (!real) {
      setNotAWordMessage(`"${guess.toUpperCase()}" isn't a real word — try again!`);
      setShake(true);
      window.setTimeout(() => setShake(false), 400);
      return;
    }
    const statuses = evaluateGuess(guess, round.word);
    setGuesses((prev) => [...prev, { guess, statuses }]);
    setCurrentInput("");
  }, [checkingWord, currentInput, grade.wordLength, phase, round.word]);

  const typeLetter = useCallback(
    (letter: string) => {
      if (phase !== "playing" || checkingWord) return;
      setNotAWordMessage(null);
      setCurrentInput((prev) => (prev.length < grade.wordLength ? prev + letter : prev));
    },
    [checkingWord, grade.wordLength, phase]
  );

  const backspace = useCallback(() => {
    if (phase !== "playing" || checkingWord) return;
    setNotAWordMessage(null);
    setCurrentInput((prev) => prev.slice(0, -1));
  }, [checkingWord, phase]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (phase !== "playing") return;
      if (e.key === "Enter") void submitGuess();
      else if (e.key === "Backspace") backspace();
      else if (/^[a-zA-Z]$/.test(e.key)) typeLetter(e.key.toLowerCase());
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [phase, submitGuess, backspace, typeLetter]);

  // Not logged in: hand the beat straight to the homepage's own scratchpad
  // (the same localStorage draft Editor.tsx already restores from on load —
  // see draftStorage.ts) and go there — no page to name or claim. Logged
  // in: save it as a private song to their account instead, the same shape
  // /api/my-songs already accepts, then go straight to it.
  async function keepRockin() {
    if (beatLines.length === 0) return;
    if (!isSignedIn) {
      saveDraft({ bpm: grade.bpm, lines: serializeLines(beatLines), kit: DEFAULT_KIT, customSamples: {} });
      router.push("/");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/my-songs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `RockWords: ${round.word.toUpperCase()}`,
          slots: { A: { bpm: grade.bpm, lines: serializeLines(beatLines), kit: DEFAULT_KIT } },
        }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string; id?: string } | null;
      if (!res.ok || !data?.id) {
        setSaveError(data?.error ?? "Couldn't save — try again.");
        setSaving(false);
        return;
      }
      router.push(`/my/${data.id}`);
    } catch {
      setSaveError("Couldn't save — try again.");
      setSaving(false);
    }
  }

  const blockSizes = ROWS_PER_BLOCK[maxRows];
  const blockStarts = useMemo(() => {
    const starts: number[] = [];
    let acc = 0;
    for (const size of blockSizes) {
      starts.push(acc);
      acc += size;
    }
    return starts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxRows]);

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setClueVisible((v) => !v)}
          className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/70 transition hover:border-yellow-400 hover:text-yellow-400"
        >
          {clueVisible ? "🙈 Hide clue" : "💡 Show clue"}
        </button>
        <button
          type="button"
          onClick={onPlayAgain}
          disabled={loadingNext}
          className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/70 transition hover:border-yellow-400 hover:text-yellow-400 disabled:opacity-40"
        >
          {loadingNext ? "Loading…" : "🔄 New word"}
        </button>
      </div>

      {clueVisible && (
        <p className="max-w-xs rounded-md border border-yellow-400/30 bg-yellow-400/10 px-3 py-2 text-center text-sm text-yellow-200">
          {round.clue}
        </p>
      )}

      {notAWordMessage && (
        <p className="max-w-xs rounded-md border border-red-400/30 bg-red-400/10 px-3 py-2 text-center text-sm text-red-300">
          {notAWordMessage}
        </p>
      )}

      <div className={`flex flex-row flex-wrap justify-center gap-4 ${shake ? "animate-pulse" : ""}`}>
        {blockSizes.map((size, b) => {
          const start = blockStarts[b];
          if (guesses.length < start) return null; // this block hasn't started yet

          const completedInBlock = Math.max(0, Math.min(size, guesses.length - start));
          const isActiveBlock = guesses.length >= start && guesses.length < start + size;
          const visibleInBlock =
            phase === "playing" && isActiveBlock ? Math.min(size, completedInBlock + 1) : completedInBlock;
          // Cells are rectangular (not forced square) so the *block* itself
          // reads as a square "Block" tile — see cellSizeForBlock.
          const { width: cellW, height: cellH } = cellSizeForBlock(grade.wordLength, size);
          const fontPx = Math.round(Math.min(cellW, cellH) * 0.42);

          const rows: BlockRow[] = Array.from({ length: visibleInBlock }, (_, r) => {
            const absolute = start + r;
            const submitted = guesses[absolute];
            if (submitted) return { key: `${b}-${r}`, letters: submitted.guess.split(""), statuses: submitted.statuses };
            return { key: `${b}-${r}`, letters: currentInput.split("") };
          });

          return (
            <div
              key={b}
              className={`flex flex-col gap-1.5 border-4 p-2 transition-colors ${
                phase !== "playing" ? "border-yellow-400" : "border-white/15"
              }`}
            >
              {rows.map((row) => (
                <div key={row.key} className="flex gap-1.5">
                  {Array.from({ length: grade.wordLength }, (_, col) => {
                    const letter = row.letters[col];
                    const status = row.statuses?.[col];
                    return (
                      <div
                        key={col}
                        style={{ height: cellH, width: cellW, fontSize: fontPx }}
                        className={`flex items-center justify-center rounded-md border-2 font-black uppercase ${
                          status
                            ? CELL_COLOR[status]
                            : letter
                              ? "border-white/40 bg-transparent text-white"
                              : "border-white/15 bg-white/5 text-white"
                        }`}
                      >
                        {letter ?? ""}
                        {status && isVowel(letter!) && <span className="sr-only"> (vowel)</span>}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <OnScreenKeyboard
        rows={KEYBOARD_ROWS}
        keyStatus={keyStatus}
        onKey={typeLetter}
        onEnter={() => void submitGuess()}
        onBackspace={backspace}
        disabled={phase !== "playing" || checkingWord}
      />
      {checkingWord && <p className="text-xs text-white/40">Checking that word…</p>}

      <button
        type="button"
        onClick={playBeatSoFar}
        disabled={beatLines.length === 0}
        className="rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-sm font-medium text-white/70 transition hover:border-yellow-400 hover:text-yellow-400 disabled:opacity-30"
      >
        ▶ Play beat so far
      </button>

      {phase !== "playing" && (
        <div className="flex w-full max-w-xs flex-col items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-4 text-center">
          <p className="text-lg font-bold">
            {phase === "won" ? "🎉 You got it!" : `The word was "${round.word.toUpperCase()}"`}
          </p>
          <p className="text-sm text-white/60">
            {isSignedIn
              ? "You just built a real drum beat out of this round — save it to your account and keep playing with it: change the kit, add more sounds, see the sheet music."
              : "You just built a real drum beat out of this round — take it into RockBlocks to keep playing with it: change the kit, add more sounds, see the sheet music, or save a copy."}
          </p>
          {saveError && <p className="text-sm text-red-400">{saveError}</p>}
          <button
            type="button"
            onClick={keepRockin}
            disabled={saving}
            className="w-full rounded-full bg-yellow-400 px-4 py-1.5 text-sm font-bold text-slate-900 transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "Saving…" : isSignedIn ? "💾 Save to My Songs" : "🥁 Keep Rockin’ in RockBlocks"}
          </button>
          <button
            type="button"
            onClick={onPlayAgain}
            disabled={loadingNext}
            className="text-xs text-white/50 underline decoration-dotted transition hover:text-yellow-400"
          >
            or play another word
          </button>
        </div>
      )}
    </div>
  );
}
