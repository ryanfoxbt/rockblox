// Re-encodes the MP4 MediaRecorder just produced into something that looks
// like ordinary camera footage, before it's ever handed to the user.
//
// Two separate, real problems compound here:
//
// 1. Chrome (and Safari) always write MediaRecorder's MP4 output as a
//    fragmented MP4 whose leading moov atom carries no duration — the
//    mvhd/tkhd/mdhd duration fields are all 0, regardless of whether the
//    recording was flushed once at stop() or periodically via a timeslice.
//    A lenient local player just scans the whole file and plays it back
//    fine, duration bar and all, which is why a freshly recorded/downloaded
//    clip always looks correct locally. See:
//    https://blog.addpipe.com/duration-in-mp4-files-produced-by-chrome-safari/
//
// 2. canvas.captureStream() emits a frame whenever the canvas actually
//    repaints, not on a perfectly even tick — the recording is genuinely
//    variable-frame-rate even though it's nominally "30fps." TikTok's own
//    upload guidance specifically calls out variable frame rate as a cause
//    of audio/video sync issues and stuttering after their re-encode.
//    Simply fixing the container's duration (a stream-copy remux) doesn't
//    touch this — the irregular frame timing is baked into the bitstream
//    itself, and it's what was still producing glitchy, disjointed audio
//    on TikTok specifically even once the file played correctly elsewhere
//    (a lenient/more tolerant pipeline, e.g. Instagram's, can apparently
//    absorb it; TikTok's evidently can't).
//
// The fix for both is a real re-encode (not `-c copy`) that locks the
// output to an actual constant 30fps, re-timing audio against that
// corrected timeline in the process, using settings that match what a
// phone camera would produce (H.264 Main profile, yuv420p, AAC) rather
// than whatever profile Chrome's own encoder happened to choose. ffmpeg.wasm
// runs entirely client-side, so this happens right after recording, before
// the file is ever offered for download — the user only ever sees the
// fixed version.
// Type-only — never actually imported at runtime (see loadFFmpegScript
// below for why) so this line is erased entirely at compile time and never
// reaches the bundler's module graph.
import type { FFmpeg } from "@ffmpeg/ffmpeg";

// Self-hosted (see public/ffmpeg/) rather than pulled from a CDN at
// runtime, so this doesn't depend on a third party's uptime for a feature
// whose whole point is producing a reliable file.
const FFMPEG_JS_URL = "/ffmpeg/ffmpeg.js";
const CORE_JS_URL = "/ffmpeg/ffmpeg-core.js";
const CORE_WASM_URL = "/ffmpeg/ffmpeg-core.wasm";

declare global {
  interface Window {
    // Set by ffmpeg.js (the UMD build) once it's loaded as a plain script.
    FFmpegWASM?: { FFmpeg: new () => FFmpeg };
  }
}

// Loaded via a plain <script> tag instead of `import("@ffmpeg/ffmpeg")` —
// the ESM package's classes.js constructs its worker as
// `new Worker(new URL(..., import.meta.url))`, a pattern Turbopack's
// module graph can't statically resolve from inside a pre-built
// node_modules file (throws "Cannot find module as expression is too
// dynamic" the moment ffmpeg.load() runs, confirmed in dev). A <script>
// tag is invisible to the bundler entirely, so this sidesteps that; the
// UMD build's own default worker path auto-detects its script's own
// directory to find its worker chunk (public/ffmpeg/814.ffmpeg.js) — no
// further wiring needed.
let scriptPromise: Promise<void> | null = null;
function loadFFmpegScript(): Promise<void> {
  if (typeof window !== "undefined" && window.FFmpegWASM) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = FFMPEG_JS_URL;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load ffmpeg.js"));
      document.head.appendChild(script);
    }).catch((err) => {
      scriptPromise = null;
      throw err;
    });
  }
  return scriptPromise;
}

// The loaded instance (and in-flight load) are cached at module scope —
// ffmpeg-core is a ~30MB WebAssembly download, so re-recording a clip (or
// exporting a second one later in the same session) must reuse it rather
// than reloading from scratch every time.
let ffmpegPromise: Promise<FFmpeg> | null = null;

