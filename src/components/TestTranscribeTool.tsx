"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { Editor } from "@/components/Editor";
import { BoardData, SlotLetter } from "@/lib/board";
import { DEFAULT_KIT } from "@/lib/drumKits";
import { StoredLine } from "@/lib/song";
import { NO_PASSWORD_MANAGER_ATTRS } from "@/lib/formAttrs";
import type { TranscribeDiagnostics } from "@/lib/transcribeDrums";

type Phase = "idle" | "uploading" | "processing" | "done" | "error";

interface ImportStatus {
  status: "uploaded" | "processing" | "done" | "error";
  errorMessage: string | null;
  bpm: number | null;
  measureLength: number | null;
  mainBeatCount: number | null;
  patternA: StoredLine[] | null;
  patternB: StoredLine[] | null;
  patternC: StoredLine[] | null;
  patternD: StoredLine[] | null;
  diagnostics: TranscribeDiagnostics | null;
}

const POLL_INTERVAL_MS = 3000;

const SLOT_KEYS: { key: "patternA" | "patternB" | "patternC" | "patternD"; slot: SlotLetter }[] = [
  { key: "patternA", slot: "A" },
  { key: "patternB", slot: "B" },
  { key: "patternC", slot: "C" },
  { key: "patternD", slot: "D" },
];

