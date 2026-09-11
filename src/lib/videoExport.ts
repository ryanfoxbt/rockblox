// Shared helpers for FractalVideoExportView's canvas+MediaRecorder pipeline
// — the pieces that are pure logic (no DOM/canvas access), split out so
// they're easy to reason about (and re-derive by hand) independent of the
// recording machinery itself.

// The clip is genuinely time-lapse now: the fractal draws continuously
// across the *entire* clip, finishing right as it ends, rather than
// finishing early and holding. That makes the clip's length a real creative
// choice (a slower build reads differently than a quick one) — the user
// picks anywhere in this range rather than the app always picking the
// shortest length that clears some minimum.
export const MIN_CLIP_SECONDS = 7;
export const MAX_CLIP_SECONDS = 15;
export const DEFAULT_CLIP_SECONDS = 10;

// How many whole repeats of a `loopSeconds`-long beat to render enough audio
// for, given the clip is `targetSeconds` long — always at least enough to
// cover the whole clip; the last repeat is simply cut wherever the clip's
// fixed length lands, the same way any music-under-a-social-clip normally
// works, rather than the clip's own length bending to match a bar boundary.
export function loopsForDuration(loopSeconds: number, targetSeconds: number): number {
  if (loopSeconds <= 0) return 1;
  return Math.max(1, Math.ceil(targetSeconds / loopSeconds));
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
