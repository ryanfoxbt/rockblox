"use client";

import { useState } from "react";
import { LineData, computeMeasureLength, serializeLines } from "@/lib/song";
import { CustomSamples } from "@/lib/customSamples";

export function SaveShare({
  bpm,
  lines,
  kit,
  customSamples,
  initialSlug,
  boardPath,
}: {
  bpm: number;
  lines: LineData[];
  kit: string;
  customSamples?: CustomSamples;
  initialSlug?: string;
  boardPath?: string;
}) {
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [slug, setSlug] = useState<string | null>(initialSlug ?? null);
  const [copied, setCopied] = useState(false);

  const measureLength = computeMeasureLength(lines);
  const sharePath = boardPath ?? (slug ? `/p/${slug}` : null);

  async function handleSave() {
    setStatus("saving");
    setCopied(false);
    try {
      const res = await fetch("/api/patterns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bpm, lines: serializeLines(lines), kit, customSamples }),
      });
      if (!res.ok) throw new Error("Save failed");
      const data = (await res.json()) as { slug: string };
      window.history.replaceState(null, "", `/p/${data.slug}`);
      setSlug(data.slug);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  async function handleCopy() {
    if (!sharePath) return;
    await navigator.clipboard.writeText(`${window.location.origin}${sharePath}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // On a claimed personal page, edits already autosave there — "share"
  // just means handing out that page's own link, never a new /p/ snapshot.
  if (boardPath) {
    return (
      <div className="flex flex-col items-end gap-1.5">
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 rounded-md border border-white/15 bg-white/5 px-4 py-1.5 text-sm font-medium text-white/80 transition hover:border-yellow-400 hover:text-yellow-400"
        >
          {copied ? "Copied!" : "Share"}
        </button>
        <button
          type="button"
          onClick={handleCopy}
          title={boardPath}
          className="max-w-[16rem] truncate rounded-md px-1 text-xs text-white/50 underline decoration-dotted hover:text-yellow-400"
        >
          {boardPath}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        onClick={handleSave}
        disabled={measureLength < 1 || status === "saving"}
        className="shrink-0 rounded-md border border-white/15 bg-white/5 px-4 py-1.5 text-sm font-medium text-white/80 transition hover:border-yellow-400 hover:text-yellow-400 disabled:opacity-30"
      >
        {status === "saving" ? "Saving…" : "Save & Share"}
      </button>
      {status === "error" && <span className="text-xs text-red-400">Couldn&apos;t save, try again</span>}
      {sharePath && (
        <button
          type="button"
          onClick={handleCopy}
          title={sharePath}
          className="max-w-[16rem] truncate rounded-md px-1 text-xs text-white/50 underline decoration-dotted hover:text-yellow-400"
        >
          {copied ? "Copied!" : sharePath}
        </button>
      )}
    </div>
  );
}
