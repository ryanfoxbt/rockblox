"use client";

import { useState } from "react";
import { BoardData, SLOT_LETTERS, SlotLetter } from "@/lib/board";
import { DEFAULT_KIT } from "@/lib/drumKits";
import { serializeLines } from "@/lib/song";
import { generateBeatFromText, MAX_TEXT_LENGTH, MAX_TEXT_SLOTS, TextToBeatResult } from "@/lib/textToBeat";

const GENERATED_BPM = 100;

// Paste-text-get-a-beat, for a brand new, still-empty page — see
// Editor.tsx for the "blank board only" gate. One sentence becomes one
// slot's groove (see lib/textToBeat.ts for the word-rhythm mapping), so
// this can fill all of Slots A-D in one go from a single tweet-length
// paste, then save straight to the board (bypassing the single-slot
// in-memory editor state, same as SongImportButton does for song imports).
export function TextToBeatButton({ board }: { board: BoardData }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [result, setResult] = useState<TextToBeatResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    setOpen(false);
    setText("");
    setResult(null);
    setSaving(false);
    setSaved(false);
    setError(null);
  }

  function generate() {
    setResult(generateBeatFromText(text));
    setSaved(false);
    setError(null);
  }

  async function save() {
    if (!result) return;
    const toSave = SLOT_LETTERS
      .map((slot, i) => ({ slot, lines: result.slots[i] }))
      .filter((s): s is { slot: SlotLetter; lines: NonNullable<(typeof s)["lines"]> } => !!s.lines);
    if (toSave.length === 0) return;

    setSaving(true);
    setError(null);
    try {
      const responses = await Promise.all(
        toSave.map(({ slot, lines }) =>
          fetch(`/api/boards/${board.slug}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ slot, bpm: GENERATED_BPM, lines: serializeLines(lines), kit: DEFAULT_KIT }),
          })
        )
      );
      if (responses.every((r) => r.ok)) setSaved(true);
      else setError("Couldn't save one or more slots — try again.");
    } catch {
      setError("Couldn't save — try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Turn pasted text into a beat"
        className="shrink-0 rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-sm font-medium text-white/80 transition hover:border-yellow-400 hover:text-yellow-400"
      >
        🐦 Text to Beat
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={close}>
          <div
            className="w-full max-w-md rounded-lg border border-white/15 bg-slate-900 p-5 text-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">🐦 Text to Beat</h2>
              <button
                type="button"
                onClick={close}
                title="Close"
                className="rounded-md px-2 py-0.5 text-white/50 transition hover:text-red-400"
              >
                ✕
              </button>
            </div>

            <p className="mb-3 text-xs text-white/50">
              Paste up to {MAX_TEXT_LENGTH} characters (tweet-length). Each sentence becomes one groove — word
              rhythm comes from syllable count, commas/!/? become accents — dropped into{" "}
              <span className="font-mono text-yellow-400">Slots A-D</span>, one sentence per slot.
            </p>

            <textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setResult(null);
                setSaved(false);
              }}
              maxLength={MAX_TEXT_LENGTH}
              rows={4}
              placeholder="She quickly discovered alternative conceptualizations."
              className="w-full resize-none rounded-md border border-white/15 bg-white/5 p-2 text-sm text-white placeholder:text-white/30 focus:border-yellow-400 focus:outline-none"
            />
            <p className="mt-1 text-right text-xs text-white/40">
              {text.length}/{MAX_TEXT_LENGTH}
            </p>

            {!result && (
              <button
                type="button"
                onClick={generate}
                disabled={text.trim().length === 0}
                className="mt-2 w-full rounded-full bg-yellow-400 px-4 py-1.5 text-sm font-bold text-slate-900 transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Generate
              </button>
            )}

            {result && (
              <div className="mt-3 flex flex-col gap-3">
                {result.usedSentences.length === 0 ? (
                  <p className="text-sm text-red-400">
                    Couldn&apos;t find a sentence in there — try adding some words.
                  </p>
                ) : (
                  <>
                    {result.totalSentences > MAX_TEXT_SLOTS && (
                      <p className="text-xs text-white/50">
                        Using the first {MAX_TEXT_SLOTS} of {result.totalSentences} sentences.
                      </p>
                    )}
                    <ul className="flex flex-col gap-1.5">
                      {SLOT_LETTERS.map((slot, i) => {
                        const lines = result.slots[i];
                        const sentence = result.usedSentences[i];
                        return (
                          <li
                            key={slot}
                            className="flex items-center justify-between gap-3 rounded-md border border-white/10 px-3 py-1.5 text-sm"
                          >
                            <span className="min-w-0 flex-1 truncate text-white/80">
                              <span className="font-mono text-yellow-400">Slot {slot}</span>{" "}
                              {sentence ? `— "${sentence}"` : ""}
                            </span>
                            <span className="shrink-0 text-white/50">
                              {lines ? `${lines.length} instrument${lines.length === 1 ? "" : "s"}` : "—"}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                    <p className="text-xs text-white/40">Saving overwrites whatever is currently in those slots.</p>
                    {error && <p className="text-sm text-red-400">{error}</p>}
                    {saved ? (
                      <div className="flex flex-col gap-2">
                        <p className="text-sm text-yellow-400">Saved.</p>
                        <button
                          type="button"
                          onClick={() => window.location.reload()}
                          className="self-start rounded-md border border-white/15 px-3 py-1.5 text-sm text-white/70 transition hover:border-yellow-400 hover:text-yellow-400"
                        >
                          Reload to view it
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={save}
                        disabled={saving}
                        className="w-full rounded-full bg-yellow-400 px-4 py-1.5 text-sm font-bold text-slate-900 transition hover:bg-yellow-300 disabled:opacity-60"
                      >
                        {saving ? "Saving…" : "Save to Slots A-D"}
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
