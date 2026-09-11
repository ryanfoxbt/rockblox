// Fixes up an MP4 recorded by MediaRecorder before it's handed to the user.
//
// Chrome (and Safari) always write MediaRecorder's MP4 output as a
// fragmented MP4 whose leading moov atom carries no duration — the mvhd/
// tkhd/mdhd duration fields are all 0, regardless of whether the recording
// was flushed once at stop() or periodically via a timeslice. A lenient
// local player just scans the whole file and plays it back fine, duration
// bar and all, which is why a freshly recorded/downloaded clip always looks
// correct. A platform's own strict re-encode pipeline (TikTok's, notably)
// trusts that leading metadata instead of scanning ahead, and — starting
// from a duration of 0 — has been observed to truncate the audio to a
// couple of seconds or play it back sped up. See:
// https://blog.addpipe.com/duration-in-mp4-files-produced-by-chrome-safari/
//
// The fix is the standard one for browser-recorded MP4: remux it (stream
// copy, no re-encoding — this only rewrites the container, not the actual
// audio/video bitstream) into a normal, non-fragmented MP4 with the real
// duration computed from the actual samples and the moov atom moved to the
// front (`-movflags +faststart`). ffmpeg.wasm runs entirely client-side, so
// this happens right after recording, before the file is ever offered for
// download — the user only ever sees the fixed version.
import type { FFmpeg } from "@ffmpeg/ffmpeg";

// Self-hosted (see public/ffmpeg/) rather than pulled from a CDN at
// runtime, so this doesn't depend on a third party's uptime for a feature
// whose whole point is producing a reliable file.
const CORE_JS_URL = "/ffmpeg/ffmpeg-core.js";
const CORE_WASM_URL = "/ffmpeg/ffmpeg-core.wasm";

// The loaded instance (and in-flight load) are cached at module scope —
// ffmpeg-core is a ~30MB WebAssembly download, so re-recording a clip (or
// exporting a second one later in the same session) must reuse it rather
// than reloading from scratch every time.
let ffmpegPromise: Promise<FFmpeg> | null = null;

async function getFFmpeg(onLoadProgress?: (fraction: number) => void): Promise<FFmpeg> {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      const [{ FFmpeg }, { toBlobURL }] = await Promise.all([
        import("@ffmpeg/ffmpeg"),
        import("@ffmpeg/util"),
      ]);
      const ffmpeg = new FFmpeg();
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

// Remuxes an MP4 Blob to fix the fragmented-MP4 duration problem described
// above. Falls back to returning the original blob unchanged if ffmpeg.wasm
// fails to load or the remux itself fails (a slow/blocked network for the
// wasm download, an unsupported browser) — a clip that still has the
// upload-glitch bug beats a feature that hard-fails to produce anything.
export async function fixMp4Duration(
  blob: Blob,
  onLoadProgress?: (fraction: number) => void
): Promise<Blob> {
  try {
    const ffmpeg = await getFFmpeg(onLoadProgress);
    const { fetchFile } = await import("@ffmpeg/util");
    const inputName = "input.mp4";
    const outputName = "output.mp4";
    await ffmpeg.writeFile(inputName, await fetchFile(blob));
    const code = await ffmpeg.exec(["-i", inputName, "-c", "copy", "-movflags", "+faststart", outputName]);
    if (code !== 0) throw new Error(`ffmpeg exited with code ${code}`);
    const data = await ffmpeg.readFile(outputName);
    await Promise.all([
      ffmpeg.deleteFile(inputName).catch(() => {}),
      ffmpeg.deleteFile(outputName).catch(() => {}),
    ]);
    const bytes = data instanceof Uint8Array ? data : new TextEncoder().encode(data);
    return new Blob([bytes.slice()], { type: "video/mp4" });
  } catch (err) {
    console.warn("fixMp4Duration: falling back to the unfixed recording", err);
    return blob;
  }
}
