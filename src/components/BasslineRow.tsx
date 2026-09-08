"use client";

import { BassNote, BASS_VOICES, basslineVoice, BasslineSettings } from "@/lib/bassline";
import { midiNoteName, NOTE_NAMES, SCALES } from "@/lib/scales";

// Read-only companion to LineRow that shows the generated bassline underneath
// the drum lines. It isn't editable — the notes come from generateBassline and
// are re-rolled from the Bassline modal (the gear button here opens it). Column
// widths mirror LineRow so it lines up with the drum grid.
export function BasslineRow({
  notes,
  visibleBeats,
  measureLength,
  playheadBeat,
  settings,
  onOpen,
}: {
  notes: BassNote[];
  visibleBeats: number;
  measureLength: number;
  playheadBeat: number | null;
  settings: BasslineSettings;
  onOpen: () => void;
}) {
  const byBeat: BassNote[][] = Array.from({ length: visibleBeats }, () => []);
  for (const n of notes) {
    if (n.beat >= 0 && n.beat < visibleBeats) byBeat[n.beat].push(n);
  }
  for (const list of byBeat) list.sort((a, b) => a.offset - b.offset);

  const voiceName = BASS_VOICES.find((v) => v.id === basslineVoice(settings))?.name ?? "";
  const keyLabel = `${NOTE_NAMES[settings.root]} ${SCALES[settings.scale].name} · ${voiceName}`;

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-white/5 p-3 md:flex-row md:flex-wrap md:items-center">
      <div className="flex items-center gap-3">
        <span className="h-3 w-3 shrink-0 rounded-full bg-yellow-400" aria-hidden />
        <div className="flex flex-col md:flex-none">
          <span className="text-sm font-medium text-white">Bass</span>
          <span className="text-[10px] uppercase tracking-wide text-white/40">{keyLabel}</span>
        </div>
        <button
          type="button"
          onClick={onOpen}
          title="Edit bassline settings"
          aria-label="Edit bassline settings"
          className="shrink-0 rounded-md border border-white/10 px-2 py-1 text-xs text-white/60 transition hover:border-yellow-400 hover:text-yellow-400"
        >
          Edit
        </button>
      </div>

      <div
        className="grid min-w-0 flex-1 gap-1.5"
        style={{ gridTemplateColumns: `repeat(${visibleBeats}, minmax(0, 4rem))` }}
      >
        {byBeat.map((list, i) => (
          <div
            key={`b${i}`}
            className={[
              "flex min-h-[3rem] min-w-0 flex-col items-center justify-center gap-0.5 rounded-md border px-1 py-1 text-center",
              i < measureLength ? "border-white/10 bg-slate-800/60" : "border-white/5 bg-transparent opacity-40",
              playheadBeat === i ? "ring-2 ring-yellow-400" : "",
              i === 3 && visibleBeats > 4 ? "border-r-2 border-r-white/25" : "",
            ].join(" ")}
          >
            {list.length === 0 ? (
              <span className="text-white/15">·</span>
            ) : (
              list.slice(0, 3).map((n, j) => (
                <span
                  key={j}
                  className={[
                    "font-mono text-[11px] leading-tight",
                    n.accent === "ghost" ? "text-white/30" : n.accent === "accent" ? "text-yellow-300" : "text-white/70",
                  ].join(" ")}
                >
                  {midiNoteName(n.midi)}
                </span>
              ))
            )}
            {list.length > 3 && <span className="text-[9px] text-white/30">+{list.length - 3}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
