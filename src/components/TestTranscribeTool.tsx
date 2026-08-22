"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { DEFAULT_KIT } from "@/lib/drumKits";
import { deserializeLines } from "@/lib/song";
import { StackPlayer, StackStepSource } from "@/lib/stackPlayer";
import type { FullSongArrangementStep, FullSongSlot } from "@/lib/transcribeDrums";

type Phase = "idle" | "uploading" | "processing" | "done" | "error";
type PipelineStatus = "uploaded" | "processing" | "transcribing" | "done" | "error";

interface ImportStatus {
  status: PipelineStatus;
  errorMessage: string | null;
  bpm: number | null;
  measureLength: number | null;
  durationSeconds: number | null;
  slots: FullSongSlot[] | null;
  arrangement: FullSongArrangementStep[] | null;
}

const POLL_INTERVAL_MS = 3000;

interface ArrangementSection {
  // ["A"] for a plain repeated groove, ["A", "B"] for a 2-bar phrase that
  // alternates between two slots, etc. — see collapseArrangementIntoSections.
  motif: string[];
  repeatCount: number;
  startSeconds: number;
  endSeconds: number;
}

// The point of the whole-song arrangement is "what does this section of the
// song play" (verse, chorus, ...), not "here are 120 individual bars" — a
// drummer thinks in sections, not bars. This collapses consecutive
// arrangement steps into runs, checking a few short periods (1-4 bars) so a
// groove that's really a repeating N-bar phrase (e.g. a beat that alternates
// slightly every other bar) reads as one section — "A → B, ×6" — instead of
// a dozen alternating single-bar chips. A period only wins if it actually
// explains at least two full repeats; a lone A-then-B with nothing repeating
// just stays two separate one-bar sections rather than being claimed as a
// "phrase."
const MAX_PHRASE_PERIOD = 4;

