"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { DEFAULT_KIT } from "@/lib/drumKits";
import { SLOT_LETTERS, SlotLetter } from "@/lib/board";
import { InstrumentId } from "@/lib/instruments";
import { MAX_BEATS, StoredLine } from "@/lib/song";
import { quantizeClipToLines } from "@/lib/quantizeClip";
import { NO_PASSWORD_MANAGER_ATTRS } from "@/lib/formAttrs";

type Phase = "idle" | "uploading" | "processing" | "ready" | "error";
type PipelineStatus = "uploaded" | "processing" | "transcribing" | "done" | "error";

interface AnalysisOnset {
  time: number;
  instrument: InstrumentId;
}

interface AnalysisResult {
  status: PipelineStatus;
  errorMessage: string | null;
  bpm: number | null;
  beatSeconds: number | null;
  gridOrigin: number | null;
  durationSeconds: number | null;
  onsets: AnalysisOnset[] | null;
}

interface SlotCrop {
  startBeat: number;
  blockCount: number;
  lines: StoredLine[];
}

const POLL_INTERVAL_MS = 3000;
const PIXELS_PER_SECOND = 80;
const WAVEFORM_HEIGHT = 120;

function formatTimestamp(seconds: number): string {
  if (!Number.isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds - m * 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Downsamples decoded audio into one [min,max] pair per horizontal pixel —
// the standard "waveform peaks" technique. Mixes to mono first since stereo
// left/right differences don't matter for spotting a groove by eye.
function computePeaks(buffer: AudioBuffer, pixelWidth: number): Float32Array {
  const channels = buffer.numberOfChannels;
  const length = buffer.length;
  const mono = new Float32Array(length);
  for (let c = 0; c < channels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < length; i++) mono[i] += data[i] / channels;
  }
  const peaks = new Float32Array(pixelWidth * 2);
  const samplesPerPixel = Math.max(1, Math.floor(length / pixelWidth));
  for (let px = 0; px < pixelWidth; px++) {
    const start = px * samplesPerPixel;
    const end = Math.min(length, start + samplesPerPixel);
    let min = 0;
    let max = 0;
    for (let i = start; i < end; i++) {
      const v = mono[i];
      if (v < min) min = v;
      if (v > max) max = v;
    }
    peaks[px * 2] = min;
    peaks[px * 2 + 1] = max;
  }
  return peaks;
}

// Which beat index (relative to the whole-song grid — can be fractional
// mid-drag) a given x pixel corresponds to.
function beatAtX(x: number, gridOrigin: number, beatSeconds: number): number {
  const seconds = x / PIXELS_PER_SECOND;
  return (seconds - gridOrigin) / beatSeconds;
}

function xAtBeat(beat: number, gridOrigin: number, beatSeconds: number): number {
  return (gridOrigin + beat * beatSeconds) * PIXELS_PER_SECOND;
}

// Resolves a drag (anchor + current pointer position, both in beats) into a
// selection — anchored at wherever the drag started, capped at 7 blocks in
// whichever direction it's dragged, rather than letting the near edge slide
// once the far edge would exceed the cap.
function resolveDragSelection(anchorBeat: number, hoveredBeat: number): { startBeat: number; blockCount: number } {
  const rounded = Math.round(hoveredBeat);
  if (rounded >= anchorBeat) {
    return { startBeat: anchorBeat, blockCount: Math.min(MAX_BEATS, rounded - anchorBeat + 1) };
  }
  const blockCount = Math.min(MAX_BEATS, anchorBeat - rounded + 1);
  return { startBeat: anchorBeat - blockCount + 1, blockCount };
}

// The manual-crop harness: upload a song, isolate the drums and detect its
// beat grid once (the one slow, Replicate-backed step), then let a drummer
// pick up to 4 clips by ear — dragging directly on the waveform, snapped to
// the beat grid, up to 7 blocks each — and quantize each into a Slot's
// pattern. From there it's the normal RockBlocks experience: save a name
// and land on a real, fully editable page.
export function SongCropTool() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus>("uploaded");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);

  const [peaks, setPeaks] = useState<Float32Array | null>(null);
  const [waveformWidth, setWaveformWidth] = useState(0);
  const [decodeError, setDecodeError] = useState<string | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [playheadSeconds, setPlayheadSeconds] = useState(0);

  const [dragStartBeat, setDragStartBeat] = useState<number | null>(null);
  const [dragHoveredBeat, setDragHoveredBeat] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [selection, setSelection] = useState<{ startBeat: number; blockCount: number } | null>(null);
  const [previewingSelection, setPreviewingSelection] = useState(false);

  const [activeSlot, setActiveSlot] = useState<SlotLetter>("A");
  const [slots, setSlots] = useState<Partial<Record<SlotLetter, SlotCrop>>>({});

  const [pageName, setPageName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [takenName, setTakenName] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollTimerRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const stopAtRef = useRef<number | null>(null);

  function clearPoll() {
    if (pollTimerRef.current !== null) {
      window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }

  useEffect(() => {
    if (phase !== "processing") return;
    const start = Date.now();
    const id = window.setInterval(() => setElapsedSeconds(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => window.clearInterval(id);
  }, [phase]);

  useEffect(() => clearPoll, []);

  // Decode the original upload once analysis is ready, and compute waveform
  // peaks at a fixed zoom level (PIXELS_PER_SECOND) — the whole point of
  // playing the original (not the isolated drums) here is so a drummer can
  // recognize *where* in the song they are (a verse, the chorus, ...) by
  // ear, same as they would learning the song normally.
  useEffect(() => {
    if (phase !== "ready" || !analysisId || !analysis?.durationSeconds) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/song-analyses/${analysisId}/audio`);
        if (!res.ok) throw new Error("Couldn't load the audio for the waveform");
        const arrayBuffer = await res.arrayBuffer();
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AC();
        const decoded = await ctx.decodeAudioData(arrayBuffer);
        await ctx.close();
        if (cancelled) return;
        const width = Math.ceil(decoded.duration * PIXELS_PER_SECOND);
        setWaveformWidth(width);
        setPeaks(computePeaks(decoded, width));
      } catch (err) {
        if (!cancelled) setDecodeError(err instanceof Error ? err.message : "Couldn't render the waveform");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, analysisId]);

  // Draws the static peaks + beat grid + onset ticks once peaks are ready —
  // selection and playhead are separate absolutely-positioned overlays so
  // dragging/playback don't force a full waveform redraw every frame.
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !peaks || !analysis?.gridOrigin || !analysis.beatSeconds) return;
    canvas.width = waveformWidth;
    canvas.height = WAVEFORM_HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, waveformWidth, WAVEFORM_HEIGHT);

    const mid = WAVEFORM_HEIGHT / 2;
    ctx.fillStyle = "#facc15";
    for (let x = 0; x < waveformWidth; x++) {
      const min = peaks[x * 2];
      const max = peaks[x * 2 + 1];
      const y1 = mid - max * mid;
      const y2 = mid - min * mid;
      ctx.fillRect(x, y1, 1, Math.max(1, y2 - y1));
    }

    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1;
    const { gridOrigin, beatSeconds } = analysis;
    let beatIndex = Math.ceil(-gridOrigin / beatSeconds);
    for (;;) {
      const x = Math.round(xAtBeat(beatIndex, gridOrigin, beatSeconds));
      if (x > waveformWidth) break;
      if (x >= 0) {
        ctx.beginPath();
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, WAVEFORM_HEIGHT);
        ctx.stroke();
      }
      beatIndex++;
    }

    if (analysis.onsets) {
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      for (const onset of analysis.onsets) {
        const x = Math.round(onset.time * PIXELS_PER_SECOND);
        ctx.fillRect(x, WAVEFORM_HEIGHT - 4, 1, 4);
      }
    }
  }, [peaks, waveformWidth, analysis]);

  // rAF playhead tracking — writes directly to the DOM rather than through
  // React state so a moving playhead doesn't re-render the whole tool 60x/s.
  const playheadRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isPlaying) return;
    function tick() {
      const audio = audioRef.current;
      if (!audio) return;
      const x = audio.currentTime * PIXELS_PER_SECOND;
      if (playheadRef.current) playheadRef.current.style.left = `${x}px`;
      setPlayheadSeconds(audio.currentTime);
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    function onTimeUpdate() {
      if (stopAtRef.current !== null && audio!.currentTime >= stopAtRef.current) {
        audio!.pause();
        stopAtRef.current = null;
      }
    }
    function onPlay() {
      setIsPlaying(true);
    }
    function onPause() {
      setIsPlaying(false);
      setPreviewingSelection(false);
    }
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
    };
  }, []);

  function reset() {
    clearPoll();
    setPhase("idle");
    setProgress(0);
    setErrorMessage(null);
    setAnalysisId(null);
    setPipelineStatus("uploaded");
    setElapsedSeconds(0);
    setAnalysis(null);
    setPeaks(null);
    setWaveformWidth(0);
    setDecodeError(null);
    setSelection(null);
    setSlots({});
    setActiveSlot("A");
    setPageName("");
    setSaveError(null);
    setTakenName(null);
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

      const res = await fetch("/api/song-analyses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blobUrl: blob.url, originalFilename: file.name }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Couldn't start the analysis");
      }
      const { id } = (await res.json()) as { id: string };
      setAnalysisId(id);
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
        const res = await fetch(`/api/song-analyses/${id}`);
        if (!res.ok) throw new Error("Lost track of this analysis");
        const data = (await res.json()) as AnalysisResult;
        if (data.status === "done") {
          setAnalysis(data);
          setPhase("ready");
          return;
        }
        if (data.status === "error") {
          setErrorMessage(data.errorMessage ?? "Something went wrong analyzing this song.");
          setPhase("error");
          return;
        }
        setPipelineStatus(data.status);
        pollTimerRef.current = window.setTimeout(tick, POLL_INTERVAL_MS);
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : "Lost track of this analysis");
        setPhase("error");
      }
    }
    tick();
  }

  const clampBeat = useCallback(
    (raw: number) => {
      if (!analysis?.durationSeconds || !analysis.beatSeconds) return raw;
      const maxBeat = analysis.durationSeconds / analysis.beatSeconds;
      return Math.max(0, Math.min(raw, maxBeat));
    },
    [analysis]
  );

  function handleMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (!analysis?.gridOrigin || !analysis.beatSeconds || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + containerRef.current.scrollLeft;
    const seconds = x / PIXELS_PER_SECOND;
    audioRef.current?.pause();
    stopAtRef.current = null;
    if (audioRef.current) audioRef.current.currentTime = seconds;
    setPlayheadSeconds(seconds);
    if (playheadRef.current) playheadRef.current.style.left = `${x}px`;

    const startBeat = Math.round(clampBeat(beatAtX(x, analysis.gridOrigin, analysis.beatSeconds)));
    setDragStartBeat(startBeat);
    setDragHoveredBeat(startBeat);
    setDragging(true);
  }

  useEffect(() => {
    if (!dragging) return;
    function onMove(e: MouseEvent) {
      if (dragStartBeat === null || !analysis?.gridOrigin || !analysis.beatSeconds || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left + containerRef.current.scrollLeft;
      setDragHoveredBeat(clampBeat(beatAtX(x, analysis.gridOrigin, analysis.beatSeconds)));
    }
    function onUp() {
      setDragging(false);
      if (dragStartBeat === null || dragHoveredBeat === null) return;
      setSelection(resolveDragSelection(dragStartBeat, dragHoveredBeat));
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging, dragStartBeat, dragHoveredBeat, analysis, clampBeat]);

  function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      stopAtRef.current = null;
      audio.play();
    }
  }

  function previewSelection() {
    const audio = audioRef.current;
    if (!audio || !selection || !analysis?.gridOrigin || !analysis.beatSeconds) return;
    const start = analysis.gridOrigin + selection.startBeat * analysis.beatSeconds;
    const end = start + selection.blockCount * analysis.beatSeconds;
    if (previewingSelection) {
      audio.pause();
      stopAtRef.current = null;
      return;
    }
    stopAtRef.current = end;
    audio.currentTime = start;
    audio.play();
    setPreviewingSelection(true);
  }

  function assignSelectionToSlot() {
    if (!selection || !analysis?.gridOrigin || !analysis.beatSeconds || !analysis.onsets) return;
    const clipStartSeconds = analysis.gridOrigin + selection.startBeat * analysis.beatSeconds;
    const lines = quantizeClipToLines(analysis.onsets, analysis.gridOrigin, analysis.beatSeconds, clipStartSeconds, selection.blockCount);
    setSlots((prev) => ({ ...prev, [activeSlot]: { startBeat: selection.startBeat, blockCount: selection.blockCount, lines } }));
    const nextEmpty = SLOT_LETTERS.find((l) => l !== activeSlot && !slots[l]);
    if (nextEmpty) setActiveSlot(nextEmpty);
    setSelection(null);
  }

  async function createPage() {
    const name = pageName.trim();
    if (!name || !analysis?.bpm) return;
    const slotPayload: Partial<Record<SlotLetter, { bpm: number; lines: StoredLine[]; kit: string }>> = {};
    for (const letter of SLOT_LETTERS) {
      const crop = slots[letter];
      if (crop) slotPayload[letter] = { bpm: Math.round(analysis.bpm), lines: crop.lines, kit: DEFAULT_KIT };
    }
    if (Object.keys(slotPayload).length === 0) return;

    setSaving(true);
    setSaveError(null);
    setTakenName(null);
    try {
      const res = await fetch("/api/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slots: slotPayload }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string; displayName?: string } | null;
      if (!res.ok) {
        if (res.status === 409) setTakenName(name);
        else setSaveError(data?.error ?? "Couldn't save that page — try again.");
        setSaving(false);
        return;
      }
      router.push(`/${data?.displayName ?? name}`);
    } catch {
      setSaveError("Couldn't save — try again.");
      setSaving(false);
    }
  }

  const selectionLeft = useMemo(
    () => (selection && analysis?.gridOrigin != null && analysis.beatSeconds ? xAtBeat(selection.startBeat, analysis.gridOrigin, analysis.beatSeconds) : null),
    [selection, analysis]
  );
  const selectionWidth = useMemo(
    () => (selection && analysis?.beatSeconds ? selection.blockCount * analysis.beatSeconds * PIXELS_PER_SECOND : 0),
    [selection, analysis]
  );
  const liveDrag = useMemo(() => {
    if (!dragging || dragStartBeat === null || dragHoveredBeat === null) return null;
    return resolveDragSelection(dragStartBeat, dragHoveredBeat);
  }, [dragging, dragStartBeat, dragHoveredBeat]);
  const dragLeft = useMemo(
    () => (liveDrag && analysis?.gridOrigin != null && analysis.beatSeconds ? xAtBeat(liveDrag.startBeat, analysis.gridOrigin, analysis.beatSeconds) : null),
    [liveDrag, analysis]
  );
  const filledSlotCount = SLOT_LETTERS.filter((l) => slots[l]).length;

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      <audio ref={audioRef} src={analysisId ? `/api/song-analyses/${analysisId}/audio` : undefined} preload="auto" />
      <div className="border-b border-white/10 px-4 py-4 sm:px-6">
        <h1 className="text-xl font-black tracking-tight sm:text-2xl">
          Song <span className="text-yellow-400">Crop</span> Test
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-white/50">
          Private harness, not linked from anywhere in the app. Upload a song, then pick up to 4 clips yourself —
          drag on the waveform, snapped to the beat grid, up to 7 blocks each — and drop them into Slots A-D.
          Nothing&apos;s guessed for you: you pick the main beat and fills exactly like covering the song by ear.
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
                { label: "Detecting the beat grid", active: pipelineStatus === "transcribing", done: false },
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
            {elapsedSeconds >= 90 && elapsedSeconds < 240 && (
              <p className="text-xs text-yellow-400/80">Still going — longer songs can take a few minutes here.</p>
            )}
            {elapsedSeconds >= 240 && (
              <div className="flex flex-col items-start gap-2 rounded-md border border-red-400/30 bg-red-400/5 px-3 py-2">
                <p className="text-xs text-red-300">This is taking much longer than usual — it may have stalled.</p>
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

        {phase === "ready" && analysis && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-white/80">
                ~<span className="font-bold text-yellow-400">{Math.round(analysis.bpm ?? 0)} BPM</span>
              </p>
              <button
                type="button"
                onClick={reset}
                className="ml-auto rounded-md border border-white/15 px-3 py-1.5 text-sm text-white/70 transition hover:border-yellow-400 hover:text-yellow-400"
              >
                Try another song
              </button>
            </div>

            {decodeError && <p className="text-sm text-red-400">{decodeError}</p>}

            {/* Transport */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={togglePlayback}
                className="rounded-full bg-yellow-400 px-5 py-1.5 text-sm font-bold text-slate-900 transition hover:bg-yellow-300"
              >
                {isPlaying ? "■ Stop" : "▶ Play"}
              </button>
              <span className="font-mono text-sm text-white/60">
                {formatTimestamp(playheadSeconds)} / {formatTimestamp(analysis.durationSeconds ?? 0)}
              </span>
              <span className="text-xs text-white/40">Click to seek · drag to select up to 7 blocks</span>
            </div>

            {/* Waveform */}
            <div ref={containerRef} className="relative w-full overflow-x-auto rounded-md border border-white/10 bg-black/30" style={{ height: WAVEFORM_HEIGHT }}>
              <div className="relative" style={{ width: waveformWidth, height: WAVEFORM_HEIGHT }} onMouseDown={handleMouseDown}>
                <canvas ref={canvasRef} className="absolute inset-0" style={{ width: waveformWidth, height: WAVEFORM_HEIGHT }} />
                {!peaks && !decodeError && (
                  <div className="absolute inset-0 flex items-center justify-center text-xs text-white/40">Rendering waveform…</div>
                )}
                {liveDrag && dragLeft !== null && analysis.beatSeconds && (
                  <div
                    className="pointer-events-none absolute top-0 border-2 border-yellow-400 bg-yellow-400/20"
                    style={{ left: dragLeft, width: liveDrag.blockCount * analysis.beatSeconds * PIXELS_PER_SECOND, height: WAVEFORM_HEIGHT }}
                  />
                )}
                {!dragging && selection && selectionLeft !== null && (
                  <div
                    className="pointer-events-none absolute top-0 border-2 border-yellow-400 bg-yellow-400/10"
                    style={{ left: selectionLeft, width: selectionWidth, height: WAVEFORM_HEIGHT }}
                  />
                )}
                <div ref={playheadRef} className="pointer-events-none absolute top-0 h-full w-px bg-white" style={{ left: 0 }} />
              </div>
            </div>

            {(dragging || selection) && (
              <div className="flex flex-wrap items-center gap-3 rounded-md border border-white/10 bg-white/5 px-3 py-2">
                <span className="text-sm text-white/80">
                  {liveDrag ? liveDrag.blockCount : selection?.blockCount} block
                  {(liveDrag ? liveDrag.blockCount : selection?.blockCount) === 1 ? "" : "s"} selected
                </span>
                {!dragging && selection && (
                  <>
                    <button
                      type="button"
                      onClick={previewSelection}
                      className={[
                        "rounded-md border px-3 py-1 text-xs transition",
                        previewingSelection
                          ? "border-yellow-400 bg-yellow-400/10 text-yellow-400"
                          : "border-white/15 text-white/70 hover:border-yellow-400 hover:text-yellow-400",
                      ].join(" ")}
                    >
                      {previewingSelection ? "■ Stop" : "▶ Preview clip"}
                    </button>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-white/50">Assign to</span>
                      <div className="flex overflow-hidden rounded-md border border-white/15">
                        {SLOT_LETTERS.map((letter) => (
                          <button
                            key={letter}
                            type="button"
                            onClick={() => setActiveSlot(letter)}
                            className={[
                              "flex h-7 w-7 items-center justify-center text-xs font-semibold transition",
                              letter === activeSlot ? "bg-yellow-400 text-slate-900" : "bg-white/5 text-white/60 hover:bg-white/10",
                            ].join(" ")}
                          >
                            {letter}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={assignSelectionToSlot}
                      className="rounded-full bg-yellow-400 px-4 py-1 text-xs font-bold text-slate-900 transition hover:bg-yellow-300"
                    >
                      Use for Slot {activeSlot}
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Slot summary */}
            <ul className="flex flex-wrap gap-1.5">
              {SLOT_LETTERS.map((letter) => {
                const crop = slots[letter];
                return (
                  <li
                    key={letter}
                    className={[
                      "flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm",
                      crop ? "border-yellow-400/40 bg-yellow-400/5" : "border-white/10",
                    ].join(" ")}
                  >
                    <span className="font-mono text-yellow-400">Slot {letter}</span>
                    {crop ? (
                      <span className="text-white/60">
                        {crop.blockCount} block{crop.blockCount === 1 ? "" : "s"} · {crop.lines.length} instrument
                        {crop.lines.length === 1 ? "" : "s"}
                      </span>
                    ) : (
                      <span className="text-white/30">Not set</span>
                    )}
                    {crop && (
                      <button
                        type="button"
                        onClick={() => setSlots((prev) => ({ ...prev, [letter]: undefined }))}
                        className="text-xs text-white/40 underline decoration-dotted hover:text-red-400"
                      >
                        Clear
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>

            {/* Save */}
            {filledSlotCount > 0 && (
              <div className="flex flex-wrap items-end gap-2 rounded-md border border-white/10 bg-white/5 p-3">
                <label className="flex flex-col gap-1 text-sm text-white/70">
                  Save as a new page
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-white/40">/</span>
                    <input
                      {...NO_PASSWORD_MANAGER_ATTRS}
                      value={pageName}
                      onChange={(e) => {
                        setPageName(e.target.value);
                        setTakenName(null);
                        setSaveError(null);
                      }}
                      placeholder="PageName"
                      maxLength={24}
                      className="rounded-md border border-white/15 bg-white/5 px-2 py-1.5 text-base text-white placeholder:text-white/30 focus:border-yellow-400 focus:outline-none sm:text-sm"
                    />
                  </div>
                </label>
                <button
                  type="button"
                  onClick={createPage}
                  disabled={saving || pageName.trim().length === 0}
                  className="rounded-full bg-yellow-400 px-4 py-1.5 text-sm font-bold text-slate-900 transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {saving ? "Saving…" : "Save & Open"}
                </button>
                {saveError && <p className="text-sm text-red-400">{saveError}</p>}
                {takenName && <p className="text-xs text-white/40">/{takenName} is already taken — try another name.</p>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
