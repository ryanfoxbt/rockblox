"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LineData, serializeLines } from "@/lib/song";
import { CustomSamples } from "@/lib/customSamples";
import { clearDraft } from "@/lib/draftStorage";

export function ClaimUrlBox({
  bpm,
  lines,
  kit,
  customSamples,
}: {
  bpm: number;
  lines: LineData[];
  kit: string;
  customSamples?: CustomSamples;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Separate from `error` — there's no login on this site, so a taken name
  // isn't a dead end, just someone else's unlocked door. Set only on a 409
  // so the sneaky-peek offer only shows up for an actual name collision, not
  // a validation error.
  const [takenName, setTakenName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    setTakenName(null);
    try {
      const res = await fetch("/api/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, bpm, lines: serializeLines(lines), kit, customSamples }),
      });
      const data = (await res.json()) as { error?: string; displayName?: string };
      if (!res.ok) {
        if (res.status === 409) setTakenName(trimmed);
        else setError(data.error ?? "Something went wrong");
        setLoading(false);
        return;
      }
      clearDraft();
      router.push(`/${data.displayName}`);
    } catch {
      setError("Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-white/40">Get your own page:</span>
        <span className="text-xs text-white/40">/</span>
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setTakenName(null);
            setError(null);
          }}
          placeholder="YourName"
          maxLength={24}
          className="w-28 rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs text-white placeholder:text-white/30 focus:border-yellow-400 focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-xs text-white/80 transition hover:border-yellow-400 hover:text-yellow-400 disabled:opacity-30"
        >
          {loading ? "Claiming…" : "Claim it"}
        </button>
        {error && <span className="text-xs text-red-400">{error}</span>}
      </form>
      {takenName && (
        <p className="text-xs text-white/40">
          🔒 <span className="font-mono text-white/60">/{takenName}</span> is already someone&apos;s. Nothing&apos;s
          locked around here, though —{" "}
          <Link href={`/${takenName}`} className="font-semibold text-yellow-400 underline decoration-dotted hover:text-yellow-300">
            😈 Be Sneaky and peek anyway
          </Link>
          .
        </p>
      )}
    </div>
  );
}