function collapseArrangementIntoSections(steps: FullSongArrangementStep[]): ArrangementSection[] {
  const sections: ArrangementSection[] = [];
  let i = 0;
  while (i < steps.length) {
    let bestPeriod = 1;
    let bestRunLength = 1;
    const maxPeriod = Math.min(MAX_PHRASE_PERIOD, steps.length - i);
    for (let period = 1; period <= maxPeriod; period++) {
      let runLength = period;
      while (i + runLength < steps.length && steps[i + runLength].slotLabel === steps[i + runLength - period].slotLabel) {
        runLength++;
      }
      if (runLength >= period * 2 && runLength > bestRunLength) {
        bestRunLength = runLength;
        bestPeriod = period;
      }
    }
    const motif = steps.slice(i, i + bestPeriod).map((s) => s.slotLabel);
    const runSteps = steps.slice(i, i + bestRunLength);
    sections.push({
      motif,
      repeatCount: bestRunLength / bestPeriod,
      startSeconds: runSteps[0].startSeconds,
      endSeconds: runSteps[runSteps.length - 1].endSeconds,
    });
    i += bestRunLength;
  }
  return sections;
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds - m * 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

// The /test harness for the AI rhythm-detection pipeline's whole-song mode:
// upload an MP3 and it isolates the drums (Replicate/Demucs — no vocals/
// bass/"other" layering here, see transcribeDrums.ts's ExtraInstrumentStems
// for that separate, still-being-tuned side of the pipeline), then finds
// every genuinely distinct groove/fill the whole song has — Slots A, B, C,
// ... as many as it takes, not capped at D like a real board — and
// reconstructs the song's real structure as a bar-by-bar arrangement. Two
// ways to check the result by ear: preview any slot's synthesized pattern,
// or play the exact original-audio clip it was drawn from.
export function TestTranscribeTool() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<ImportStatus | null>(null);
  const [filename, setFilename] = useState("");
  const [importId, setImportId] = useState<string | null>(null);
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus>("uploaded");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [samplesLoading, setSamplesLoading] = useState(false);
  const [loop, setLoop] = useState(true);
  const [isPlayingArrangement, setIsPlayingArrangement] = useState(false);
  const [playingSlot, setPlayingSlot] = useState<string | null>(null);
  const [arrangementProgress, setArrangementProgress] = useState<{ elapsed: number; total: number } | null>(null);
  const [playingClip, setPlayingClip] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollTimerRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const stopAtRef = useRef<number | null>(null);
  const stackPlayerRef = useRef<StackPlayer | null>(null);
  const rafRef = useRef<number | null>(null);

  function clearPoll() {
    if (pollTimerRef.current !== null) {
      window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }

  // Ticks once a second while waiting on the server so the status bar keeps
  // visibly moving even between polls — the one thing that actually answers
  // "is this stuck?" when the backend has nothing new to report yet.
  useEffect(() => {
    if (phase !== "processing") return;
    const start = Date.now();
    const id = window.setInterval(() => setElapsedSeconds(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => window.clearInterval(id);
  }, [phase]);

  useEffect(() => {
    const player = new StackPlayer();
    stackPlayerRef.current = player;
    return () => {
      player.destroy();
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(() => clearPoll, []);

  // Auto-stops an original-audio clip once its end time is reached, since
  // <audio> only knows how to play from a point onward, never "until."
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

  useEffect(() => {
    if (!result?.slots || result.bpm == null) return;
    const player = stackPlayerRef.current;
    if (!player) return;
    setSamplesLoading(true);
    player.loadSlots(result.slots.map((s) => ({ slot: s.label, kit: DEFAULT_KIT }))).then(() => setSamplesLoading(false));
  }, [result]);

  function playClip(clipKey: string, startSeconds: number, endSeconds: number) {
    const audio = audioRef.current;
    if (!audio) return;
    stackPlayerRef.current?.stop();
    setIsPlayingArrangement(false);
    setPlayingSlot(null);
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

  function stopSynthPlayback() {
    stackPlayerRef.current?.stop();
    setIsPlayingArrangement(false);
    setPlayingSlot(null);
    setArrangementProgress(null);
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }

  function trackProgress() {
    const player = stackPlayerRef.current;
    if (!player) return;
    const p = player.getProgress();
    if (!p) {
      setIsPlayingArrangement(false);
      setPlayingSlot(null);
      setArrangementProgress(null);
      return;
    }
    setArrangementProgress(p);
    rafRef.current = requestAnimationFrame(trackProgress);
  }

  async function previewSlot(slot: FullSongSlot) {
    const player = stackPlayerRef.current;
    if (!player || !result?.bpm || !result.measureLength) return;
    audioRef.current?.pause();
    stopAtRef.current = null;
    setPlayingClip(null);
    if (playingSlot === slot.label && player.isPlaying()) {
      stopSynthPlayback();
      return;
    }
    player.stop();
    const lines = deserializeLines(slot.lines);
    await player.play([{ slot: slot.label, lines, measureLength: result.measureLength }], result.bpm, false);
    setPlayingSlot(slot.label);
    setIsPlayingArrangement(false);
    trackProgress();
  }

  async function toggleArrangementPlayback() {
    const player = stackPlayerRef.current;
    if (!player || !result?.slots || !result.arrangement || !result.bpm || !result.measureLength) return;
    audioRef.current?.pause();
    stopAtRef.current = null;
    setPlayingClip(null);
    if (player.isPlaying()) {
      stopSynthPlayback();
      return;
    }
    const linesBySlot = new Map(result.slots.map((s) => [s.label, deserializeLines(s.lines)]));
    const steps: StackStepSource[] = [];
    for (const step of result.arrangement) {
      const lines = linesBySlot.get(step.slotLabel);
      if (lines) steps.push({ slot: step.slotLabel, lines, measureLength: result.measureLength });
    }
    await player.play(steps, result.bpm, loop);
    setIsPlayingArrangement(true);
    setPlayingSlot(null);
    trackProgress();
  }

  function reset() {
    clearPoll();
    stopSynthPlayback();
    audioRef.current?.pause();
    stopAtRef.current = null;
    setPlayingClip(null);
    setPhase("idle");
    setProgress(0);
    setErrorMessage(null);
    setResult(null);
    setFilename("");
    setImportId(null);
    setPipelineStatus("uploaded");
  }

  async function handleFile(file: File) {
    setPhase("uploading");
    setErrorMessage(null);
    setFilename(file.name);
    setPipelineStatus("uploaded");
    try {
      const blob = await upload(file.name, file, {
        access: "private",
        handleUploadUrl: "/api/imports/upload-token",
        onUploadProgress: ({ percentage }) => setProgress(percentage),
      });

      const res = await fetch("/api/full-imports", {
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
      setElapsedSeconds(0);
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
        const res = await fetch(`/api/full-imports/${id}`);
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
        setPipelineStatus(data.status);
        pollTimerRef.current = window.setTimeout(tick, POLL_INTERVAL_MS);
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : "Lost track of this import");
        setPhase("error");
      }
    }
    tick();
  }

  const grooveCount = useMemo(() => result?.slots?.filter((s) => s.kind === "groove").length ?? 0, [result]);
  const fillCount = useMemo(() => result?.slots?.filter((s) => s.kind === "fill").length ?? 0, [result]);
  const sections = useMemo(() => (result?.arrangement ? collapseArrangementIntoSections(result.arrangement) : []), [result]);
  const playDisabled = samplesLoading || !result?.arrangement || result.arrangement.length === 0;

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Always mounted so the timeupdate/ended listener effect above — which
          runs once, on mount — has an element to attach to. */}
      <audio ref={audioRef} src={importId ? `/api/full-imports/${importId}/audio` : undefined} preload="none" />
      <div className="border-b border-white/10 px-4 py-4 sm:px-6">
        <h1 className="text-xl font-black tracking-tight sm:text-2xl">
          Rhythm Detection <span className="text-yellow-400">Test</span>
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-white/50">
          Private harness for the AI transcription pipeline — not linked from anywhere in the app. Built for how a
          drummer actually covers a song: the main beat for each section (verse, chorus, pre-chorus, bridge, ...)
          plus a few genuinely notable fills — not every statistically-distinct bar, and not sparse/partial ones.
          Up to 8 slots, not capped at four like a real page, only if the song actually needs that many. Nothing
          here saves; drums only, no vocals/bass layering for now.
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
          <div className="flex max-w-md flex-col items-start gap-3">
            <div className="flex items-center gap-3">
              <div className="h-6 w-6 shrink-0 animate-spin rounded-full border-2 border-white/20 border-t-yellow-400" />
              <span className="font-mono text-sm text-white/70">{formatTimestamp(elapsedSeconds)} elapsed</span>
            </div>

            <ol className="flex w-full items-center gap-1.5">
              {[
                { label: "Separating drums", active: pipelineStatus === "uploaded" || pipelineStatus === "processing", done: pipelineStatus === "transcribing" },
                { label: "Transcribing rhythm", active: pipelineStatus === "transcribing", done: false },
              ].map((step, i) => (
                <li key={step.label} className="flex flex-1 items-center gap-1.5">
                  <span
                    className={[
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                      step.done
                        ? "bg-yellow-400 text-slate-900"
                        : step.active
                          ? "border border-yellow-400 text-yellow-400"
                          : "border border-white/20 text-white/30",
                    ].join(" ")}
                  >
                    {step.done ? "✓" : i + 1}
                  </span>
                  <span className={step.active || step.done ? "text-xs text-white/80" : "text-xs text-white/30"}>{step.label}</span>
                  {i === 0 && <span className="h-px flex-1 bg-white/10" />}
                </li>
              ))}
            </ol>

            <p className="text-xs text-white/50">
              {pipelineStatus === "transcribing"
                ? "Drums separated — computing the pattern now, this part is quick."
                : "Isolating the drum track on Replicate — usually the slow part, often a minute or two for a full song."}
            </p>

            {elapsedSeconds >= 90 && elapsedSeconds < 240 && (
              <p className="text-xs text-yellow-400/80">
                Still going — longer songs can take a few minutes here. No news is fine.
              </p>
            )}
            {elapsedSeconds >= 240 && (
              <div className="flex flex-col items-start gap-2 rounded-md border border-red-400/30 bg-red-400/5 px-3 py-2">
                <p className="text-xs text-red-300">
                  This is taking much longer than usual. It may have stalled (the job silently died server-side
                  without recording an error) rather than actually still working.
                </p>
                <button
                  type="button"
                  onClick={reset}
                  className="rounded-md border border-white/15 px-3 py-1 text-xs text-white/70 transition hover:border-yellow-400 hover:text-yellow-400"
                >
                  Cancel and try again
                </button>
              </div>
            )}
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

        {phase === "done" && result?.slots && result.arrangement && (
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-white/50">&quot;{filename}&quot;</p>
              <p className="text-sm text-white/80">
                ~<span className="font-bold text-yellow-400">{result.bpm} BPM</span>
              </p>
              <p className="text-sm text-white/80">
                <span className="font-bold text-yellow-400">{result.slots.length}</span> slot
                {result.slots.length === 1 ? "" : "s"} ({grooveCount} groove{grooveCount === 1 ? "" : "s"},{" "}
                {fillCount} fill{fillCount === 1 ? "" : "s"})
              </p>
              <p className="text-sm text-white/80">
                <span className="font-bold text-yellow-400">{result.arrangement.length}</span> bars sequenced
              </p>
              <button
                type="button"
                onClick={reset}
                className="ml-auto rounded-md border border-white/15 px-3 py-1.5 text-sm text-white/70 transition hover:border-yellow-400 hover:text-yellow-400"
              >
                Try another song
              </button>
            </div>

            {/* Whole-song playback — Stacks, generated instead of hand-built */}
            <section className="flex flex-col gap-3 rounded-xl bg-white/5 p-4">
              <div className="flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={toggleArrangementPlayback}
                  disabled={playDisabled}
                  className="rounded-full bg-yellow-400 px-6 py-2 font-bold text-slate-900 transition hover:bg-yellow-300 disabled:opacity-30"
                >
                  {isPlayingArrangement ? "■ Stop" : "▶ Play whole song"}
                </button>
                <label className="flex items-center gap-1.5 text-sm text-white/60">
                  <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} className="accent-yellow-400" />
                  Loop
                </label>
                <span className="text-sm text-white/50">
                  {samplesLoading
                    ? "Loading drum sounds…"
                    : `${formatTimestamp(arrangementProgress?.elapsed ?? 0)} / ${formatTimestamp(
                        arrangementProgress?.total ?? (60 / result.bpm!) * result.measureLength! * result.arrangement.length
                      )}`}
                </span>
              </div>

              <div className="flex flex-col gap-1.5">
                <p className="text-xs uppercase tracking-wide text-white/40">Song sections</p>
                {sections.map((sec, i) => (
                  <div
                    key={i}
                    className="flex flex-wrap items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm"
                  >
                    <span className="font-mono text-yellow-400">{sec.motif.join(" → ")}</span>
                    <span className="text-white/40">
                      {formatTimestamp(sec.startSeconds)}–{formatTimestamp(sec.endSeconds)}
                    </span>
                    {sec.repeatCount > 1 && <span className="text-white/40">×{sec.repeatCount}</span>}
                  </div>
                ))}
              </div>

              <details>
                <summary className="cursor-pointer text-xs text-white/40 hover:text-yellow-400">
                  Bar-by-bar ({result.arrangement.length} bars)
                </summary>
                <div className="mt-2 flex flex-wrap gap-1 overflow-x-auto">
                  {result.arrangement.map((step, i) => (
                    <span
                      key={i}
                      title={`Bar ${step.barIndex} — ${formatTimestamp(step.startSeconds)}–${formatTimestamp(step.endSeconds)}`}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-white/10 bg-white/5 font-mono text-xs text-white/60"
                    >
                      {step.slotLabel}
                    </span>
                  ))}
                </div>
              </details>
            </section>

            {/* Per-slot detail: preview the synthesized pattern, or play the
                exact original-audio clip it was drawn from. */}
            <ul className="flex flex-col gap-1.5">
              {result.slots.map((slot) => (
                <li
                  key={slot.label}
                  className="flex flex-wrap items-center gap-2 rounded-md border border-white/10 px-3 py-1.5 text-sm"
                >
                  <span className="font-mono text-yellow-400">Slot {slot.label}</span>
                  <span className="text-white/60">{slot.kind === "groove" ? "Groove" : "Fill"}</span>
                  <span className="text-white/40">
                    {slot.lines.length} instrument{slot.lines.length === 1 ? "" : "s"} · {slot.repeatCount} bar
                    {slot.repeatCount === 1 ? "" : "s"} in song
                  </span>

                  <button
                    type="button"
                    onClick={() => previewSlot(slot)}
                    disabled={samplesLoading}
                    className={[
                      "rounded-md border px-2 py-0.5 text-xs transition disabled:opacity-30",
                      playingSlot === slot.label
                        ? "border-yellow-400 bg-yellow-400/10 text-yellow-400"
                        : "border-white/15 text-white/60 hover:border-yellow-400 hover:text-yellow-400",
                    ].join(" ")}
                  >
                    {playingSlot === slot.label ? "■ Stop" : "▶ Preview pattern"}
                  </button>

                  {slot.sampleRange && importId && (
                    <button
                      type="button"
                      onClick={() => playClip(`slot-${slot.label}`, slot.sampleRange![0], slot.sampleRange![1])}
                      title="Play the original audio this pattern was drawn from"
                      className={[
                        "rounded-md border px-2 py-0.5 font-mono text-xs transition",
                        playingClip === `slot-${slot.label}`
                          ? "border-yellow-400 bg-yellow-400/10 text-yellow-400"
                          : "border-white/15 text-white/60 hover:border-yellow-400 hover:text-yellow-400",
                      ].join(" ")}
                    >
                      {playingClip === `slot-${slot.label}` ? "■ " : "▶ "}
                      {formatTimestamp(slot.sampleRange[0])}–{formatTimestamp(slot.sampleRange[1])}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
