// Shared helpers for FractalVideoExportView's canvas+MediaRecorder pipeline
// — the pieces that are pure logic (no DOM/canvas access), split out so
// they're easy to reason about (and re-derive by hand) independent of the
// recording machinery itself.

// A shareable clip should feel intentional, not arbitrarily cut off: land
// in the 7-10s sweet spot when the beat allows it, never exceed 15s, and
// never stop a loop mid-bar to hit that cap.
export const TARGET_MIN_SECONDS = 7;
export const HARD_CAP_SECONDS = 15;

// How many whole repeats of a `loopSeconds`-long beat to bake into one clip.
// Whole repeats only — the audio and the fractal's reveal-then-hold cycle
// both restart together at each repeat, so a partial one would cut the
// drawing off mid-reveal and the audio off mid-bar, undoing the "loops
// cleanly" point of the feature.
export function pickLoopCount(loopSeconds: number): number {
  if (loopSeconds <= 0) return 1;
  const loopsToReachMin = Math.ceil(TARGET_MIN_SECONDS / loopSeconds);
  if (loopsToReachMin * loopSeconds <= HARD_CAP_SECONDS) return Math.max(1, loopsToReachMin);
  // Reaching 7s would already blow past 15s (a long pattern at a slow
  // tempo) — use as many whole repeats as fit under the cap, or just one
  // if even a single repeat alone is already longer than that: a beat
  // that long has to play out in full to not sound cut off, cap or no cap.
  return Math.max(1, Math.floor(HARD_CAP_SECONDS / loopSeconds));
}

// How long (from the start of each repeat) the fractal spends "coming
// alive" before holding at its finished state for the rest of that repeat.
// Scales with the repeat's own length so a short loop doesn't feel rushed
// and a long one doesn't spend the whole clip mid-reveal with no time to
// actually look at the finished piece.
export function pickRevealSeconds(loopSeconds: number): number {
  return Math.min(Math.max(1, loopSeconds - 0.5), 6);
}

// Ease-in-out: the reveal starts and ends gently rather than at a constant
// rate, which reads more like something "coming alive" than a progress bar.
export function easeInOut(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

export interface RecordingFormat {
  mimeType: string;
  extension: string;
}

// MP4 (H.264/AAC) is what actually uploads cleanly to Instagram/TikTok from
// a phone without the platform re-transcoding it first, but MediaRecorder
// support for it is inconsistent — Safari has long supported it, Chrome/Edge
// only on some platforms with a hardware encoder, Firefox not at all. Ask
// for it first and fall back through progressively safer webm variants;
// every browser this feature actually runs in supports at least the last.
const CANDIDATES: RecordingFormat[] = [
  { mimeType: "video/mp4;codecs=avc1,mp4a.40.2", extension: "mp4" },
  { mimeType: "video/mp4", extension: "mp4" },
  { mimeType: "video/webm;codecs=vp9,opus", extension: "webm" },
  { mimeType: "video/webm;codecs=vp8,opus", extension: "webm" },
  { mimeType: "video/webm", extension: "webm" },
];

export function pickRecordingFormat(): RecordingFormat | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const candidate of CANDIDATES) {
    if (MediaRecorder.isTypeSupported(candidate.mimeType)) return candidate;
  }
  return null;
}

export type VideoAspect = "vertical" | "square";

// Recording resolution for each supported aspect — 720px-wide is the
// balance point between "still sharp after Instagram/TikTok's own upload
// compression" and "a `<canvas>` full of thousands of fractal points can
// actually redraw every frame in real time" (this is captured live via
// canvas.captureStream, not rendered offline — it takes exactly as long to
// produce as the clip itself, so frame cost matters).
export function aspectSize(aspect: VideoAspect): { width: number; height: number } {
  return aspect === "vertical" ? { width: 720, height: 1280 } : { width: 720, height: 720 };
}
