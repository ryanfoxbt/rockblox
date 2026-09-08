"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BoardData, EXTENDED_SLOT_LETTERS, ExtendedSlotLetter, SLOT_LETTERS } from "@/lib/board";
import { DEFAULT_KIT } from "@/lib/drumKits";
import { serializeLines } from "@/lib/song";
import { generateBeatFromText, MAX_TEXT_LENGTH, MAX_TEXT_SLOTS, TextToBeatResult } from "@/lib/textToBeat";
import { NO_PASSWORD_MANAGER_ATTRS } from "@/lib/formAttrs";
import { RulesUsedPanel } from "./RulesUsedPanel";

const GENERATED_BPM = 100;

// Paste-text-get-a-beat — available everywhere, claimed page or not. One
// sentence becomes one slot's groove (see lib/textToBeat.ts for the
// word-rhythm mapping).
//
// Two entry points, two save paths: from an already-claimed page
// (`board` set), Save writes straight to Slots A-D via the existing
// per-slot PUT. From the
// homepage (`board` undefined — nothing claimed yet), there's nowhere to
// save to yet, so Save instead asks for a page name and creates the board
// with all four slots already filled in one call.
export function TextToBeatButton({
  board,
  savedSongId,
  variant = "button",
}: {
  board?: BoardData;
  // When set, generated grooves save into this private saved song (slots A-D)
  // via /api/my-songs/[id] instead of the public board's per-slot PUT.
  savedSongId?: string;
  // "menuItem" renders as a plain full-width row for the header's
  // consolidated tools menu (see Editor.tsx) instead of its own bordered
  // pill button — same open/save logic either way.
  variant?: "button" | "menuItem";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [result, setResult] = useState<TextToBeatResult | null>(null);
  const [claimName, setClaimName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [takenName, setTakenName] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  // One target slot per generated sentence (parallel to result.usedSentences);
  // null means "don't save this one." Editable in the preview so the grooves
  // don't have to land on A, B, C, D in order.
  const [assignments, setAssignments] = useState<(ExtendedSlotLetter | null)[]>([]);

  // No board yet (homepage) means nothing has opted out, so default to
  // shown — matches the DB column's own default of true.
  const showRules = board ? board.textToBeatShowRules !== false : true;

  // A signed-in user's private saved song has eight slots (A-H); everything
  // else — public boards, and the claim-a-new-page path — has four (A-D).
  const availableSlots: ExtendedSlotLetter[] = savedSongId ? EXTENDED_SLOT_LETTERS : SLOT_LETTERS;

  function defaultAssignments(r: TextToBeatResult): (ExtendedSlotLetter | null)[] {
    return r.usedSentences.map((_, i) => availableSlots[i] ?? null);
  }

  // Reassigning a slot that another row already holds swaps them, so the set
  // of targets stays collision-free without disabling options.
  function reassign(row: number, slot: ExtendedSlotLetter | null) {
    setAssignments((prev) => {
      const next = [...prev];
      if (slot) {
        const other = next.findIndex((s, k) => k !== row && s === slot);
        if (other >= 0) next[other] = next[row];
      }
      next[row] = slot;
      return next;
    });
  }

  function close() {
    setOpen(false);
    setText("");
    setResult(null);
    setClaimName("");
    setSaving(false);
    setSaved(false);
    setError(null);
    setTakenName(null);
    setExpandedRow(null);
    setAssignments([]);
  }

  function generate() {
    const r = generateBeatFromText(text);
    setResult(r);
    setAssignments(defaultAssignments(r));
    setSaved(false);
    setError(null);
  }

  function slotsToSave(result: TextToBeatResult) {
    const seen = new Set<ExtendedSlotLetter>();
    return assignments
      .map((slot, i) => ({ slot, lines: result.slots[i] }))
      .filter((s): s is { slot: ExtendedSlotLetter; lines: NonNullable<(typeof s)["lines"]> } => {
        if (!s.slot || !s.lines || seen.has(s.slot)) return false;
        seen.add(s.slot);
        return true;
      });
  }

  // The slots the current assignments will actually write to, in row order —
  // drives the save button's label and disabled state.
  const chosenSlots = result ? slotsToSave(result).map((s) => s.slot) : [];
  const chosenSlotsLabel =
    chosenSlots.length > 0 ? `Slot${chosenSlots.length > 1 ? "s" : ""} ${chosenSlots.join(", ")}` : "";

  async function saveToBoard(board: BoardData, result: TextToBeatResult) {
    const toSave = slotsToSave(result);
    if (toSave.length === 0) return;

    // Same single-slot PUT body either way; a saved song accepts it at
    // /api/my-songs/[id], a public board at /api/boards/[slug].
    const target = savedSongId ? `/api/my-songs/${savedSongId}` : `/api/boards/${board.slug}`;

    setSaving(true);
    setError(null);
    try {
      const responses = await Promise.all(
        toSave.map(({ slot, lines }) =>
          fetch(target, {
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

  async function claimAndSave(result: TextToBeatResult) {
    const name = claimName.trim();
    if (!name) return;
    const toSave = slotsToSave(result);
    if (toSave.length === 0) return;

    setSaving(true);
    setError(null);
    setTakenName(null);
    try {
      const res = await fetch("/api/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slots: Object.fromEntries(
            toSave.map(({ slot, lines }) => [
              slot,
              { bpm: GENERATED_BPM, lines: serializeLines(lines), kit: DEFAULT_KIT },
            ])
          ),
        }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string; displayName?: string } | null;
      if (!res.ok) {
        if (res.status === 409) setTakenName(name);
        else setError(data?.error ?? "Couldn't claim that page — try again.");
        setSaving(false);
        return;
      }
      router.push(`/${data?.displayName ?? name}`);
    } catch {
      setError("Couldn't claim that page — try again.");
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="TextyBeat — turn pasted text into a beat"
        className={
          variant === "menuItem"
            ? "block w-full px-3 py-2 text-left text-sm text-white/80 transition hover:bg-white/10 hover:text-yellow-400"
            : "shrink-0 rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-sm font-medium text-white/80 transition hover:border-yellow-400 hover:text-yellow-400"
        }
      >
        TextyBeat
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={close}>
          <div
            className="w-full max-w-md rounded-lg border border-white/15 bg-slate-900 p-5 text-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">TextyBeat</h2>
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
              rhythm comes from syllable count, commas/!/? become accents. After generating, pick which slot
              (<span className="font-mono text-yellow-400">
                {availableSlots[0]}–{availableSlots[availableSlots.length - 1]}
              </span>
              ) each groove saves into.
            </p>

            <textarea
              {...NO_PASSWORD_MANAGER_ATTRS}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setResult(null);
                setSaved(false);
              }}
              maxLength={MAX_TEXT_LENGTH}
              rows={4}
              placeholder="She quickly discovered alternative conceptualizations."
              className="w-full resize-none rounded-md border border-white/15 bg-white/5 p-2 text-base text-white placeholder:text-white/30 focus:border-yellow-400 focus:outline-none sm:text-sm"
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
                    <p className="text-sm text-yellow-400">Beat created!</p>
                    {result.totalSentences > MAX_TEXT_SLOTS && (
                      <p className="text-xs text-white/50">
                        Using the first {MAX_TEXT_SLOTS} of {result.totalSentences} sentences.
                      </p>
                    )}
                    <ul className="flex flex-col gap-1.5">
                      {result.usedSentences.map((sentence, i) => {
                        const lines = result.slots[i];
                        const trace = result.traces[i];
                        const isExpanded = expandedRow === i;
                        return (
                          <li key={i} className="rounded-md border border-white/10 px-3 py-1.5 text-sm">
                            <div className="flex items-center justify-between gap-2">
                              <span className="min-w-0 flex-1 truncate text-white/80">
                                <span className="text-white/40">{i + 1}.</span>{" "}
                                {sentence ? `"${sentence}"` : ""}
                              </span>
                              {lines ? (
                                <select
                                  value={assignments[i] ?? ""}
                                  onChange={(e) =>
                                    reassign(i, e.target.value ? (e.target.value as ExtendedSlotLetter) : null)
                                  }
                                  title="Which slot this groove saves into"
                                  className="shrink-0 rounded-md border border-white/15 bg-white/5 px-1.5 py-1 text-xs text-white"
                                >
                                  <option value="" className="bg-slate-900">
                                    Don&apos;t save
                                  </option>
                                  {availableSlots.map((s) => (
                                    <option key={s} value={s} className="bg-slate-900">
                                      Slot {s}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span className="shrink-0 text-white/50">no beat</span>
                              )}
                              {showRules && trace && (
                                <button
                                  type="button"
                                  onClick={() => setExpandedRow(isExpanded ? null : i)}
                                  className="shrink-0 text-xs text-white/40 underline decoration-dotted transition hover:text-yellow-400"
                                >
                                  {isExpanded ? "Hide rules" : "Rules used"}
                                </button>
                              )}
                            </div>
                            {showRules && isExpanded && trace && <RulesUsedPanel trace={trace} />}
                          </li>
                        );
                      })}
                    </ul>

                    {board ? (
                      <>
                        <p className="text-xs text-white/40">
                          {chosenSlots.length > 0
                            ? `Saving overwrites whatever is currently in ${chosenSlotsLabel}.`
                            : "Pick a slot for at least one groove to save."}
                        </p>
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
                            onClick={() => saveToBoard(board, result)}
                            disabled={saving || chosenSlots.length === 0}
                            className="w-full rounded-full bg-yellow-400 px-4 py-1.5 text-sm font-bold text-slate-900 transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {saving ? "Saving…" : chosenSlots.length > 0 ? `Save to ${chosenSlotsLabel}` : "Save"}
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        <label className="flex flex-col gap-1 text-sm text-white/70">
                          Claim a page to save it
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-white/40">/</span>
                            <input
                              {...NO_PASSWORD_MANAGER_ATTRS}
                              value={claimName}
                              onChange={(e) => {
                                setClaimName(e.target.value);
                                setTakenName(null);
                                setError(null);
                              }}
                              placeholder="YourName"
                              maxLength={24}
                              className="flex-1 rounded-md border border-white/15 bg-white/5 px-2 py-1.5 text-base text-white placeholder:text-white/30 focus:border-yellow-400 focus:outline-none sm:text-sm"
                            />
                          </div>
                        </label>
                        {error && <p className="text-sm text-red-400">{error}</p>}
                        {takenName && (
                          <p className="mt-1 text-xs text-white/40">
                            <span className="font-mono text-white/60">/{takenName}</span>{" "}
                            is already someone&apos;s. Nothing&apos;s locked around here, though —{" "}
                            <Link
                              href={`/${takenName}`}
                              className="font-semibold text-yellow-400 underline decoration-dotted hover:text-yellow-300"
                            >
                              Be Sneaky and peek anyway
                            </Link>
                            .
                          </p>
                        )}
                        <button
                          type="button"
                          onClick={() => claimAndSave(result)}
                          disabled={saving || claimName.trim().length === 0 || chosenSlots.length === 0}
                          className="w-full rounded-full bg-yellow-400 px-4 py-1.5 text-sm font-bold text-slate-900 transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {saving ? "Claiming…" : chosenSlotsLabel ? `Claim & Save to ${chosenSlotsLabel}` : "Claim & Save"}
                        </button>
                      </>
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