async function getFFmpeg(onLoadProgress?: (fraction: number) => void): Promise<FFmpeg> {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      await loadFFmpegScript();
      const { toBlobURL } = await import("@ffmpeg/util");
      const ffmpeg = new window.FFmpegWASM!.FFmpeg();
      // Progress is tracked off the wasm download specifically (the core.js
      // is ~100KB; the wasm binary is the ~30MB download actually worth
      // showing a bar for).
      const [coreURL, wasmURL] = await Promise.all([
        toBlobURL(CORE_JS_URL, "text/javascript"),
        toBlobURL(CORE_WASM_URL, "application/wasm", true, (e) =>
          onLoadProgress?.(e.total > 0 ? e.received / e.total : 0)
        ),
      ]);
      await ffmpeg.load({ coreURL, wasmURL });
      return ffmpeg;
    })().catch((err) => {
      // A failed load shouldn't wedge every later attempt in this session —
      // clear the cache so the next call tries fresh instead of replaying
      // the same rejected promise forever.
      ffmpegPromise = null;
      throw err;
    });
  }
  return ffmpegPromise;
}

// Matches the fps canvas.captureStream() was asked to target in
// FractalVideoExportView (canvas.captureStream(30)) — re-encoding to the
// same nominal rate just locks it to being an actual constant rate instead
// of a variable one, rather than changing the clip's motion.
const OUTPUT_FPS = 30;

export interface PreparedVideo {
  blob: Blob;
  // False whenever ffmpeg.wasm failed to load or the encode itself failed
  // and `blob` is just the original, unfixed recording handed back
  // unchanged — surfaced back up to the UI rather than swallowed, after
  // this exact fallback path silently masked a real, total failure (a
  // Turbopack incompatibility that made every encode attempt fail) across
  // two earlier rounds of "fixes" that never actually ran.
  fixed: boolean;
}

// Re-encodes an MP4 Blob to fix the problems described above. `onProgress`
// (0-1) covers both the one-time ffmpeg-core download and the encode itself
// — the two are weighted roughly by how long each actually takes. Falls
// back to the original blob unchanged if ffmpeg.wasm fails to load or the
// encode itself fails (a slow/blocked network for the wasm download, an
// unsupported browser) — a clip that still has the upload-glitch bug beats
// a feature that hard-fails to produce anything — but says so via `fixed`
// rather than pretending it succeeded.
export async function prepareVideoForUpload(
  blob: Blob,
  onProgress?: (fraction: number) => void
): Promise<PreparedVideo> {
  try {
    // Loading (the ~30MB wasm download, when not already cached from an
    // earlier clip this session) gets the first 40% of the bar; the encode
    // itself gets the rest — loading is the slower step on a first run, the
    // encode is slower on every run after that once the download is cached.
    const ffmpeg = await getFFmpeg((loadFraction) => onProgress?.(loadFraction * 0.4));
    const { fetchFile } = await import("@ffmpeg/util");
    const inputName = "input.mp4";
    const outputName = "output.mp4";
    await ffmpeg.writeFile(inputName, await fetchFile(blob));

    const onEncodeProgress = ({ progress }: { progress: number }) =>
      onProgress?.(0.4 + Math.min(1, Math.max(0, progress)) * 0.6);
    ffmpeg.on("progress", onEncodeProgress);
    let code: number;
    try {
      code = await ffmpeg.exec([
        "-i",
        inputName,
        "-r",
        String(OUTPUT_FPS),
        "-c:v",
        "libx264",
        "-profile:v",
        "main",
        "-pix_fmt",
        "yuv420p",
        "-preset",
        "veryfast",
        "-b:v",
        "6M",
        "-maxrate",
        "6M",
        "-bufsize",
        "12M",
        "-c:a",
        "aac",
        "-ar",
        "48000",
        "-ac",
        "2",
        "-b:a",
        "128k",
        "-movflags",
        "+faststart",
        outputName,
      ]);
    } finally {
      ffmpeg.off("progress", onEncodeProgress);
    }
    if (code !== 0) throw new Error(`ffmpeg exited with code ${code}`);
    const data = await ffmpeg.readFile(outputName);
    await Promise.all([
      ffmpeg.deleteFile(inputName).catch(() => {}),
      ffmpeg.deleteFile(outputName).catch(() => {}),
    ]);
    const bytes = data instanceof Uint8Array ? data : new TextEncoder().encode(data);
    return { blob: new Blob([bytes.slice()], { type: "video/mp4" }), fixed: true };
  } catch (err) {
    console.warn("prepareVideoForUpload: falling back to the unfixed recording", err);
    return { blob, fixed: false };
  }
}
