"use client";

import { ReactNode } from "react";
import { DownloadFormat, DownloadMenu } from "@/components/DownloadMenu";
import type { ExportPart } from "@/lib/bassline";

export function Transport({
  bpm,
  onBpmChange,
  isPlaying,
  onTogglePlay,
  disabled,
  measureLength,
  onDownload,
  hasBassline,
  samplesLoading,
  kit,
  kits,
  onKitChange,
  children,
}: {
  bpm: number;
  onBpmChange: (bpm: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  disabled: boolean;
  measureLength: number;
  onDownload: (format: DownloadFormat, part: ExportPart) => void | Promise<void>;
  hasBassline: boolean;
  samplesLoading: boolean;
  kit: string;
  kits: readonly string[];
  onKitChange: (kit: string) => void;
  children?: ReactNode;
}) {
  const playDisabled = disabled || samplesLoading;

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl bg-white/5 p-4">
      <button
        type="button"
        onClick={onTogglePlay}
        disabled={playDisabled}
        className="rounded-full bg-yellow-400 px-6 py-2 font-bold text-slate-900 transition hover:bg-yellow-300 disabled:opacity-30"
      >
        {isPlaying ? "■ Stop" : "▶ Play"}
      </button>

      <div className="flex items-center gap-2">
        <label htmlFor="kit" className="text-sm text-white/60">
          Kit
        </label>
        <select
          id="kit"
          value={kit}
          onChange={(e) => onKitChange(e.target.value)}
          className="rounded-md border border-white/10 bg-slate-800 px-2 py-1.5 text-sm text-white"
        >
          {kits.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </div>

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
          className="w-24 accent-yellow-400 sm:w-40"
        />
        <span className="w-14 text-sm text-white/80 sm:w-16">{bpm} BPM</span>
      </div>

      <DownloadMenu hasBassline={hasBassline} disabled={playDisabled} onDownload={onDownload} />

      {children}

      <span className="text-sm text-white/50">
        {samplesLoading
          ? "Loading drum sounds…"
          : measureLength > 0
            ? `${measureLength}/4 measure · loops`
            : "Drag a block in to begin"}
      </span>
    </div>
  );
}
