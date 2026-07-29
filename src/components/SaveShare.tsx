"use client";

import { useState } from "react";
import { LineData, computeMeasureLength, serializeLines } from "@/lib/song";

export function SaveShare({
  bpm,
  lines,
  initialSlug,
}: {
  bpm: number;
  lines: LineData[];
  initialSlug?: string;
}) {
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [shareUrl, setShareUrl] = useState<string | null>(
    initialSlug && typeof window !== "undefined" ? `${window.location.origin}/p/${initialSlug}` : null
  );
  const [copied, setCopied] = useState(false);

  const measureLength = computeMeasureLength(lines);

  async function handleSave() {
    setStatus("saving");
    setCopied(false);
    try {
      const res = await fetch("/api/patterns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bpm, lines: serializeLines(lines) }),
      });
      if (!res.ok) throw new Error("Save failed");
      const data = (await res.json()) as { slug: string };
      const url = `${window.location.origin}/p/${data.slug}`;
      window.history.replaceState(null, "", `/p/${data.slug}`);
      setShareUrl(url);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  async function handleCopy() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        onClick={handleSave}
        disabled={measureLength < 1 || status === "saving"}
        className="rounded-md border border-white/15 bg-white/5 px-4 py-1.5 text-sm font-medium text-white/80 transition hover:border-yellow-400 hover:text-yellow-400 disabled:opacity-30"
      >
        {status === "saving" ? "Saving…" : "Save & Share"}
      </button>
      {status === "error" && <span className="text-xs text-red-400">Couldn&apos;t save, try again</span>}
      {shareUrl && (
        <button
          type="button"
          onClick={handleCopy}
          title={shareUrl}
          className="max-w-[16rem] truncate rounded-md px-1 text-xs text-white/50 underline decoration-dotted hover:text-yellow-400"
        >
          {copied ? "Copied!" : shareUrl.replace(/^https?:\/\//, "")}
        </button>
      )}
    </div>
  );
}
