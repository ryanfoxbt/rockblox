// Batch-runs every MP3 in mp3s/ (gitignored local test audio — see AGENTS.md
// note in that folder's absence from git) through the real import pipeline —
// Replicate/Demucs drum-stem separation, then the heuristic transcription in
// src/lib/transcribeDrums.ts — without touching the database or Inngest.
//
// For each song it writes, under mp3s-analysis/<song>/:
//   - drums-full.mp3        the entire isolated drum stem
//   - pattern-A/B/C.mp3     every repeat of that main groove's audio,
//                            concatenated back to back (see PatternDiagnostics
//                            in transcribeDrums.ts) — not the whole stretch of
//                            song between its first and last repeat, which
//                            would pull in unrelated sections in between
//   - pattern-D-fill.mp3    same, for the fill (a single repeat)
// plus a top-level mp3s-analysis/report.md summarizing bpm, bar/onset counts,
// which instruments each pattern used, and the exact time range analyzed —
// so results can be checked against the original songs by ear without
// re-running anything.
//
// This calls Replicate for every song (real API cost) — run with:
//   npm run analyze-songs
// or to only (re)do specific songs:
//   npm run analyze-songs -- "Popular" "RTO"
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { Mp3Encoder } from "@breezystack/lamejs";
import { separateDrumStem } from "../src/lib/stemSeparate";
import { parseWav, transcribeDrums, PatternDiagnostics, WavData } from "../src/lib/transcribeDrums";

// A copy of src/lib/mp3Encoder.ts's encode loop, kept inline rather than
// imported from there: tsx runs this scripts/ file as native ESM (see the
// .mts extension), but src/lib/*.ts has no such marker and gets transpiled
// to CJS under tsx, which breaks lamejs's named export (it ships ESM-only,
// with "main" pointing at an IIFE bundle that has no real CJS exports) —
// `new Mp3Encoder(...)` fails with "is not a constructor" through that path.
function floatTo16BitPCM(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return output;
}

const MP3_CHUNK_SIZE = 1152;

