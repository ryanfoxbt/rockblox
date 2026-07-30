"use client";

import { useEffect, useRef, useState } from "react";

export function Transport({
  bpm,
  onBpmChange,
  isPlaying,
  onTogglePlay,
  disabled,
  measureLength,
  onDownloadMp3,
  onDownloadMidi,
}: {
  bpm: number;
  onBpmChange: (bpm: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  disabled: boolean;
  measureLength: number;
  onDownloadMp3: () => Promise<void>;
  onDownloadMidi: () => void;
}) {
  const [rendering, setRendering] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [menuOpen]);

  async function handleDownloadMp3() {
    setMenuOpen(false);
    setRendering(true);
    try {
      await onDownloadMp3();
    } finally {
      setRendering(false);
    }
  }

  function handleDownloadMidi() {
    setMenuOpen(false);
    onDownloadMidi();
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

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          disabled={disabled || rendering}
          className="rounded-md border border-white/15 bg-white/5 px-4 py-1.5 text-sm font-medium text-white/80 transition hover:border-yellow-400 hover:text-yellow-400 disabled:opacity-30"
        >
          {rendering ? "Rendering…" : "Download ▾"}
        </button>
        {menuOpen && (
          <div className="absolute left-0 top-full z-10 mt-1 w-40 overflow-hidden rounded-md border border-white/10 bg-slate-800 shadow-lg">
            <button
              type="button"
              onClick={handleDownloadMp3}
              className="block w-full px-3 py-2 text-left text-sm text-white/80 transition hover:bg-white/10 hover:text-yellow-400"
            >
              MP3 audio
            </button>
            <button
              type="button"
              onClick={handleDownloadMidi}
              className="block w-full px-3 py-2 text-left text-sm text-white/80 transition hover:bg-white/10 hover:text-yellow-400"
            >
              MIDI file
            </button>
          </div>
        )}
      </div>

      <span className="text-sm text-white/50">
        {measureLength > 0 ? `${measureLength}/4 measure · loops` : "Drag a block in to begin"}
      </span>
    </div>
  );
}