function slotLabel(index: number, mainBeatCount: number, fillCount: number): string {
  if (index < mainBeatCount) return mainBeatCount === 1 ? "Main beat" : `Main beat ${index + 1}`;
  const fillNumber = index - mainBeatCount + 1;
  return fillCount === 1 ? "Fill" : `Fill ${fillNumber}`;
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds - m * 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

// The /test harness for the AI rhythm-detection pipeline: upload an MP3,
// isolate every stem (Replicate/Demucs), transcribe the drums into up to
// three main grooves + fills, and layer in whichever non-drum stem (vocals,
// bass, "other") is most rhythmically distinct as an extra Rimshot line —
// see lib/transcribeDrums.ts's pickExtraInstrumentRhythm. Nothing here saves
// on its own: the result previews straight in a read-only Editor so it can
// be played/scrubbed through immediately, with an explicit "Save as a page"
// step for whatever's worth keeping.
export function TestTranscribeTool() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<ImportStatus | null>(null);
  const [filename, setFilename] = useState("");
  const [importId, setImportId] = useState<string | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [claimName, setClaimName] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [takenName, setTakenName] = useState<string | null>(null);
  // Which clip's "Play" button is the currently-playing one, e.g. "A-0" for
  // Slot A's first source range — drives the button's own label/highlight,
  // not shared audio playback state (only one clip plays at a time).
  const [playingClip, setPlayingClip] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollTimerRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  // Where the currently-playing clip should stop — checked on every
  // `timeupdate` tick since <audio> has no built-in "play this range" API.
  const stopAtRef = useRef<number | null>(null);

  function clearPoll() {
    if (pollTimerRef.current !== null) {
      window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }
  useEffect(() => clearPoll, []);

  // Auto-stops playback once the clip's end time is reached, since <audio>
  // only knows how to play from a point onward, never "until."
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    function onTimeUpdate() {
      if (stopAtRef.current !== null && audio!.currentTime >= stopAtRef.current) {
        audio!.pause();
        stopAtRef.current = null;
        setPlayingClip(null);
      }
    }
    function onEnded() {
      stopAtRef.current = null;
      setPlayingClip(null);
    }
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  function playClip(clipKey: string, startSeconds: number, endSeconds: number) {
    const audio = audioRef.current;
    if (!audio) return;
    if (playingClip === clipKey) {
      audio.pause();
      stopAtRef.current = null;
      setPlayingClip(null);
      return;
    }
    stopAtRef.current = endSeconds;
    audio.currentTime = startSeconds;
    audio.play();
    setPlayingClip(clipKey);
  }

  function reset() {
    clearPoll();
    audioRef.current?.pause();
    stopAtRef.current = null;
    setPlayingClip(null);
    setPhase("idle");
    setProgress(0);
    setErrorMessage(null);
    setResult(null);
    setFilename("");
    setImportId(null);
    setShowDiagnostics(false);
    setClaimName("");
    setClaiming(false);
    setClaimError(null);
    setTakenName(null);
  }

  async function handleFile(file: File) {
    setPhase("uploading");
    setErrorMessage(null);
    setFilename(file.name);
    try {
      const blob = await upload(file.name, file, {
        access: "private",
        handleUploadUrl: "/api/imports/upload-token",
        onUploadProgress: ({ percentage }) => setProgress(percentage),
      });

      const res = await fetch("/api/imports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blobUrl: blob.url, originalFilename: file.name }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Couldn't start the import");
      }
      const { id } = (await res.json()) as { id: string };
      setImportId(id);
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

  async function claimAndSave() {
    if (!result || result.bpm == null) return;
    const name = claimName.trim();
    if (!name) return;

    const slots: Partial<Record<SlotLetter, { bpm: number; lines: StoredLine[]; kit: string }>> = {};
    for (const { key, slot } of SLOT_KEYS) {
      const lines = result[key];
      if (lines && lines.length > 0) slots[slot] = { bpm: result.bpm, lines, kit: DEFAULT_KIT };
    }
    if (Object.keys(slots).length === 0) return;

    setClaiming(true);
    setClaimError(null);
    setTakenName(null);
    try {
      const res = await fetch("/api/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slots }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string; displayName?: string } | null;
      if (!res.ok) {
        if (res.status === 409) setTakenName(name);
        else setClaimError(data?.error ?? "Couldn't save that page — try again.");
        setClaiming(false);
        return;
      }
      router.push(`/${data?.displayName ?? name}`);
    } catch {
      setClaimError("Couldn't save — try again.");
      setClaiming(false);
    }
  }

  const previewBoard: BoardData | null =
    result && result.bpm != null
      ? {
          slug: "test-preview",
          displayName: filename.replace(/\.[^./]+$/, "") || "Test import",
          slots: Object.fromEntries(
            SLOT_KEYS.map(({ key, slot }) => [
              slot,
              result[key] && result[key]!.length > 0 ? { bpm: result.bpm!, lines: result[key]!, kit: DEFAULT_KIT } : null,
            ])
          ) as BoardData["slots"],
          readOnly: true,
          basePath: "/test",
          subtitle: `AI rhythm preview of "${filename}" — nothing here saves`,
        }
      : null;

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Always mounted (not gated behind phase === "done") so the timeupdate/
          ended listener effect above — which runs once, on mount — actually
          has an element to attach to. src is empty until an import exists;
          an <audio> with no src is inert. */}
      <audio ref={audioRef} src={importId ? `/api/imports/${importId}/audio` : undefined} preload="none" />
      <div className="border-b border-white/10 px-4 py-4 sm:px-6">
        <h1 className="text-xl font-black tracking-tight sm:text-2xl">
          Rhythm Detection <span className="text-yellow-400">Test</span>
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-white/50">
          Private harness for the AI transcription pipeline — not linked from anywhere in the app. Upload an MP3 and
          it isolates every stem (drums, bass, other, vocals), transcribes the drums into up to three main grooves
          plus fills, and layers in whichever non-drum stem is most rhythmically distinct as an extra{" "}
          <span className="font-mono text-yellow-400">Rimshot</span> line — e.g. a syncopated vocal delivery mapped
          onto its own voice instead of the kick/snare/hi-hat. Nothing saves until you explicitly say so below.
        </p>
      </div>

      <div className="flex flex-col gap-4 p-4 sm:p-6">
        {phase === "idle" && (
          <div className="flex flex-col items-start gap-3">
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
          <div className="flex max-w-sm flex-col gap-2">
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div className="h-full bg-yellow-400 transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-xs text-white/50">Uploading… {Math.round(progress)}%</p>
          </div>
        )}

        {phase === "processing" && (
          <div className="flex flex-col items-start gap-2">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-yellow-400" />
            <p className="text-xs text-white/50">
              Separating stems and transcribing — this usually takes under a minute…
            </p>
          </div>
        )}

        {phase === "error" && (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-red-400">{errorMessage}</p>
            <button
              type="button"
              onClick={reset}
              className="rounded-md border border-white/15 px-3 py-1.5 text-sm text-white/70 transition hover:border-yellow-400 hover:text-yellow-400"
            >
              Try again
            </button>
          </div>
        )}

        {phase === "done" && result && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-white/80">
                Detected ~<span className="font-bold text-yellow-400">{result.bpm} BPM</span>
              </p>
              {result.diagnostics?.extraInstrument && (
                <p className="text-sm text-white/80">
                  Layered <span className="font-bold text-yellow-400">{result.diagnostics.extraInstrument.sourceStem}</span>{" "}
                  rhythm onto <span className="font-mono text-yellow-400">Rimshot</span> (
                  {result.diagnostics.extraInstrument.onsetCount} onsets)
                </p>
              )}
              {!result.diagnostics?.extraInstrument && (
                <p className="text-sm text-white/40">No non-drum stem had enough rhythm to layer in.</p>
              )}
              <button
                type="button"
                onClick={reset}
                className="ml-auto rounded-md border border-white/15 px-3 py-1.5 text-sm text-white/70 transition hover:border-yellow-400 hover:text-yellow-400"
              >
                Try another song
              </button>
            </div>

            <ul className="flex flex-col gap-1.5">
              {SLOT_KEYS.map(({ key, slot }, index) => {
                const pattern = result[key];
                const mainBeatCount = result.mainBeatCount ?? 0;
                const fillCount = SLOT_KEYS.length - mainBeatCount;
                const label = slotLabel(index, mainBeatCount, fillCount);
                const ranges = result.diagnostics?.[key]?.sourceRanges ?? [];
                return (
                  <li key={slot} className="flex flex-wrap items-center gap-2 rounded-md border border-white/10 px-3 py-1.5 text-sm">
                    <span className="font-mono text-yellow-400">Slot {slot}</span>
                    <span className="text-white/60">{label}</span>
                    <span className="text-white/40">
                      {pattern ? `${pattern.length} instrument${pattern.length === 1 ? "" : "s"}` : "not detected"}
                    </span>
                    {importId &&
                      ranges.map(([start, end], rangeIndex) => {
                        const clipKey = `${slot}-${rangeIndex}`;
                        const isPlaying = playingClip === clipKey;
                        return (
                          <button
                            key={clipKey}
                            type="button"
                            onClick={() => playClip(clipKey, start, end)}
                            title={`Play the audio this pattern was drawn from (${formatTimestamp(start)}–${formatTimestamp(end)})`}
                            className={[
                              "rounded-md border px-2 py-0.5 font-mono text-xs transition",
                              isPlaying
                                ? "border-yellow-400 bg-yellow-400/10 text-yellow-400"
                                : "border-white/15 text-white/60 hover:border-yellow-400 hover:text-yellow-400",
                            ].join(" ")}
                          >
                            {isPlaying ? "■ " : "▶ "}
                            {formatTimestamp(start)}–{formatTimestamp(end)}
                          </button>
                        );
                      })}
                  </li>
                );
              })}
            </ul>

            <button
              type="button"
              onClick={() => setShowDiagnostics((v) => !v)}
              className="self-start text-xs text-white/40 underline decoration-dotted transition hover:text-yellow-400"
            >
              {showDiagnostics ? "Hide raw diagnostics" : "Show raw diagnostics"}
            </button>
            {showDiagnostics && (
              <pre className="max-w-full overflow-x-auto rounded-md border border-white/10 bg-black/30 p-3 text-xs text-white/60">
                {JSON.stringify(result.diagnostics, null, 2)}
              </pre>
            )}

            <div className="flex flex-wrap items-end gap-2 rounded-md border border-white/10 bg-white/5 p-3">
              <label className="flex flex-col gap-1 text-sm text-white/70">
                Save as a new page
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-white/40">/</span>
                  <input
                    {...NO_PASSWORD_MANAGER_ATTRS}
                    value={claimName}
                    onChange={(e) => {
                      setClaimName(e.target.value);
                      setTakenName(null);
                      setClaimError(null);
                    }}
                    placeholder="PageName"
                    maxLength={24}
                    className="rounded-md border border-white/15 bg-white/5 px-2 py-1.5 text-base text-white placeholder:text-white/30 focus:border-yellow-400 focus:outline-none sm:text-sm"
                  />
                </div>
              </label>
              <button
                type="button"
                onClick={claimAndSave}
                disabled={claiming || claimName.trim().length === 0}
                className="rounded-full bg-yellow-400 px-4 py-1.5 text-sm font-bold text-slate-900 transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {claiming ? "Saving…" : "Save"}
              </button>
              {claimError && <p className="text-sm text-red-400">{claimError}</p>}
              {takenName && <p className="text-xs text-white/40">/{takenName} is already taken — try another name.</p>}
            </div>
          </div>
        )}
      </div>

      {previewBoard && (
        <div className="border-t border-white/10">
          <Editor board={previewBoard} />
        </div>
      )}
    </div>
  );
}
