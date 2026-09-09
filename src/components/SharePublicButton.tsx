"use client";

import { useState } from "react";
import { SITE_URL } from "@/lib/seo";

// Owner-only control on a saved song's Editor / Stack header: turns on a
// public, no-login link to the song (served read-only from /s/<slug>, like a
// curated /songs page) and hands back the URLs to paste somewhere. Flipping
// it off makes those links 404 again; the slug itself is kept so turning it
// back on gives the same link.

export function SharePublicButton({
  songId,
  initialPublic,
  initialSlug,
  target,
}: {
  songId: string;
  initialPublic: boolean;
  initialSlug: string | null;
  // Which link to highlight first — the Editor page or the full Stacks song.
  target: "editor" | "stack";
}) {
  const [open, setOpen] = useState(false);
  const [isPublic, setIsPublic] = useState(initialPublic);
  const [slug, setSlug] = useState(initialSlug);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function setPublic(next: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/my-songs/${songId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public: next }),
      });
      const data = (await res.json().catch(() => null)) as
        | { error?: string; publicSlug?: string | null }
        | null;
      if (!res.ok) {
        setError(data?.error ?? "Something went wrong — try again.");
        return;
      }
      setIsPublic(next);
      if (data?.publicSlug) setSlug(data.publicSlug);
    } catch {
      setError("Something went wrong — try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(url);
      setTimeout(() => setCopied((c) => (c === url ? null : c)), 1600);
    } catch {
      setError("Couldn't copy — select the link and copy it by hand.");
    }
  }

  const editorUrl = slug ? `${SITE_URL}/s/${slug}` : "";
  const stackUrl = slug ? `${SITE_URL}/s/${slug}/stack` : "";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Share this song with a public, no-login link"
        className="shrink-0 rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-xs font-medium text-white/80 transition hover:border-yellow-400 hover:text-yellow-400"
      >
        {isPublic ? "🔗 Share link" : "Share"}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-lg border border-white/15 bg-slate-900 p-5 text-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">Share this song</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                title="Close"
                className="rounded-md px-2 py-0.5 text-white/50 transition hover:text-red-400"
              >
                ✕
              </button>
            </div>

            {!isPublic ? (
              <>
                <p className="mb-3 text-xs leading-relaxed text-white/50">
                  Turns on a public link anyone can open — no login. They can play it, drag the beat blocks
                  around, and save their own copy, but nothing they change touches your song. Same as the
                  famous-song pages.
                </p>
                {error && <p className="mb-2 text-sm text-red-400">{error}</p>}
                <button
                  type="button"
                  onClick={() => setPublic(true)}
                  disabled={busy}
                  className="w-full rounded-full bg-yellow-400 px-4 py-1.5 text-sm font-bold text-slate-900 transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {busy ? "Creating…" : "Create public link"}
                </button>
              </>
            ) : (
              <>
                <p className="mb-3 text-xs leading-relaxed text-white/50">
                  Anyone with this link can play and remix your song. Their changes never touch your copy.
                  Good for posting to LinkedIn, Slack, or a text.
                </p>
                <div className="flex flex-col gap-2">
                  <ShareRow
                    label="Full song — Stacks"
                    url={stackUrl}
                    copied={copied === stackUrl}
                    onCopy={() => copy(stackUrl)}
                    highlight={target === "stack"}
                  />
                  <ShareRow
                    label="Editor — one slot at a time"
                    url={editorUrl}
                    copied={copied === editorUrl}
                    onCopy={() => copy(editorUrl)}
                    highlight={target === "editor"}
                  />
                </div>
                {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
                <button
                  type="button"
                  onClick={() => setPublic(false)}
                  disabled={busy}
                  className="mt-3 w-full rounded-md border border-white/10 px-3 py-1 text-xs text-white/50 transition hover:border-red-400 hover:text-red-400 disabled:opacity-40"
                >
                  {busy ? "…" : "Make private again"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function ShareRow({
  label,
  url,
  copied,
  onCopy,
  highlight,
}: {
  label: string;
  url: string;
  copied: boolean;
  onCopy: () => void;
  highlight: boolean;
}) {
  return (
    <div
      className={[
        "rounded-md border p-2",
        highlight ? "border-yellow-400/40 bg-yellow-400/5" : "border-white/10",
      ].join(" ")}
    >
      <div className="mb-1 text-[10px] uppercase tracking-wide text-white/40">{label}</div>
      <div className="flex items-center gap-2">
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 rounded bg-white/5 px-2 py-1 font-mono text-xs text-white/70"
        />
        <button
          type="button"
          onClick={onCopy}
          className="shrink-0 rounded border border-white/15 px-2 py-1 text-xs text-white/70 transition hover:border-yellow-400 hover:text-yellow-400"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
