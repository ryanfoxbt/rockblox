"use client";

import { useEffect, useState } from "react";
import { MAX_WALL_MESSAGE_LENGTH } from "@/lib/wallModeration";
import { NO_PASSWORD_MANAGER_ATTRS } from "@/lib/formAttrs";

interface WallMessage {
  id: number;
  message: string;
  createdAt: string;
}

// A handful of accent colors already used elsewhere in the app (the tom
// voices, the sponsor/accent yellow) — reused here rather than introducing a
// new palette, so the wall reads as "chaotic" without clashing with the
// rest of the UI's color scheme.
const INK_COLORS = [
  "text-yellow-400", "text-fuchsia-400", "text-sky-400", "text-emerald-400",
  "text-pink-400", "text-indigo-400", "text-orange-400",
];

// Deterministic per-message "hand" — same id always tilts and sizes the
// same way, so a wall doesn't re-shuffle itself every time it's reopened.
function colorFor(id: number): string {
  return INK_COLORS[id % INK_COLORS.length];
}

// Gentle tilt (-4..4deg) — enough to read as handwriting, restrained enough
// that a padded wrapper (see the message list below) reliably keeps the
// rotated text from visually reaching the scroll container's edge, which
// otherwise clips it.
function rotationDegFor(id: number): number {
  return ((id * 31) % 9) - 4;
}

function sizeClassFor(id: number): string {
  const sizes = ["text-base", "text-lg", "text-xl", "text-2xl"];
  return sizes[id % sizes.length];
}

// The graffiti wall for one claimed page — see wallModeration.ts and the
// wall API route for the moderation/rate-limit rules. Every visitor to
// /boardSlug can read and add to it; nothing here is tied to who owns the
// page, on purpose — "someone was here" doesn't ask permission.
export function WallButton({ boardSlug }: { boardSlug: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<WallMessage[] | null>(null);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch(`/api/boards/${boardSlug}/wall`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setMessages(Array.isArray(data?.messages) ? data.messages : []);
      })
      .catch(() => {
        if (!cancelled) setMessages([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, boardSlug]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  async function post() {
    const trimmed = text.trim();
    if (!trimmed) return;
    setPosting(true);
    setError(null);
    try {
      const res = await fetch(`/api/boards/${boardSlug}/wall`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });
      const data = (await res.json().catch(() => null)) as { message?: WallMessage; error?: string } | null;
      if (!res.ok || !data?.message) {
        setError(data?.error ?? "Couldn't post that — try again.");
        setPosting(false);
        return;
      }
      setMessages((prev) => [data.message!, ...(prev ?? [])]);
      setText("");
      setPosting(false);
    } catch {
      setError("Couldn't post that — try again.");
      setPosting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Read and add to this page's wall"
        className="block w-full px-3 py-2 text-left text-sm text-white/80 transition hover:bg-white/10 hover:text-yellow-400"
      >
        Wall
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/80 p-3 sm:p-8" onClick={() => setOpen(false)}>
          <div
            className="mx-auto flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-white/15 bg-slate-900 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
              <div>
                <h2 className="text-lg font-bold">
                  The Wall — <span className="font-mono text-yellow-400">/{boardSlug}</span>
                </h2>
                <p className="text-xs text-white/40">Anyone who finds this URL can read this — and add to it.</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                title="Close the wall"
                className="shrink-0 rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-sm font-medium text-white/80 transition hover:border-yellow-400 hover:text-yellow-400"
              >
                Close
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 sm:p-8">
              {messages === null ? (
                <p className="text-sm text-white/40">Reading the wall…</p>
              ) : messages.length === 0 ? (
                <p className="text-sm text-white/40">Nobody&apos;s tagged this wall yet. Be first.</p>
              ) : (
                <div className="flex flex-wrap items-baseline">
                  {messages.map((m) => (
                    // The inner span carries the rotation purely as paint — the
                    // outer span's padding is real layout space, so the tilted
                    // text's extra visual reach stays inside it instead of
                    // reaching the scroll container's edge, which otherwise
                    // clips it (overflow-y-auto forces overflow-x to clip too).
                    <span key={m.id} className="inline-block px-3 py-4">
                      <span
                        style={{ transform: `rotate(${rotationDegFor(m.id)}deg)` }}
                        className={`inline-block font-bold ${sizeClassFor(m.id)} ${colorFor(m.id)}`}
                      >
                        {m.message}
                      </span>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-white/10 p-4">
              {error && <p className="mb-2 text-xs text-red-400">{error}</p>}
              <div className="flex gap-2">
                <input
                  {...NO_PASSWORD_MANAGER_ATTRS}
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    setError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") post();
                  }}
                  maxLength={MAX_WALL_MESSAGE_LENGTH}
                  placeholder="Leave your mark…"
                  className="flex-1 rounded-md border border-white/15 bg-white/5 px-3 py-2 text-base text-white placeholder:text-white/30 focus:border-yellow-400 focus:outline-none sm:text-sm"
                />
                <button
                  type="button"
                  onClick={post}
                  disabled={posting || !text.trim()}
                  className="shrink-0 rounded-full bg-yellow-400 px-4 py-2 text-sm font-bold text-slate-900 transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {posting ? "Tagging…" : "Tag it"}
                </button>
              </div>
              <p className="mt-1 text-right text-xs text-white/30">
                {text.length}/{MAX_WALL_MESSAGE_LENGTH}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
