"use client";

import { useEffect, useRef, useState } from "react";
import type { ExportPart } from "@/lib/bassline";

export type DownloadFormat = "mp3" | "midi";

// The "Download ▾" dropdown shared by the editor's Transport and the Stack
// Builder. Without a bassline it's the original two-item menu (MP3 / MIDI).
// With one, each format splits into full / drums-only / bass-only so the parts
// can be pulled together or separately. MP3 renders take a beat, so the
// trigger shows "Rendering…" and locks while one is running.
export function DownloadMenu({
  hasBassline,
  disabled,
  onDownload,
}: {
  hasBassline: boolean;
  disabled?: boolean;
  onDownload: (format: DownloadFormat, part: ExportPart) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [rendering, setRendering] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  async function run(format: DownloadFormat, part: ExportPart) {
    setOpen(false);
    if (format === "mp3") {
      setRendering(true);
      try {
        await onDownload(format, part);
      } finally {
        setRendering(false);
      }
    } else {
      await onDownload(format, part);
    }
  }

  const item = (label: string, format: DownloadFormat, part: ExportPart) => (
    <button
      type="button"
      onClick={() => run(format, part)}
      className="block w-full px-3 py-2 text-left text-sm text-white/80 transition hover:bg-white/10 hover:text-yellow-400"
    >
      {label}
    </button>
  );

  const sectionLabel = (text: string) => (
    <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-white/35">{text}</p>
  );

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled || rendering}
        className="shrink-0 rounded-md border border-white/15 bg-white/5 px-4 py-1.5 text-sm font-medium text-white/80 transition hover:border-yellow-400 hover:text-yellow-400 disabled:opacity-30"
      >
        {rendering ? "Rendering…" : "Download ▾"}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-10 mt-1 w-52 overflow-hidden rounded-md border border-white/10 bg-slate-800 py-1 shadow-lg">
          {hasBassline ? (
            <>
              {sectionLabel("MP3 audio")}
              {item("Full mix", "mp3", "full")}
              {item("Drums only", "mp3", "drums")}
              {item("Bass only", "mp3", "bass")}
              {sectionLabel("MIDI")}
              {item("Full (drums + bass)", "midi", "full")}
              {item("Drums only", "midi", "drums")}
              {item("Bass only", "midi", "bass")}
            </>
          ) : (
            <>
              {item("MP3 audio", "mp3", "full")}
              {item("MIDI file", "midi", "full")}
            </>
          )}
        </div>
      )}
    </div>
  );
}
