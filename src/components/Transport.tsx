"use client";

import { useState } from "react";

export function Transport({
  bpm,
  onBpmChange,
  isPlaying,
  onTogglePlay,
  disabled,
  measureLength,
  onDownload,
}: {
  bpm: number;
  onBpmChange: (bpm: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  disabled: boolean;
  measureLength: number;
  onDownload: () => Promise<void>;
}) {
  const [rendering, setRendering] = useState(false);

  async function handleDownload() {
    setRendering(true);
    try {
      await onDownload();
    } finally {
      setRendering(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl bg-white/5 p-4">
      <button
        type="button"
        onClick={onTogglePlay}
        disabled={disabled}
        className="rounded-full bg-yellow-400 px-6 py-2 font-bold text-slate-900 transition hover:bg-yellow-300 disabled:opacity-30"
      >
        {isPlaying ? "■ Stop" : "▶ Play"}
      </button>
      <div className="flex items-center gap-2">
        <label htmlFor="tempo" className="text-sm text-white/60">
          Tempo
        </label>
        <input
          id="tempo"
          type="range"
          min={40}
          max={220}
          value={bpm}
          onChange={(e) => onBpmChange(Number(e.target.value))}
          className="w-40 accent-yellow-400"
        />
        <span className="w-16 text-sm text-white/80">{bpm} BPM</span>
      </div>
      <button
        type="button"
        onClick={handleDownload}
        disabled={disabled || rendering}
        className="rounded-md border border-white/15 bg-white/5 px-4 py-1.5 text-sm font-medium text-white/80 transition hover:border-yellow-400 hover:text-yellow-400 disabled:opacity-30"
      >
        {rendering ? "Rendering…" : "Download MP3"}
      </button>
      <span className="text-sm text-white/50">
        {measureLength > 0 ? `${measureLength}/4 measure · loops` : "Drag a block in to begin"}
      </span>
    </div>
  );
}
