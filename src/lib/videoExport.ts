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

// How long the clip opens on the fully-formed piece before clearing and
// rebuilding it from scratch — a "sforzando": sudden and complete, not a
// fade-in, the same way that dynamic marking means a note struck at full
// force rather than swelling into it. Frame 0 of the recording lands inside
// this window, which is also what a platform's own auto-picked thumbnail
// usually is — so the preview a feed shows before anyone taps play is the
// finished artwork, not a near-empty canvas. Long enough to safely cover
// whichever early frame a platform samples, short enough to still read as
// an accent rather than a second clip glued to the front.
export function introSecondsFor(totalSeconds: number): number {
  return Math.min(0.8, totalSeconds * 0.15);
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

// Minimal MP4 box walker — just enough to read the mvhd/mdia duration
// fields, not a general parser. Used to sanity-check the *finished* export
// (post-ffmpeg remux, so a classic single moov+mdat rather than a
// fragmented one) before handing it to the user: canvas.captureStream's
// frames tie into actual browser compositing, not just script execution
// (see FractalVideoExportView's recorder.onerror comment), so if the tab
// loses foreground compositing priority mid-take, MediaRecorder's video
// track can end up dramatically shorter than the audio track it was
// recorded alongside — the CFR re-encode in remuxVideo.ts locks frame
// *rate*, not overall *length*, so a short take stays short. A clip like
// that has plenty of bytes (so the existing empty-recording check misses
// it) but freezes on its last frame while the audio keeps playing once
// uploaded.
export interface Mp4TrackDurations {
  videoSeconds: number | null;
  audioSeconds: number | null;
}

interface Mp4Box {
  type: string;
  contentStart: number;
  contentEnd: number;
}

function readBoxes(dv: DataView, start: number, end: number): Mp4Box[] {
  const boxes: Mp4Box[] = [];
  let pos = start;
  while (pos + 8 <= end) {
    let size = dv.getUint32(pos);
    const type = String.fromCharCode(
      dv.getUint8(pos + 4),
      dv.getUint8(pos + 5),
      dv.getUint8(pos + 6),
      dv.getUint8(pos + 7)
    );
    let headerSize = 8;
    if (size === 1) {
      if (pos + 16 > end) break;
      size = Number(dv.getBigUint64(pos + 8));
      headerSize = 16;
    }
    if (size === 0 || pos + size > end) size = end - pos;
    if (size < headerSize) break;
    boxes.push({ type, contentStart: pos + headerSize, contentEnd: pos + size });
    pos += size;
  }
  return boxes;
}

function findBox(boxes: Mp4Box[], type: string): Mp4Box | undefined {
  return boxes.find((b) => b.type === type);
}

function readFullBoxDurationSeconds(dv: DataView, contentStart: number): number | null {
  try {
    const version = dv.getUint8(contentStart);
    const timescale = version === 1 ? dv.getUint32(contentStart + 20) : dv.getUint32(contentStart + 12);
    const duration =
      version === 1 ? Number(dv.getBigUint64(contentStart + 24)) : dv.getUint32(contentStart + 16);
    if (timescale === 0) return null;
    return duration / timescale;
  } catch {
    return null;
  }
}

export function getMp4TrackDurations(buf: ArrayBuffer): Mp4TrackDurations {
  const result: Mp4TrackDurations = { videoSeconds: null, audioSeconds: null };
  try {
    const dv = new DataView(buf);
    const moov = findBox(readBoxes(dv, 0, buf.byteLength), "moov");
    if (!moov) return result;
    const moovChildren = readBoxes(dv, moov.contentStart, moov.contentEnd);
    for (const trak of moovChildren.filter((b) => b.type === "trak")) {
      const mdia = findBox(readBoxes(dv, trak.contentStart, trak.contentEnd), "mdia");
      if (!mdia) continue;
      const mdiaChildren = readBoxes(dv, mdia.contentStart, mdia.contentEnd);
      const hdlr = findBox(mdiaChildren, "hdlr");
      const mdhd = findBox(mdiaChildren, "mdhd");
      if (!hdlr || !mdhd) continue;
      const handlerType = String.fromCharCode(
        dv.getUint8(hdlr.contentStart + 8),
        dv.getUint8(hdlr.contentStart + 9),
        dv.getUint8(hdlr.contentStart + 10),
        dv.getUint8(hdlr.contentStart + 11)
      );
      const seconds = readFullBoxDurationSeconds(dv, mdhd.contentStart);
      if (seconds === null) continue;
      if (handlerType === "vide") result.videoSeconds = seconds;
      else if (handlerType === "soun") result.audioSeconds = seconds;
    }
  } catch {
    // Malformed/unexpected structure — treated as "couldn't verify" by the
    // caller rather than thrown, since this is only a best-effort check
    // layered on top of an export that otherwise already succeeded.
  }
  return result;
}