function encodePcmChannelsToMp3(channels: Float32Array[], sampleRate: number, kbps = 128): Uint8Array {
  const channelCount = Math.min(channels.length, 2);
  const encoder = new Mp3Encoder(channelCount, sampleRate, kbps);

  const left = floatTo16BitPCM(channels[0]);
  const right = channelCount > 1 ? floatTo16BitPCM(channels[1]) : undefined;

  const chunks: Uint8Array[] = [];
  for (let i = 0; i < left.length; i += MP3_CHUNK_SIZE) {
    const leftChunk = left.subarray(i, i + MP3_CHUNK_SIZE);
    const mp3buf = right
      ? encoder.encodeBuffer(leftChunk, right.subarray(i, i + MP3_CHUNK_SIZE))
      : encoder.encodeBuffer(leftChunk);
    if (mp3buf.length > 0) chunks.push(mp3buf);
  }

  const finalBuf = encoder.flush();
  if (finalBuf.length > 0) chunks.push(finalBuf);

  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const SONGS_DIR = join(REPO_ROOT, "mp3s");
const OUT_DIR = join(REPO_ROOT, "mp3s-analysis");
const CACHE_DIR = join(OUT_DIR, ".cache");

const PATTERN_SLOTS: { key: "patternA" | "patternB" | "patternC" | "patternD"; label: string; clipName: string }[] = [
  { key: "patternA", label: "Main beat 1", clipName: "pattern-A.mp3" },
  { key: "patternB", label: "Main beat 2", clipName: "pattern-B.mp3" },
  { key: "patternC", label: "Main beat 3", clipName: "pattern-C.mp3" },
  { key: "patternD", label: "Fill", clipName: "pattern-D-fill.mp3" },
];

function slugify(name: string): string {
  return name
    .replace(/\.mp3$/i, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

function deinterleave(samples: Float32Array, channels: number, fromFrame: number, toFrame: number): Float32Array[] {
  const frameCount = Math.max(0, toFrame - fromFrame);
  const channelCount = Math.min(channels, 2);
  const out = Array.from({ length: channelCount }, () => new Float32Array(frameCount));
  for (let i = 0; i < frameCount; i++) {
    const srcFrame = fromFrame + i;
    for (let c = 0; c < channelCount; c++) out[c][i] = samples[srcFrame * channels + c] ?? 0;
  }
  return out;
}

function sliceChannels(wav: WavData, startSeconds: number, endSeconds: number): Float32Array[] {
  const totalFrames = wav.samples.length / wav.channels;
  const fromFrame = Math.max(0, Math.floor(startSeconds * wav.sampleRate));
  const toFrame = Math.min(totalFrames, Math.ceil(endSeconds * wav.sampleRate));
  return deinterleave(wav.samples, wav.channels, fromFrame, toFrame);
}

function concatChannels(chunks: Float32Array[][]): Float32Array[] {
  const channelCount = chunks[0]?.length ?? 0;
  const totalFrames = chunks.reduce((sum, c) => sum + (c[0]?.length ?? 0), 0);
  const out = Array.from({ length: channelCount }, () => new Float32Array(totalFrames));
  let offset = 0;
  for (const chunk of chunks) {
    const frames = chunk[0]?.length ?? 0;
    for (let c = 0; c < channelCount; c++) out[c].set(chunk[c], offset);
    offset += frames;
  }
  return out;
}

function wavToMp3(wav: WavData): Uint8Array {
  return encodePcmChannelsToMp3(sliceChannels(wav, 0, Infinity), wav.sampleRate, 128);
}

// Concatenates just the given [start, end] ranges (skipping whatever's in
// between them) into one clip — see the file header for why: a pattern's
// repeats are often scattered across the song, and clipping the whole span
// between the first and last would pull in unrelated sections.
function rangesToMp3(wav: WavData, ranges: [number, number][]): Uint8Array {
  const chunks = ranges.map(([start, end]) => sliceChannels(wav, start, end));
  return encodePcmChannelsToMp3(concatChannels(chunks), wav.sampleRate, 128);
}

function formatRanges(ranges: [number, number][]): string {
  if (ranges.length <= 4) return ranges.map(([s, e]) => `${formatTime(s)}-${formatTime(e)}`).join(", ");
  return `${formatTime(ranges[0][0])} - ${formatTime(ranges[ranges.length - 1][1])} (${ranges.length} repeats)`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Replicate throttles hard (6 req/min) on accounts under $5 credit — plausible
// to hit mid-batch across 20+ sequential songs. Retries on 429s using the
// server's own retry_after hint (falling back to a fixed backoff if it's not
// present), rather than failing that song outright.
const RATE_LIMIT_MAX_ATTEMPTS = 5;
const RATE_LIMIT_FALLBACK_SECONDS = 10;

async function withRateLimitRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const isRateLimited = message.includes("429");
      if (!isRateLimited || attempt >= RATE_LIMIT_MAX_ATTEMPTS) throw err;
      const retryAfterMatch = message.match(/"retry_after":\s*(\d+(?:\.\d+)?)/);
      const waitSeconds = retryAfterMatch ? Number(retryAfterMatch[1]) : RATE_LIMIT_FALLBACK_SECONDS;
      console.log(`  rate-limited, retrying in ${waitSeconds}s (attempt ${attempt}/${RATE_LIMIT_MAX_ATTEMPTS})...`);
      await sleep(waitSeconds * 1000 + 500);
    }
  }
}

interface SongReport {
  filename: string;
  ok: boolean;
  error?: string;
  bpm?: number;
  measureLength?: number;
  durationSeconds?: number;
  onsetCount?: number;
  barCount?: number;
  patterns?: { label: string; instruments: string[]; ranges: [number, number][]; clip: string | null }[];
  fullClip?: string;
}

async function analyzeSong(filename: string): Promise<SongReport> {
  const slug = slugify(filename);
  const songOutDir = join(OUT_DIR, slug);
  mkdirSync(songOutDir, { recursive: true });

  // Demucs separation is the expensive, paid step — cache its raw output so
  // re-running this song later (e.g. after tuning transcribeDrums.ts's
  // thresholds) re-transcribes against the same audio for free instead of
  // paying for another Replicate call.
  const cachePath = join(CACHE_DIR, `${slug}.wav`);
  let drumsWav: Buffer;
  if (existsSync(cachePath)) {
    console.log(`  using cached drum stem...`);
    drumsWav = readFileSync(cachePath);
  } else {
    const audioBuffer = readFileSync(join(SONGS_DIR, filename));
    console.log(`  isolating drums (Replicate/Demucs)...`);
    drumsWav = await withRateLimitRetry(() => separateDrumStem(audioBuffer));
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(cachePath, drumsWav);
  }

  console.log(`  transcribing...`);
  const result = transcribeDrums(drumsWav);

  const wav = parseWav(drumsWav);

  console.log(`  encoding full-song drum track...`);
  const fullMp3 = wavToMp3(wav);
  writeFileSync(join(songOutDir, "drums-full.mp3"), fullMp3);

  const patterns: SongReport["patterns"] = [];
  for (const slot of PATTERN_SLOTS) {
    const pattern = result[slot.key];
    const diagnostics = result.diagnostics[slot.key] as PatternDiagnostics | null;
    if (!pattern || !diagnostics || diagnostics.sourceRanges.length === 0) {
      patterns.push({ label: slot.label, instruments: [], ranges: [], clip: null });
      continue;
    }
    console.log(`  clipping ${slot.label}...`);
    const clipMp3 = rangesToMp3(wav, diagnostics.sourceRanges);
    writeFileSync(join(songOutDir, slot.clipName), clipMp3);
    patterns.push({
      label: slot.label,
      instruments: diagnostics.instruments,
      ranges: diagnostics.sourceRanges,
      clip: `${slug}/${slot.clipName}`,
    });
  }

  const report: SongReport = {
    filename,
    ok: true,
    bpm: result.bpm,
    measureLength: result.measureLength,
    durationSeconds: result.diagnostics.durationSeconds,
    onsetCount: result.diagnostics.onsetCount,
    barCount: result.diagnostics.barCount,
    patterns,
    fullClip: `${slug}/drums-full.mp3`,
  };
  // Persisted per-song, not just held in memory — so a partial re-run
  // (`npm run analyze-songs -- "one song"`) can rebuild the full report by
  // merging every song's last-known result instead of only the ones just run.
  writeFileSync(join(songOutDir, "meta.json"), JSON.stringify(report, null, 2));
  return report;
}

// Rebuilds the full report from every song folder's persisted meta.json,
// overlaid with this run's fresh results — so songs not touched this run
// (e.g. a targeted re-run of one song) still show up instead of being
// dropped from the report.
function loadPersistedReports(): SongReport[] {
  if (!existsSync(OUT_DIR)) return [];
  const reports: SongReport[] = [];
  for (const entry of readdirSync(OUT_DIR)) {
    const metaPath = join(OUT_DIR, entry, "meta.json");
    if (!statSync(join(OUT_DIR, entry)).isDirectory() || !existsSync(metaPath)) continue;
    try {
      reports.push(JSON.parse(readFileSync(metaPath, "utf8")));
    } catch {
      // Skip a corrupt/partial meta.json rather than fail the whole report.
    }
  }
  return reports;
}

function writeReport(freshReports: SongReport[]) {
  const merged = new Map<string, SongReport>();
  for (const r of loadPersistedReports()) merged.set(r.filename, r);
  for (const r of freshReports) merged.set(r.filename, r);
  const reports = [...merged.values()].sort((a, b) => a.filename.localeCompare(b.filename));

  const lines: string[] = [];
  lines.push(`# Song import analysis`);
  lines.push("");
  lines.push(`Generated ${new Date().toISOString()} from ${reports.length} song(s) in mp3s/.`);
  lines.push("");

  for (const r of reports) {
    lines.push(`## ${r.filename}`);
    lines.push("");
    if (!r.ok) {
      lines.push(`**Failed:** ${r.error}`);
      lines.push("");
      continue;
    }
    lines.push(
      `- BPM: ${r.bpm} | time signature: ${r.measureLength}/4 | duration: ${formatTime(r.durationSeconds ?? 0)} | onsets: ${r.onsetCount} | bars: ${r.barCount}`
    );
    lines.push(`- Full extracted drum track: \`${r.fullClip}\``);
    lines.push("");
    lines.push(`| Pattern | Instruments | Time range analyzed | Clip |`);
    lines.push(`|---|---|---|---|`);
    for (const p of r.patterns ?? []) {
      const range = p.ranges.length > 0 ? formatRanges(p.ranges) : "not detected";
      const instruments = p.instruments.length > 0 ? p.instruments.join(", ") : "—";
      const clip = p.clip ? `\`${p.clip}\`` : "—";
      lines.push(`| ${p.label} | ${instruments} | ${range} | ${clip} |`);
    }
    lines.push("");
  }

  writeFileSync(join(OUT_DIR, "report.md"), lines.join("\n"));
}

async function main() {
  if (!process.env.REPLICATE_API_TOKEN) {
    throw new Error("REPLICATE_API_TOKEN is not set — run via `npm run analyze-songs` so .env.local is loaded.");
  }

  mkdirSync(OUT_DIR, { recursive: true });

  const requested = process.argv.slice(2);
  const allFiles = readdirSync(SONGS_DIR).filter((f) => f.toLowerCase().endsWith(".mp3"));
  const files =
    requested.length > 0
      ? allFiles.filter((f) => requested.some((r) => f.toLowerCase().includes(r.toLowerCase())))
      : allFiles;

  if (files.length === 0) {
    console.log("No matching songs found in mp3s/.");
    return;
  }

  console.log(`Analyzing ${files.length} song(s)...\n`);

  const reports: SongReport[] = [];
  for (let i = 0; i < files.length; i++) {
    const filename = files[i];
    console.log(`[${i + 1}/${files.length}] ${filename}`);
    try {
      reports.push(await analyzeSong(filename));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  FAILED: ${message}`);
      reports.push({ filename, ok: false, error: message });
    }
  }

  writeReport(reports);
  console.log(`\nDone. Report: ${join(OUT_DIR, "report.md")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
