"use client";

import { useEffect, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { DEFAULT_KIT } from "@/lib/drumKits";

type Phase = "idle" | "uploading" | "processing" | "done" | "error";

interface ImportStatus {
  status: "uploaded" | "processing" | "done" | "error";
  errorMessage: string | null;
  bpm: number | null;
  measureLength: number | null;
  pattern: { instrument: string; blocks: (string | null)[]; volume?: number }[] | null;
}

const POLL_INTERVAL_MS = 3000;

// Stage 1 of "turn a song into a beat": upload an MP3, run it through the
// Replicate/Demucs + heuristic-transcription pipeline (see
// src/inngest/functions.ts), and land the one representative pattern it
// finds straight into Slot A. Picking which slot, reviewing multiple
// detected sections, etc. is deliberately out of scope until this core
// pipeline's transcription quality has been validated on real songs.
export function SongImportButton({ boardSlug, boardDisplayName }: { boardSlug: string; boardDisplayName: string }) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<ImportStatus | null>(null);
  const [saved, setSaved] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollTimerRef = useRef<number | null>(null);

  function clearPoll() {
    if (pollTimerRef.current !== null) {
      window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }

  function close() {
    clearPoll();
    setOpen(false);
    setPhase("idle");
    setProgress(0);
    setErrorMessage(null);
    setResult(null);
    setSaved(false);
  }

  async function handleFile(file: File) {
    setPhase("uploading");
    setErrorMessage(null);
    try {
      const blob = await upload(file.name, file, {
        access: "private",
        handleUploadUrl: "/api/imports/upload-token",
        onUploadProgress: ({ percentage }) => setProgress(percentage),
      });

      const res = await fetch("/api/imports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boardSlug, blobUrl: blob.url, originalFilename: file.name }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Couldn't start the import");
      }
      const { id } = (await res.json()) as { id: string };
      setPhase("processing");
      poll(id);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Upload failed");
      setPhase("error");
    }
  }

  function poll(id: string) {
    async function tick() {
      try {
        const res = await fetch(`/api/imports/${id}`);
        if (!res.ok) throw new Error("Lost track of this import");
        const data = (await res.json()) as ImportStatus;
        if (data.status === "done") {
          setResult(data);
          setPhase("done");
          return;
        }
        if (data.status === "error") {
          setErrorMessage(data.errorMessage ?? "Something went wrong transcribing this song.");
          setPhase("error");
          return;
        }
        pollTimerRef.current = window.setTimeout(tick, POLL_INTERVAL_MS);
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : "Lost track of this import");
        setPhase("error");
      }
    }
    tick();
  }

  useEffect(() => clearPoll, []);

  async function saveToSlotA() {
    if (!result?.pattern || result.bpm == null) return;
    const res = await fetch(`/api/boards/${boardSlug}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slot: "A", bpm: result.bpm, lines: result.pattern, kit: DEFAULT_KIT }),
    });
    if (res.ok) setSaved(true);
    else setErrorMessage("Couldn't save the pattern to Slot A — try again.");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Transcribe a song's drums into a beat"
        className="shrink-0 rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-sm font-medium text-white/80 transition hover:border-yellow-400 hover:text-yellow-400"
      >
        🎧 Import a song
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={close}>
          <div
            className="w-full max-w-md rounded-lg border border-white/15 bg-slate-900 p-5 text-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">🎧 Import a song</h2>
              <button
                type="button"
                onClick={close}
                title="Close"
                className="rounded-md px-2 py-0.5 text-white/50 transition hover:text-red-400"
              >
                ✕
              </button>
            </div>

            <p className="mb-3 text-xs text-white/50">
              Upload an MP3 and I&apos;ll isolate the drums, transcribe a representative bar, and drop it into{" "}
              <span className="font-mono text-yellow-400">Slot A</span> on <span className="font-mono">/{boardDisplayName}</span>.
              This is a best-effort auto-transcription — expect to touch it up in the editor afterward, especially on busy
              fills or heavily processed kits. Saving overwrites whatever is currently in Slot A.
            </p>

            {phase === "idle" && (
              <div className="flex flex-col items-center gap-3 py-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFile(file);
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-full bg-yellow-400 px-6 py-2 font-bold text-slate-900 transition hover:bg-yellow-300"
                >
                  Choose an MP3
                </button>
              </div>
            )}

            {phase === "uploading" && (
              <div className="flex flex-col items-center gap-2 py-6">
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <div className="h-full bg-yellow-400 transition-all" style={{ width: `${progress}%` }} />
                </div>
                <p className="text-xs text-white/50">Uploading… {Math.round(progress)}%</p>
              </div>
            )}

            {phase === "processing" && (
              <div className="flex flex-col items-center gap-2 py-6">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-yellow-400" />
                <p className="text-xs text-white/50">
                  Separating drums and transcribing a pattern — this usually takes under a minute…
                </p>
              </div>
            )}

            {phase === "error" && (
              <div className="flex flex-col gap-3 py-2">
                <p className="text-sm text-red-400">{errorMessage}</p>
                <button
                  type="button"
                  onClick={() => {
                    setPhase("idle");
                    setErrorMessage(null);
                  }}
                  className="self-start rounded-md border border-white/15 px-3 py-1.5 text-sm text-white/70 transition hover:border-yellow-400 hover:text-yellow-400"
                >
                  Try again
                </button>
              </div>
            )}

            {phase === "done" && result && (
              <div className="flex flex-col gap-3 py-2">
                <p className="text-sm text-white/80">
                  Detected ~<span className="font-bold text-yellow-400">{result.bpm} BPM</span>,{" "}
                  {result.pattern?.length ?? 0} instrument{result.pattern?.length === 1 ? "" : "s"} in the
                  representative bar.
                </p>
                {saved ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-sm text-yellow-400">Saved to Slot A.</p>
                    <button
                      type="button"
                      onClick={() => window.location.reload()}
                      className="self-start rounded-md border border-white/15 px-3 py-1.5 text-sm text-white/70 transition hover:border-yellow-400 hover:text-yellow-400"
                    >
                      Reload to view it
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={saveToSlotA}
                    className="self-start rounded-full bg-yellow-400 px-4 py-1.5 text-sm font-bold text-slate-900 transition hover:bg-yellow-300"
                  >
                    Save to Slot A
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
