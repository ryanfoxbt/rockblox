"use client";

import { useEffect, useRef, useState } from "react";
import { INSTRUMENTS, InstrumentId } from "@/lib/instruments";
import { audioBufferToWavBlob, trimToOnset } from "@/lib/audioTrim";

const MAX_RECORD_SECONDS = 5;
// Output cap, independent of how long the mic ran: keeps every saved take a
// short one-shot starting right on its transient, like a real drum sample.
const MAX_CLIP_SECONDS = 1.2;
const PRE_ROLL_MS = 25;

// Decodes the raw mic recording, trims it down to its onset (see
// audioTrim.ts), and re-encodes as WAV — the blob previewed and saved is
// then exactly what will play back, with no gap before the hit.
async function trimRecordedTake(rawBlob: Blob): Promise<Blob> {
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AC();
  try {
    const decoded = await ctx.decodeAudioData(await rawBlob.arrayBuffer());
    const trimmed = trimToOnset(decoded, { preRollMs: PRE_ROLL_MS, maxDurationSeconds: MAX_CLIP_SECONDS });
    return audioBufferToWavBlob(trimmed);
  } finally {
    ctx.close();
  }
}

// Lets a user record a short mic take and drop it into one Fart-kit slot,
// swapping out that synthesized sound for their own. Scoped narrow on
// purpose: in-browser mic capture only, no file upload, no other kits.
export function FartRecorder({
  onRecorded,
}: {
  onRecorded: (instrument: InstrumentId, arrayBuffer: ArrayBuffer) => void;
}) {
  const [open, setOpen] = useState(false);
  const [instrument, setInstrument] = useState<InstrumentId>("kick");
  const [status, setStatus] = useState<"idle" | "requesting" | "recording" | "recorded" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const takeRef = useRef<ArrayBuffer | null>(null);
  const stopTimerRef = useRef<number | null>(null);

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  function clearStopTimer() {
    if (stopTimerRef.current !== null) {
      window.clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
  }

  function close() {
    stopStream();
    clearStopTimer();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    takeRef.current = null;
    setStatus("idle");
    setErrorMessage(null);
    setOpen(false);
  }

  async function startRecording() {
    setErrorMessage(null);
    setStatus("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stopStream();
        const rawBlob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const trimmedBlob = await trimRecordedTake(rawBlob);
        takeRef.current = await trimmedBlob.arrayBuffer();
        setPreviewUrl(URL.createObjectURL(trimmedBlob));
        setStatus("recorded");
      };
      recorderRef.current = recorder;
      recorder.start();
      setStatus("recording");
      stopTimerRef.current = window.setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, MAX_RECORD_SECONDS * 1000);
    } catch {
      setErrorMessage("Couldn't access your microphone — check this site's mic permission in your browser.");
      setStatus("error");
      stopStream();
    }
  }

  function stopRecording() {
    clearStopTimer();
    recorderRef.current?.stop();
  }

  function reRecord() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    takeRef.current = null;
    setStatus("idle");
  }

  function useTake() {
    if (!takeRef.current) return;
    onRecorded(instrument, takeRef.current);
    close();
  }

  useEffect(() => {
    return () => {
      stopStream();
      clearStopTimer();
    };
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Record your own fart"
        className="rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-sm font-medium text-white/80 transition hover:border-yellow-400 hover:text-yellow-400"
      >
        🎙️ Record your own fart
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={close}>
          <div
            className="w-full max-w-sm rounded-lg border border-white/15 bg-slate-900 p-5 text-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">🎙️ Record your own fart</h2>
              <button
                type="button"
                onClick={close}
                title="Close"
                className="rounded-md px-2 py-0.5 text-white/50 transition hover:text-red-400"
              >
                ✕
              </button>
            </div>

            <label className="mb-1 block text-xs text-white/50" htmlFor="fart-slot">
              Replace which sound?
            </label>
            <select
              id="fart-slot"
              value={instrument}
              onChange={(e) => setInstrument(e.target.value as InstrumentId)}
              disabled={status === "recording"}
              className="mb-3 w-full rounded-md border border-white/10 bg-slate-800 px-2 py-1.5 text-sm text-white disabled:opacity-50"
            >
              {INSTRUMENTS.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>

            {errorMessage && <p className="mb-3 text-xs text-red-400">{errorMessage}</p>}

            {status === "recorded" && previewUrl ? (
              <div className="flex flex-col gap-3">
                <audio controls src={previewUrl} className="w-full" />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={reRecord}
                    className="rounded-md border border-white/15 px-3 py-1.5 text-sm text-white/70 transition hover:border-yellow-400 hover:text-yellow-400"
                  >
                    Re-record
                  </button>
                  <button
                    type="button"
                    onClick={useTake}
                    className="rounded-full bg-yellow-400 px-4 py-1.5 text-sm font-bold text-slate-900 transition hover:bg-yellow-300"
                  >
                    Use this fart
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-3">
                <button
                  type="button"
                  onClick={status === "recording" ? stopRecording : startRecording}
                  disabled={status === "requesting"}
                  className={[
                    "flex h-16 w-16 items-center justify-center rounded-full text-2xl transition disabled:opacity-40",
                    status === "recording" ? "animate-pulse bg-red-500" : "bg-white/10 hover:bg-white/20",
                  ].join(" ")}
                >
                  {status === "recording" ? "■" : "●"}
                </button>
                <p className="text-xs text-white/50">
                  {status === "recording"
                    ? `Recording… tap to stop (max ${MAX_RECORD_SECONDS}s)`
                    : status === "requesting"
                      ? "Asking for mic access…"
                      : "Tap to record a sound from your mic"}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
