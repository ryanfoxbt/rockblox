"use client";

import { useState } from "react";
import { MAX_ROWS_OPTIONS, MaxRows, ROWS_PER_BLOCK } from "@/lib/rockWords";

// Describes how a maxRows choice actually lays out on the board — shown next
// to the picker so the effect of a change is visible before saving, not just
// the raw number.
function blockSummary(maxRows: MaxRows): string {
  const blocks = ROWS_PER_BLOCK[maxRows];
  return blocks.length === 1
    ? `1 block of ${blocks[0]} rows`
    : `${blocks.length} blocks of ${blocks[0]} rows each`;
}

export function RockWordsSettingsPanel({ initialMaxRows }: { initialMaxRows: MaxRows }) {
  const [maxRows, setMaxRows] = useState<MaxRows>(initialMaxRows);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(next: MaxRows) {
    setMaxRows(next);
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch("/api/rockwords-admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxRows: next }),
      });
      if (!res.ok) throw new Error("failed");
      setSaved(true);
    } catch {
      setError("Couldn't save — try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-6 rounded-lg border border-white/10 bg-white/5 p-4">
      <h2 className="text-xs font-bold uppercase tracking-wide text-white/40">Game settings</h2>
      <p className="mt-1 text-sm text-white/60">
        How many total guesses every grade gets. The board splits into square &ldquo;Block&rdquo; sections as
        you go, not one long list — see the layout for each option below. This only actually changes anything
        for Kindergarten-Grade 3 (whose words fit in one beat each) — Grade 4 and up always use 4 guesses,
        since their longer words need two beats each and a pattern maxes out at 8.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {MAX_ROWS_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            disabled={saving}
            onClick={() => save(option)}
            className={`rounded-md border px-3 py-2 text-left text-sm transition disabled:opacity-50 ${
              maxRows === option
                ? "border-yellow-400 bg-yellow-400/10 text-yellow-300"
                : "border-white/15 bg-white/5 text-white/70 hover:border-yellow-400 hover:text-yellow-400"
            }`}
          >
            <span className="block font-bold">{option} guesses</span>
            <span className="block text-xs text-white/40">{blockSummary(option)}</span>
          </button>
        ))}
      </div>
      {saved && !saving && <p className="mt-2 text-xs text-yellow-400">Saved.</p>}
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </section>
  );
}
