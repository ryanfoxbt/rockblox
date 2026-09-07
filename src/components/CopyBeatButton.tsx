"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BoardSlotData, EXTENDED_SLOT_LETTERS, ExtendedSlotLetter } from "@/lib/board";
import { authClient } from "@/lib/auth/client";

interface SongRow {
  id: string;
  title: string;
  filledSlots: number;
}

const EMPTY_SET: ReadonlySet<string> = new Set();

// Copy one beat (a single slot's worth of pattern) from a spied public board
// into a slot of one of the signed-in user's private saved songs. Used by the
// Explore side panel and the Spy preview modal.
export function CopyBeatButton({ slot, label }: { slot: BoardSlotData; label?: string }) {
  const { data: session } = authClient.useSession();
  const [open, setOpen] = useState(false);
  const [songs, setSongs] = useState<SongRow[] | null>(null);
  const [targetSongId, setTargetSongId] = useState<string>("new");
  const [targetSlot, setTargetSlot] = useState<ExtendedSlotLetter>("A");
  // Which slots are used in a fetched existing song, tagged with its id so a
  // stale response never applies to a different selection.
  const [filledInfo, setFilledInfo] = useState<{ songId: string; slots: Set<string> } | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch("/api/my-songs")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { songs: SongRow[] }) => {
        if (cancelled) return;
        setSongs(d.songs);
        if (d.songs.length > 0) setTargetSongId(d.songs[0].id);
      })
      .catch(() => !cancelled && setError("Couldn't load your songs"));
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Show which slots are already used in the chosen existing song.
  useEffect(() => {
    if (!open || targetSongId === "new") return;
    let cancelled = false;
    fetch(`/api/my-songs/${targetSongId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { slots: Record<string, BoardSlotData | null> }) => {
        if (cancelled) return;
        setFilledInfo({
          songId: targetSongId,
          slots: new Set(
            EXTENDED_SLOT_LETTERS.filter((l) => {
              const s = d.slots[l];
              return !!s && s.lines.length > 0;
            })
          ),
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, targetSongId]);

  const filledInTarget =
    targetSongId !== "new" && filledInfo?.songId === targetSongId ? filledInfo.slots : EMPTY_SET;

  function close() {
    setOpen(false);
    setError(null);
    setDone(null);
    setBusy(false);
    setTargetSongId("new");
    setTargetSlot("A");
  }

  async function copy() {
    setBusy(true);
    setError(null);
    const payload = { bpm: slot.bpm, lines: slot.lines, kit: slot.kit, customSamples: slot.customSamples };
    try {
      if (targetSongId === "new") {
        const res = await fetch("/api/my-songs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: label ? `Copy of ${label}` : "Untitled", slots: { [targetSlot]: payload } }),
        });
        const d = (await res.json().catch(() => null)) as { id?: string; title?: string } | null;
        if (!res.ok || !d?.id) throw new Error();
        setDone(`New song “${d.title}” · slot ${targetSlot}`);
      } else {
        const res = await fetch(`/api/my-songs/${targetSongId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slot: targetSlot, ...payload }),
        });
        if (!res.ok) throw new Error();
        const title = songs?.find((s) => s.id === targetSongId)?.title ?? "song";
        setDone(`Copied to “${title}” · slot ${targetSlot}`);
      }
    } catch {
      setError("Couldn't copy — try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!session?.user) {
    return (
      <Link
        href="/auth/sign-up"
        className="shrink-0 rounded-md border border-white/15 px-2 py-1 text-xs text-white/60 transition hover:border-yellow-400 hover:text-yellow-400"
      >
        Sign up to copy
      </Link>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Copy this beat into one of your saved songs"
        className="shrink-0 rounded-md border border-white/15 px-2 py-1 text-xs text-white/70 transition hover:border-yellow-400 hover:text-yellow-400"
      >
        ⤵ Copy
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={close}>
          <div
            className="w-full max-w-sm rounded-lg border border-white/15 bg-slate-900 p-5 text-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-bold">Copy {label ? `“${label}”` : "beat"}</h2>
              <button type="button" onClick={close} className="px-2 text-white/50 hover:text-red-400">
                ✕
              </button>
            </div>

            {done ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-yellow-400">{done}</p>
                <button
                  type="button"
                  onClick={close}
                  className="self-start rounded-md border border-white/15 px-3 py-1.5 text-sm text-white/70 hover:border-yellow-400 hover:text-yellow-400"
                >
                  Done
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <label className="flex flex-col gap-1 text-xs text-white/60">
                  Into song
                  <select
                    value={targetSongId}
                    onChange={(e) => setTargetSongId(e.target.value)}
                    className="rounded-md border border-white/15 bg-slate-800 px-2 py-1.5 text-sm text-white"
                  >
                    <option value="new">＋ New song</option>
                    {songs?.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title} ({s.filledSlots}/8)
                      </option>
                    ))}
                  </select>
                </label>

                <div className="flex flex-col gap-1 text-xs text-white/60">
                  Into slot
                  <div className="flex flex-wrap gap-1">
                    {EXTENDED_SLOT_LETTERS.map((l) => (
                      <button
                        key={l}
                        type="button"
                        onClick={() => setTargetSlot(l)}
                        title={filledInTarget.has(l) ? `Slot ${l} — replaces what's there` : `Slot ${l}`}
                        className={[
                          "h-8 w-8 rounded-md border text-sm font-semibold transition",
                          l === targetSlot
                            ? "border-yellow-400 bg-yellow-400 text-slate-900"
                            : filledInTarget.has(l)
                              ? "border-white/25 bg-white/10 text-white/70"
                              : "border-white/15 text-white/50 hover:border-yellow-400",
                        ].join(" ")}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                  {filledInTarget.has(targetSlot) && (
                    <span className="text-[11px] text-white/40">Slot {targetSlot} already has a beat — this replaces it.</span>
                  )}
                </div>

                {error && <p className="text-sm text-red-400">{error}</p>}

                <button
                  type="button"
                  onClick={copy}
                  disabled={busy}
                  className="mt-1 w-full rounded-full bg-yellow-400 px-4 py-1.5 text-sm font-bold text-slate-900 transition hover:bg-yellow-300 disabled:opacity-50"
                >
                  {busy ? "Copying…" : "Copy"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
