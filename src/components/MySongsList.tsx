"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { NO_PASSWORD_MANAGER_ATTRS } from "@/lib/formAttrs";

interface SongRow {
  id: string;
  title: string;
  updatedAt: string;
  filledSlots: number;
}

function timeAgo(iso: string): string {
  const secs = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export function MySongsList({ initialSongs }: { initialSongs: SongRow[] }) {
  const router = useRouter();
  const [songs, setSongs] = useState(initialSongs);
  const [creating, setCreating] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function createSong() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/my-songs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Untitled" }),
      });
      const data = (await res.json().catch(() => null)) as { id?: string; error?: string } | null;
      if (!res.ok || !data?.id) {
        setError(data?.error ?? "Couldn't create a song");
        setCreating(false);
        return;
      }
      router.push(`/my/${data.id}`);
    } catch {
      setError("Couldn't create a song");
      setCreating(false);
    }
  }

  async function saveRename(id: string) {
    const title = renameValue.trim() || "Untitled";
    setSongs((prev) => prev.map((s) => (s.id === id ? { ...s, title } : s)));
    setRenamingId(null);
    await fetch(`/api/my-songs/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    }).catch(() => {});
  }

  async function deleteSong(id: string) {
    setSongs((prev) => prev.filter((s) => s.id !== id));
    setConfirmDeleteId(null);
    await fetch(`/api/my-songs/${id}`, { method: "DELETE" }).catch(() => {});
  }

  return (
    <div className="mt-6 flex flex-col gap-3">
      <button
        type="button"
        onClick={createSong}
        disabled={creating}
        className="self-start rounded-md border border-yellow-400 bg-yellow-400/10 px-4 py-2 text-sm font-medium text-yellow-400 transition hover:bg-yellow-400/20 disabled:opacity-50"
      >
        {creating ? "Creating…" : "+ New song"}
      </button>
      {error && <p className="text-sm text-red-400">{error}</p>}

      {songs.length === 0 ? (
        <p className="rounded-md border border-dashed border-white/15 px-4 py-6 text-center text-sm text-white/40">
          No saved songs yet. Hit <span className="text-white/60">+ New song</span> to start one.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {songs.map((song) => (
            <li
              key={song.id}
              className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-white/5 px-4 py-3"
            >
              {renamingId === song.id ? (
                <form
                  className="flex flex-1 items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void saveRename(song.id);
                  }}
                >
                  <input
                    {...NO_PASSWORD_MANAGER_ATTRS}
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    maxLength={80}
                    className="flex-1 rounded-md border border-white/15 bg-white/10 px-2 py-1 text-sm text-white focus:border-yellow-400 focus:outline-none"
                  />
                  <button type="submit" className="text-xs font-semibold text-yellow-400">
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setRenamingId(null)}
                    className="text-xs text-white/40 hover:text-white/70"
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <>
                  <Link href={`/my/${song.id}`} className="min-w-0 flex-1">
                    <span className="block truncate font-semibold transition hover:text-yellow-400">
                      {song.title}
                    </span>
                    <span className="text-xs text-white/40">
                      {song.filledSlots}/8 slots · edited {timeAgo(song.updatedAt)}
                    </span>
                  </Link>
                  {confirmDeleteId === song.id ? (
                    <span className="flex shrink-0 items-center gap-2 text-xs">
                      <span className="text-white/50">Delete?</span>
                      <button
                        type="button"
                        onClick={() => void deleteSong(song.id)}
                        className="font-semibold text-red-400 hover:text-red-300"
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="text-white/40 hover:text-white/70"
                      >
                        No
                      </button>
                    </span>
                  ) : (
                    <span className="flex shrink-0 items-center gap-3 text-xs text-white/40">
                      <button
                        type="button"
                        onClick={() => {
                          setRenamingId(song.id);
                          setRenameValue(song.title);
                        }}
                        className="transition hover:text-yellow-400"
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(song.id)}
                        className="transition hover:text-red-400"
                      >
                        Delete
                      </button>
                    </span>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
