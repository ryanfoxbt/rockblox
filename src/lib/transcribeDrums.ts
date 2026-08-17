// Turns an isolated drums-stem WAV (from Replicate/Demucs, see stemSeparate.ts)
// into up to four RockBlocks patterns: three main grooves (the recurring
// beats a song is built from) and one fill (the off-the-groove bar that
// breaks up a section, usually on toms and/or a crash).
//
// There's no off-the-shelf hosted "audio -> drum notes" API, so this is a
// hand-rolled, best-effort pipeline: spectral-flux onset detection, tempo by
// autocorrelating the onset train, a frequency-band + decay-shape heuristic
// to classify each hit, then bar-grouping + clustering to separate "the
// groove(s)" from "the fill." It'll nail simple, punchy songs and struggle
// with busy fills, ghost notes, or heavily processed kits — expected to be
// reviewed and touched up in the Editor afterward, not treated as exact.
import FFT from "fft.js";
import { InstrumentId } from "./instruments";
import { RhythmHit, tileFromHits } from "./rhythm";
import { MAX_BEATS, StoredLine } from "./song";

export interface PatternDiagnostics {
  // One [start, end] per repeat this pattern was drawn from, earliest first —
  // not just the earliest-to-latest span, since a groove's repeats are often
  // scattered across the song with unrelated material in between; clipping
  // (or concatenating) exactly these ranges is what actually isolates the
  // audio a human should compare this pattern against by ear.
  sourceRanges: [number, number][];
  instruments: string[];
}

export interface TranscribeDiagnostics {
  durationSeconds: number;
  onsetCount: number;
  barCount: number;
  patternA: PatternDiagnostics | null;
  patternB: PatternDiagnostics | null;
  patternC: PatternDiagnostics | null;
  patternD: PatternDiagnostics | null;
}

export interface TranscribedSong {
  bpm: number;
  measureLength: number;
  patternA: StoredLine[] | null; // main beat 1
  patternB: StoredLine[] | null; // main beat 2
  patternC: StoredLine[] | null; // main beat 3
  patternD: StoredLine[] | null; // fill
  diagnostics: TranscribeDiagnostics;
}

const ONSET_FFT_SIZE = 2048;
const ONSET_HOP_SIZE = 512;
const ONSET_THRESHOLD_FACTOR = 1.6; // local mean + this * local std
const ONSET_LOCAL_WINDOW_SECONDS = 0.5;
const MIN_ONSET_GAP_SECONDS = 0.06;
const MIN_ONSET_COUNT = 8;

const CLASSIFY_FFT_SIZE = 1024;
const CLASSIFY_LOW_HZ = 150;
// Everything from here up counts as the cymbal-family "high" band — no gap
// between it and the mid band. An earlier version left a dead zone between
// 800-3000Hz that counted toward total energy but toward none of the three
// ratios; any hit whose energy actually lived there (common for filtered/
// synthesized drum-machine hi-hats, which don't have an acoustic kit's
// midrange shell resonance to fall back on) silently failed every band
// check and defaulted to snare. Measured directly against real songs: ~7%
// of all hits were doing exactly this, with a median 68-75% of their energy
// sitting in that dead zone.
const CLASSIFY_MID_HIGH_HZ = 800;
const KICK_LOW_RATIO = 0.45;
// A linear frequency axis gives the high band far more bins than the
// <150Hz or 150-800Hz bands purely by span, so broadband noise (a snare's
// wires as much as a hihat's shimmer) always reads as "mostly high energy."
// The mid-band check below is what actually separates them: a snare's shell
// resonance concentrates real energy around 150-800Hz that a hihat/cymbal —
// almost nothing below a few kHz — doesn't have, so it's checked first.
const SNARE_MID_RATIO = 0.12;
const HIHAT_HIGH_RATIO = 0.4;

// A resonant drum (tom) rings noticeably longer than the punchy transient of
// a kick or the crack+choke of a snare — that's the signal that pulls toms
// out of the kick/snare bands they'd otherwise land in purely by frequency.
// How much longer varies hugely by song (a roomy, resonant kick can ring
// nearly as long as some songs' toms), so rather than a fixed cutoff, only
// the most exceptionally sustained hits *within this song* — top ~12% of
// its own low/mid-band decay distribution — count as toms. TOM_DECAY_MIN_RATIO
// is a floor under that so a song with uniformly punchy, non-resonant hits
// doesn't get toms forced onto its top 12% anyway.
const TOM_DECAY_PERCENTILE = 88;
const TOM_DECAY_MIN_RATIO = 0.35;
const TOM_PITCH_MIN_HZ = 80;
const TOM_PITCH_MAX_HZ = 500;
const TOM_LOW_MAX_HZ = 200;
const TOM_MID_MAX_HZ = 350;

// Cymbal sub-classification, all within the "highRatio dominant" branch:
// closed hi-hats choke almost immediately; open hi-hats and rides both ring,
// but a ride's "ping" concentrates energy in a narrow band far more than a
// hi-hat's broadband wash (that's what highPeakiness measures); a crash
// rings the longest and is usually the loudest cymbal hit in the song.
const CYMBAL_CHOKE_DECAY_RATIO = 0.15;
const CRASH_DECAY_RATIO = 0.5;
const CRASH_LOUDNESS_FACTOR = 1.6;
const RIDE_PEAKINESS = 18;

const MIN_BPM = 60;
const MAX_BPM = 200;

// A real drummer keeps one steady cymbal voice through a groove (hi-hat or
// ride, never alternating hit to hit) plus kick and snare — toms/crash are
// reserved for fills. These are the only instruments a main beat (A/B/C) is
// allowed to use; per-hit misclassification noise involving anything else
// gets dropped rather than polluting the pattern.
const CYMBAL_VOICES: InstrumentId[] = ["hihatClosed", "hihatOpen", "ride"];
const BEAT_INSTRUMENTS: InstrumentId[] = ["kick", "snare", ...CYMBAL_VOICES];
const BEAT_INSTRUMENT_ORDER: InstrumentId[] = ["kick", "snare", "hihatClosed", "hihatOpen", "ride"];
// The fill gets the whole kit.
const FILL_INSTRUMENT_ORDER: InstrumentId[] = [
  "kick",
  "snare",
  "hihatClosed",
  "hihatOpen",
  "ride",
  "crash",
  "lowTom",
  "midTom",
  "highTom",
];

// Off-kit hits (toms/crash) are the strongest signal a bar is a fill rather
// than a repeating groove — a real beat almost never touches them. Note
// density is a much weaker secondary signal, used as a tiebreaker/fallback
// for songs whose fills don't happen to use toms or a crash.
const OFF_KIT_FILL_INSTRUMENTS = new Set<InstrumentId>(["crash", "lowTom", "midTom", "highTom"]);

const MAX_MAIN_BEATS = 3;
// How similar (Jaccard, on core-kit hits only) another bar has to be to a
// cluster's medoid to count as "the same groove" for that cluster's cymbal
// vote — not so high that near-identical repeats with one dropped ghost note
// get excluded, not so low that two genuinely different grooves merge.
const CLUSTER_MEMBER_SIMILARITY = 0.55;

export function transcribeDrums(wavBuffer: Buffer): TranscribedSong {
  const wav = parseWav(wavBuffer);
  const mono = toMono(wav);

  const roughOnsetTimes = detectOnsets(mono);
  if (roughOnsetTimes.length < MIN_ONSET_COUNT) {
    throw new Error("Couldn't find enough distinct drum hits in this track to transcribe a pattern.");
  }
  // Spectral-flux timing is coarse — a fast, hard transient's flux peak can
  // land a hop or two before the sample-domain hit actually starts. Snapping
  // each estimate to where the amplitude envelope truly rises fixes both the
  // beat grid (quantizing against the wrong instant) and classification
  // (a fixed-size analysis window anchored a hop early mostly captures
  // silence, not the transient it's supposed to characterize).
  const onsetTimes = roughOnsetTimes.map((t) => refineOnsetTime(mono, t));

  const totalDurationSeconds = mono.samples.length / mono.sampleRate;
  const bpm = estimateTempo(onsetTimes, totalDurationSeconds);
  const beatSeconds = 60 / bpm;
  const gridOrigin = estimateGridPhase(onsetTimes, beatSeconds);

  // Two-pass classification: extract each hit's raw acoustic features first,
  // so per-song-relative decisions — telling a crash from an ordinary
  // ride/hi-hat by loudness, or a tom from a resonant kick/snare by how
  // sustained it is relative to this song's *own* hits — can be made against
  // this song's actual distribution rather than an arbitrary fixed number
  // (production styles vary too much for a fixed decay cutoff to generalize:
  // a punchy, compressed kick and a roomy, resonant one can differ several-
  // fold in raw decay ratio for the same instrument).
  const features = onsetTimes.map((time, i) => {
    const gap = i + 1 < onsetTimes.length ? onsetTimes[i + 1] - time : Infinity;
    return extractOnsetFeatures(mono, time, gap);
  });
  const medianPeak = median(features.map((f) => f.peakRms));
  const tomDecay: TomDecayThresholds = {
    low: tomDecayThreshold(features.filter((f) => broadBand(f) === "low").map((f) => f.decayRatio)),
    mid: tomDecayThreshold(features.filter((f) => broadBand(f) === "mid").map((f) => f.decayRatio)),
  };
  const classified = onsetTimes.map((time, i) => ({
    time,
    instrument: classifyOnset(features[i], medianPeak, tomDecay),
  }));

  const beatsPerBar = estimateBeatsPerBar(classified, gridOrigin, beatSeconds);
  const bars = groupIntoBars(classified, gridOrigin, beatSeconds, beatsPerBar);
  // Skip the very first/last bar when there's enough material, same as the
  // single-pattern pipeline did — they're disproportionately likely to be a
  // sparse intro/outro rather than real song material.
  const interiorIndices = bars.length > 4 ? bars.map((_, i) => i).slice(1, -1) : bars.map((_, i) => i);

  const fillIndex = pickFillBar(bars, interiorIndices);
  const patternD =
    fillIndex !== null ? barToStoredLines(bars[fillIndex], FILL_INSTRUMENT_ORDER, beatsPerBar) : null;

  const beatPoolIndices = interiorIndices.filter((i) => i !== fillIndex);
  const clusters = clusterBeatBars(bars, beatPoolIndices);
  const fallback: CoreFallbacks = {
    kick: findFallbackHits(bars, beatPoolIndices, "kick"),
    snare: findFallbackHits(bars, beatPoolIndices, "snare"),
    cymbal: findFallbackCymbalHits(bars, beatPoolIndices),
  };

  if (process.env.DEBUG_TRANSCRIBE) {
    debugDump({
      mono,
      onsetTimes,
      features,
      bpm,
      gridOrigin,
      beatsPerBar,
      bars,
      interiorIndices,
      fillIndex,
      clusters,
      tomDecay,
    });
  }
  // Order by first appearance in the song — A is whichever distinct groove
  // shows up earliest (typically a verse), later ones typically chorus/bridge.
  clusters.sort((a, b) => a.medoidIndex - b.medoidIndex);

  const [patternA, patternB, patternC] = [0, 1, 2].map((i) =>
    clusters[i] ? renderBeatPattern(bars, clusters[i], fallback, beatsPerBar) : null
  );

  const diagnostics: TranscribeDiagnostics = {
    durationSeconds: round1(totalDurationSeconds),
    onsetCount: onsetTimes.length,
    barCount: bars.length,
    patternA: patternDiagnostics(patternA, clusters[0]?.memberIndices ?? null, gridOrigin, beatSeconds, beatsPerBar),
    patternB: patternDiagnostics(patternB, clusters[1]?.memberIndices ?? null, gridOrigin, beatSeconds, beatsPerBar),
    patternC: patternDiagnostics(patternC, clusters[2]?.memberIndices ?? null, gridOrigin, beatSeconds, beatsPerBar),
    patternD: patternDiagnostics(
      patternD,
      fillIndex !== null ? [fillIndex] : null,
      gridOrigin,
      beatSeconds,
      beatsPerBar
    ),
  };

  return {
    bpm: Math.round(bpm),
    measureLength: beatsPerBar,
    patternA,
    patternB,
    patternC,
    patternD,
    diagnostics,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// Every repeat's [start, end] a detected pattern came from, so a human can
// jump to (or clip/concatenate) exactly that audio and compare it by ear,
// since nothing in this pipeline can actually listen.
function patternDiagnostics(
  pattern: StoredLine[] | null,
  barIndices: number[] | null,
  gridOrigin: number,
  beatSeconds: number,
  beatsPerBar: number
): PatternDiagnostics | null {
  if (pattern === null || barIndices === null || barIndices.length === 0) return null;
  const barSeconds = beatsPerBar * beatSeconds;
  const sourceRanges: [number, number][] = [...barIndices]
    .sort((a, b) => a - b)
    .map((i) => {
      const start = gridOrigin + i * barSeconds;
      return [round1(start), round1(start + barSeconds)];
    });
  return {
    sourceRanges,
    instruments: pattern.map((l) => l.instrument),
  };
}

// --- WAV parsing -------------------------------------------------------

// Exported for the song-analysis script (scripts/analyzeSongs.ts), which
// needs the same interleaved samples this pipeline transcribes from in order
// to clip/export the exact audio a pattern was drawn from.
export interface WavData {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  samples: Float32Array; // interleaved, normalized to [-1, 1]
}

export function parseWav(buffer: Buffer): WavData {
  if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("Expected a WAV file from the stem-separation step");
  }

  let offset = 12;
  let sampleRate = 0;
  let channels = 0;
  let bitsPerSample = 0;
  let dataStart = -1;
  let dataLength = 0;

  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkDataStart = offset + 8;
    if (chunkId === "fmt ") {
      channels = buffer.readUInt16LE(chunkDataStart + 2);
      sampleRate = buffer.readUInt32LE(chunkDataStart + 4);
      bitsPerSample = buffer.readUInt16LE(chunkDataStart + 14);
    } else if (chunkId === "data") {
      dataStart = chunkDataStart;
      dataLength = Math.min(chunkSize, buffer.length - chunkDataStart);
    }
    // Chunks are word-aligned: an odd-sized chunk has one byte of padding after it.
    offset = chunkDataStart + chunkSize + (chunkSize % 2);
  }

  if (dataStart < 0 || !sampleRate) throw new Error("WAV file is missing its fmt/data chunks");

  const bytesPerSample = bitsPerSample / 8;
  const totalSamples = Math.floor(dataLength / bytesPerSample);
  const samples = new Float32Array(totalSamples);
  for (let i = 0; i < totalSamples; i++) {
    const byteOffset = dataStart + i * bytesPerSample;
    if (bitsPerSample === 16) {
      samples[i] = buffer.readInt16LE(byteOffset) / 32768;
    } else if (bitsPerSample === 24) {
      let v = buffer[byteOffset] | (buffer[byteOffset + 1] << 8) | (buffer[byteOffset + 2] << 16);
      if (v & 0x800000) v -= 0x1000000;
      samples[i] = v / 8388608;
    } else if (bitsPerSample === 32) {
      samples[i] = buffer.readInt32LE(byteOffset) / 2147483648;
    } else {
      throw new Error(`Unsupported WAV bit depth: ${bitsPerSample}`);
    }
  }
  return { sampleRate, channels, bitsPerSample, samples };
}

function toMono(wav: WavData): { sampleRate: number; samples: Float32Array } {
  if (wav.channels <= 1) return { sampleRate: wav.sampleRate, samples: wav.samples };
  const frames = Math.floor(wav.samples.length / wav.channels);
  const mono = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let sum = 0;
    for (let c = 0; c < wav.channels; c++) sum += wav.samples[i * wav.channels + c];
    mono[i] = sum / wav.channels;
  }
  return { sampleRate: wav.sampleRate, samples: mono };
}

// --- Onset detection: spectral flux + adaptive peak picking ------------

function hannWindow(size: number): Float32Array {
  const w = new Float32Array(size);
  for (let i = 0; i < size; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1));
  return w;
}

// A symmetric Hann window is wrong for classifying a single transient: it's
// near-zero at the start of the frame and only reaches full weight at the
// center, so it suppresses exactly the attack the classifier needs to look
// at (by the time a Hann window's weight ramps up, a drum hit's decay
// envelope has already faded well past its most identifying moment). This
// keeps full weight through the attack and only tapers the tail, to avoid
// an abrupt edge discontinuity in the FFT without hiding the transient.
function attackWindow(size: number): Float32Array {
  const w = new Float32Array(size);
  const fadeStart = Math.floor(size * 0.8);
  for (let i = 0; i < size; i++) {
    w[i] = i < fadeStart ? 1 : 0.5 + 0.5 * Math.cos((Math.PI * (i - fadeStart)) / (size - fadeStart));
  }
  return w;
}

function detectOnsets(mono: { sampleRate: number; samples: Float32Array }): number[] {
  const { sampleRate, samples } = mono;
  const fft = new FFT(ONSET_FFT_SIZE);
  const window = hannWindow(ONSET_FFT_SIZE);
  const bins = ONSET_FFT_SIZE / 2;
  const numFrames = Math.max(0, Math.floor((samples.length - ONSET_FFT_SIZE) / ONSET_HOP_SIZE) + 1);

  const flux = new Float32Array(numFrames);
  let prevMag: Float32Array | null = null;
  const complexOut = fft.createComplexArray();
  const windowed = new Array<number>(ONSET_FFT_SIZE).fill(0);

  for (let frame = 0; frame < numFrames; frame++) {
    const start = frame * ONSET_HOP_SIZE;
    for (let i = 0; i < ONSET_FFT_SIZE; i++) windowed[i] = samples[start + i] * window[i];
    fft.realTransform(complexOut, windowed);
    fft.completeSpectrum(complexOut);

    const mag = new Float32Array(bins);
    for (let b = 0; b < bins; b++) {
      const re = complexOut[2 * b];
      const im = complexOut[2 * b + 1];
      mag[b] = Math.sqrt(re * re + im * im);
    }
    if (prevMag) {
      let sum = 0;
      for (let b = 0; b < bins; b++) {
        const diff = mag[b] - prevMag[b];
        if (diff > 0) sum += diff;
      }
      flux[frame] = sum;
    }
    prevMag = mag;
  }

  const windowFrames = Math.max(1, Math.round((ONSET_LOCAL_WINDOW_SECONDS * sampleRate) / ONSET_HOP_SIZE));
  const minGapFrames = Math.max(1, Math.round((MIN_ONSET_GAP_SECONDS * sampleRate) / ONSET_HOP_SIZE));
  const times: number[] = [];
  let lastOnsetFrame = -Infinity;

  for (let i = 0; i < numFrames; i++) {
    const lo = Math.max(0, i - windowFrames);
    const hi = Math.min(numFrames - 1, i + windowFrames);
    let mean = 0;
    for (let j = lo; j <= hi; j++) mean += flux[j];
    const count = hi - lo + 1;
    mean /= count;
    let variance = 0;
    for (let j = lo; j <= hi; j++) variance += (flux[j] - mean) ** 2;
    const std = Math.sqrt(variance / count);
    const threshold = mean + ONSET_THRESHOLD_FACTOR * std;

    const isLocalPeak = flux[i] > threshold && flux[i] >= (flux[i - 1] ?? 0) && flux[i] >= (flux[i + 1] ?? 0);
    if (isLocalPeak && i - lastOnsetFrame >= minGapFrames) {
      times.push((i * ONSET_HOP_SIZE) / sampleRate);
      lastOnsetFrame = i;
    }
  }
  return times;
}

const REFINE_SEARCH_SECONDS = 0.04; // how far around the rough estimate to look
const REFINE_STEP_SAMPLES = 32;

// Snaps a coarse spectral-flux onset time to the point of steepest amplitude
// rise within a small window around it — see the comment at the call site
// in transcribeDrums() for why this matters.
function refineOnsetTime(mono: { sampleRate: number; samples: Float32Array }, roughTime: number): number {
  const { sampleRate, samples } = mono;
  const roughSample = Math.round(roughTime * sampleRate);
  const radius = Math.round(REFINE_SEARCH_SECONDS * sampleRate);
  const from = Math.max(0, roughSample - radius);
  const to = Math.min(samples.length, roughSample + radius);

  let bestIndex = roughSample;
  let bestRise = -Infinity;
  let prevRms = 0;
  for (let i = from; i < to; i += REFINE_STEP_SAMPLES) {
    let sumSquares = 0;
    let count = 0;
    for (let j = 0; j < REFINE_STEP_SAMPLES && i + j < samples.length; j++, count++) {
      const s = samples[i + j];
      sumSquares += s * s;
    }
    const rms = count > 0 ? Math.sqrt(sumSquares / count) : 0;
    const rise = rms - prevRms;
    if (rise > bestRise) {
      bestRise = rise;
      bestIndex = i;
    }
    prevRms = rms;
  }
  return bestIndex / sampleRate;
}

// --- Tempo + grid phase -------------------------------------------------

// Autocorrelates a coarse onset-impulse train against every candidate beat
// period in [MIN_BPM, MAX_BPM] and keeps the strongest — standard technique
// for pulling a steady tempo out of a set of onset times.
function estimateTempo(onsetTimes: number[], totalDurationSeconds: number): number {
  const binSeconds = 0.01;
  const numBins = Math.max(1, Math.ceil(totalDurationSeconds / binSeconds));
  const train = new Float32Array(numBins);
  for (const t of onsetTimes) {
    const bin = Math.round(t / binSeconds);
    if (bin >= 0 && bin < numBins) train[bin] = 1;
  }

  let bestBpm = 120;
  let bestScore = -Infinity;
  for (let bpm = MIN_BPM; bpm <= MAX_BPM; bpm++) {
    const periodBins = Math.round(60 / bpm / binSeconds);
    if (periodBins < 1) continue;
    let score = 0;
    for (let i = 0; i + periodBins < numBins; i++) score += train[i] * train[i + periodBins];
    if (score > bestScore) {
      bestScore = score;
      bestBpm = bpm;
    }
  }
  return bestBpm;
}

// Finds which phase offset (within one beat) the onsets cluster around, so
// the sixteenth-note grid used for quantization actually lines up with where
// the hits are — without this, quantized hits could land a fixed offset away
// from every real onset.
function estimateGridPhase(onsetTimes: number[], beatSeconds: number): number {
  const resolution = beatSeconds / 16;
  let bestPhase = 0;
  let bestScore = -Infinity;
  for (let phase = 0; phase < beatSeconds; phase += resolution) {
    let score = 0;
    for (const t of onsetTimes) {
      const intoGrid = (((t - phase) % beatSeconds) + beatSeconds) % beatSeconds;
      const distance = Math.min(intoGrid, beatSeconds - intoGrid);
      score += 1 / (1 + distance / resolution);
    }
    if (score > bestScore) {
      bestScore = score;
      bestPhase = phase;
    }
  }
  return bestPhase;
}

// --- Per-hit feature extraction + classification -------------------------

interface OnsetFeatures {
  lowRatio: number;
  midRatio: number;
  highRatio: number;
  highPeakiness: number; // how concentrated the high-band energy is in one narrow peak vs spread broadband
  lowMidCentroidHz: number; // weighted-average frequency in the tom pitch range, for low/mid/high tom bucketing
  decayRatio: number; // late/early raw-RMS envelope ratio — how long the hit rings out
  peakRms: number; // raw loudness, for comparing a hit against the song's typical hit loudness
}

function rmsEnergy(samples: Float32Array, from: number, to: number): number {
  let sum = 0;
  let count = 0;
  for (let i = Math.max(0, from); i < to && i < samples.length; i++, count++) sum += samples[i] * samples[i];
  return count > 0 ? Math.sqrt(sum / count) : 0;
}

// How far past the onset to measure "is this still ringing." Capped well
// below the gap to the *next* detected onset — in real (non-synthetic) music
// hits are often close enough together that a fixed window bleeds into the
// following hit's transient, which reads as false sustain and was the single
// biggest source of misclassification (kicks/snares getting called toms,
// hi-hats getting called rides) once tested against real songs.
const DECAY_LATE_END_SECONDS = 0.22;
const DECAY_WINDOW_GAP_FRACTION = 0.85; // stay within this fraction of the gap to the next onset

function decayRatio(samples: Float32Array, sampleRate: number, onsetSample: number, nextOnsetGapSeconds: number): number {
  const lateEndSeconds = Math.min(DECAY_LATE_END_SECONDS, nextOnsetGapSeconds * DECAY_WINDOW_GAP_FRACTION);
  const lateStartSeconds = lateEndSeconds * 0.6;
  const early = rmsEnergy(
    samples,
    onsetSample + Math.round(0.005 * sampleRate),
    onsetSample + Math.round(0.025 * sampleRate)
  );
  const late = rmsEnergy(
    samples,
    onsetSample + Math.round(lateStartSeconds * sampleRate),
    onsetSample + Math.round(lateEndSeconds * sampleRate)
  );
  return early > 0 ? late / early : 0;
}

function extractOnsetFeatures(
  mono: { sampleRate: number; samples: Float32Array },
  timeSeconds: number,
  nextOnsetGapSeconds: number
): OnsetFeatures {
  const { sampleRate, samples } = mono;
  const startSample = Math.max(0, Math.round(timeSeconds * sampleRate));
  const window = attackWindow(CLASSIFY_FFT_SIZE);
  const frame = new Array<number>(CLASSIFY_FFT_SIZE);
  for (let i = 0; i < CLASSIFY_FFT_SIZE; i++) frame[i] = (samples[startSample + i] ?? 0) * window[i];

  const fft = new FFT(CLASSIFY_FFT_SIZE);
  const out = fft.createComplexArray();
  fft.realTransform(out, frame);
  fft.completeSpectrum(out);

  const bins = CLASSIFY_FFT_SIZE / 2;
  const binHz = sampleRate / CLASSIFY_FFT_SIZE;
  let lowEnergy = 0;
  let midEnergy = 0;
  let highEnergy = 0;
  let totalEnergy = 0;
  let highPeakEnergy = 0;
  let highBinCount = 0;
  let lowMidEnergySum = 0;
  let lowMidWeightedFreqSum = 0;

  for (let b = 1; b < bins; b++) {
    const re = out[2 * b];
    const im = out[2 * b + 1];
    const energy = re * re + im * im;
    const hz = b * binHz;
    totalEnergy += energy;
    if (hz < CLASSIFY_LOW_HZ) lowEnergy += energy;
    else if (hz < CLASSIFY_MID_HIGH_HZ) midEnergy += energy;
    else {
      highEnergy += energy;
      highBinCount++;
      if (energy > highPeakEnergy) highPeakEnergy = energy;
    }
    if (hz >= TOM_PITCH_MIN_HZ && hz <= TOM_PITCH_MAX_HZ) {
      lowMidEnergySum += energy;
      lowMidWeightedFreqSum += energy * hz;
    }
  }

  const highAvgEnergy = highBinCount > 0 ? highEnergy / highBinCount : 0;

  return {
    lowRatio: totalEnergy > 0 ? lowEnergy / totalEnergy : 0,
    midRatio: totalEnergy > 0 ? midEnergy / totalEnergy : 0,
    highRatio: totalEnergy > 0 ? highEnergy / totalEnergy : 0,
    highPeakiness: highAvgEnergy > 0 ? highPeakEnergy / highAvgEnergy : 0,
    lowMidCentroidHz: lowMidEnergySum > 0 ? lowMidWeightedFreqSum / lowMidEnergySum : 0,
    decayRatio: decayRatio(samples, sampleRate, startSample, nextOnsetGapSeconds),
    peakRms: rmsEnergy(samples, startSample, startSample + Math.round(0.02 * sampleRate)),
  };
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[index];
}

function median(values: number[]): number {
  return percentile(values, 50);
}

// A song-relative floor for "this is exceptionally sustained" (see
// TOM_DECAY_PERCENTILE) — with too few hits in a band, a raw percentile is
// noise, so fall back to the fixed floor instead of trusting it.
const MIN_SAMPLES_FOR_PERCENTILE = 5;

function tomDecayThreshold(decayRatios: number[]): number {
  if (decayRatios.length < MIN_SAMPLES_FOR_PERCENTILE) return TOM_DECAY_MIN_RATIO;
  return Math.max(TOM_DECAY_MIN_RATIO, percentile(decayRatios, TOM_DECAY_PERCENTILE));
}

function tomForPitch(centroidHz: number): InstrumentId {
  if (centroidHz <= 0) return "midTom";
  if (centroidHz < TOM_LOW_MAX_HZ) return "lowTom";
  if (centroidHz < TOM_MID_MAX_HZ) return "midTom";
  return "highTom";
}

function classifyCymbal(f: OnsetFeatures, medianPeak: number): InstrumentId {
  const isUnusuallyLoud = medianPeak > 0 && f.peakRms > medianPeak * CRASH_LOUDNESS_FACTOR;
  if (f.decayRatio > CRASH_DECAY_RATIO && isUnusuallyLoud) return "crash";
  if (f.decayRatio < CYMBAL_CHOKE_DECAY_RATIO) return "hihatClosed";
  return f.highPeakiness > RIDE_PEAKINESS ? "ride" : "hihatOpen";
}

// Which broad frequency band would decide this hit's base instrument,
// independent of decay shape — used both to classify and to bucket hits for
// computing this song's own tom-decay percentiles (see TOM_DECAY_PERCENTILE).
function broadBand(f: OnsetFeatures): "low" | "mid" | "high" | "none" {
  if (f.lowRatio === 0 && f.midRatio === 0 && f.highRatio === 0) return "none";
  if (f.lowRatio > KICK_LOW_RATIO) return "low";
  if (f.midRatio > SNARE_MID_RATIO) return "mid";
  if (f.highRatio > HIHAT_HIGH_RATIO) return "high";
  return "none";
}

interface TomDecayThresholds {
  low: number;
  mid: number;
}

function classifyOnset(f: OnsetFeatures, medianPeak: number, tomDecay: TomDecayThresholds): InstrumentId {
  const band = broadBand(f);
  if (band === "low") {
    return f.decayRatio > tomDecay.low ? tomForPitch(f.lowMidCentroidHz) : "kick";
  }
  if (band === "mid") {
    // A tom's body resonance rings longer than a snare's crack-plus-choke.
    return f.decayRatio > tomDecay.mid ? tomForPitch(f.lowMidCentroidHz) : "snare";
  }
  if (band === "high") return classifyCymbal(f, medianPeak);
  return "snare";
}

// --- Bar grouping, fill detection, and beat clustering -------------------

interface BarHit {
  slot: number; // sixteenth-note slot within the bar, 0..15
  instrument: InstrumentId;
}

function groupIntoBars(
  onsets: { time: number; instrument: InstrumentId }[],
  gridOrigin: number,
  beatSeconds: number,
  beatsPerBar: number
): BarHit[][] {
  const sixteenthSeconds = beatSeconds / 4;
  const slotsPerBar = beatsPerBar * 4;
  const bars: BarHit[][] = [];
  for (const onset of onsets) {
    const slotIndex = Math.round((onset.time - gridOrigin) / sixteenthSeconds);
    if (slotIndex < 0) continue; // before the grid origin — pre-roll noise, not part of the groove
    const barIndex = Math.floor(slotIndex / slotsPerBar);
    const slotInBar = slotIndex - barIndex * slotsPerBar;
    while (bars.length <= barIndex) bars.push([]);
    bars[barIndex].push({ slot: slotInBar, instrument: onset.instrument });
  }
  return bars;
}

const MIN_BEATS_PER_BAR = 2;
// MAX_BEATS is the app's own hard cap on beats per pattern (see song.ts) —
// no point detecting a repeat cycle longer than a pattern could ever hold.
const MAX_BEATS_PER_BAR = MAX_BEATS;
// A candidate N only overrides the 4/4 default if its score comes within
// this fraction of 4's own score. Calibrated against a real 21-song batch:
// even ordinary 4/4 songs routinely show a next-best candidate at 75-81% of
// 4's score (generic kick+snare backbones partially resemble themselves at
// almost any grouping), while the one confirmed 7/4 song in that batch hit
// 96%. Comparing directly against 4 (not the global max across all
// candidates) matters — a broad, noisy field of similarly-mediocre scores
// otherwise lets whichever one happens to be checked first win by default,
// which is what produced false positives on ordinary songs during tuning.
const TIME_SIGNATURE_OVERRIDE_THRESHOLD = 0.88;

// How many beats make up one repeating bar — detected from the audio rather
// than assumed to be 4. A hardcoded 4-beat bar silently breaks any song that
// isn't 4/4 (a 7/4 song, say): bar boundaries end up out of phase with
// wherever the music's real cycle repeats, so nothing ever clusters into a
// clean recurring groove. This works one level below "bars": it folds the
// song into a sequence of per-beat fingerprints (which instrument hit which
// of that beat's 4 sixteenth-note slots — reusing groupIntoBars with
// beatsPerBar=1, then flattenForSimilarity), then scores each candidate bar
// length N by how much fingerprint[i] and fingerprint[i+N] agree, averaged
// across the whole song. Restricted to core beat instruments (via
// flattenForSimilarity) rather than the whole kit, since fills/tom runs
// exist specifically to break the steady pattern and would only add noise.
//
// A groove that alternates between two different bars every other repeat
// (very common — that's exactly what Main beat 1 vs 2 are for) won't score
// well at its own true length N, only at 2N (comparing a bar to its next
// *matching* repeat, one full alternation later) — so each candidate N is
// credited with the better of its own score and its doubled length's score
// before comparing, and candidates are checked largest-first so a genuine
// bigger meter wins over an incidental smaller sub-pattern once it clears
// the bar, rather than always chasing whichever raw score is highest.
function estimateBeatsPerBar(
  onsets: { time: number; instrument: InstrumentId }[],
  gridOrigin: number,
  beatSeconds: number
): number {
  const beatFingerprints = groupIntoBars(onsets, gridOrigin, beatSeconds, 1).map(flattenForSimilarity);
  if (beatFingerprints.length < MIN_BEATS_PER_BAR * 2) return 4;

  const maxPeriod = Math.min(MAX_BEATS_PER_BAR * 2, Math.floor(beatFingerprints.length / 2));
  const scores = new Map<number, number>();
  for (let period = MIN_BEATS_PER_BAR; period <= maxPeriod; period++) {
    let total = 0;
    let count = 0;
    for (let i = 0; i + period < beatFingerprints.length; i++) {
      const a = beatFingerprints[i];
      const b = beatFingerprints[i + period];
      if (a.size === 0 && b.size === 0) continue; // silence agreeing with silence says nothing about periodicity
      total += jaccardSimilarity(a, b);
      count++;
    }
    if (count > 0) scores.set(period, total / count);
  }

  const effectiveScores = new Map<number, number>();
  for (let n = MIN_BEATS_PER_BAR; n <= MAX_BEATS_PER_BAR; n++) {
    effectiveScores.set(n, Math.max(scores.get(n) ?? 0, scores.get(n * 2) ?? 0));
  }

  // 4 is the default and the baseline every other candidate is measured
  // against. 2 is excluded from ever overriding it: it's the shortest,
  // most generic possible grouping (does beat 0 look like beat 2), and even
  // clearly-4/4 songs in testing showed 2 scoring as high as or higher than
  // their own true length — it's noise, not signal, for this purpose.
  const fourScore = effectiveScores.get(4) ?? 0;
  let best = 4;
  for (let n = MAX_BEATS_PER_BAR; n >= 3; n--) {
    if (n === 4) continue;
    const score = effectiveScores.get(n) ?? 0;
    if (score > 0 && score >= fourScore * TIME_SIGNATURE_OVERRIDE_THRESHOLD) {
      best = n;
      break;
    }
  }

  if (process.env.DEBUG_TRANSCRIBE) {
    console.error(
      "beatsPerBar scores:",
      [...scores.entries()].map(([p, s]) => `${p}=${s.toFixed(3)}`).join(" "),
      "| effective:",
      [...effectiveScores.entries()].map(([p, s]) => `${p}=${s.toFixed(3)}`).join(" "),
      "-> chose",
      best
    );
  }
  return best;
}

function fillScore(bar: BarHit[]): number {
  const offKitCount = bar.filter((h) => OFF_KIT_FILL_INSTRUMENTS.has(h.instrument)).length;
  return offKitCount * 3 + bar.length;
}

function pickFillBar(bars: BarHit[][], candidateIndices: number[]): number | null {
  let best: number | null = null;
  let bestScore = -Infinity;
  for (const i of candidateIndices) {
    if (bars[i].length === 0) continue;
    const score = fillScore(bars[i]);
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

// Restricted to core-kit hits, with the three cymbal voices generalized into
// one bucket — clustering shouldn't treat two repeats of the same groove as
// different patterns just because one hit got voted "ride" and another
// "open hi-hat" due to per-hit classification noise. The specific voice is
// decided afterward, once per whole pattern, in renderBeatPattern.
function flattenForSimilarity(bar: BarHit[]): Set<string> {
  const flat = new Set<string>();
  for (const hit of bar) {
    if (!BEAT_INSTRUMENTS.includes(hit.instrument)) continue;
    const voice = CYMBAL_VOICES.includes(hit.instrument) ? "cymbal" : hit.instrument;
    flat.add(`${voice}:${hit.slot}`);
  }
  return flat;
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const key of a) if (b.has(key)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

interface BeatCluster {
  medoidIndex: number;
  memberIndices: number[];
}

// Greedy k-medoids (k=3): repeatedly pick whichever remaining bar is, on
// average, most similar to the rest of the remaining pool — that's the next
// groove's representative — then peel off everything close enough to it
// (the rest of that groove's repeats) before looking for the next one.
function clusterBeatBars(bars: BarHit[][], candidateIndices: number[], maxClusters: number = MAX_MAIN_BEATS): BeatCluster[] {
  const flattened = new Map<number, Set<string>>();
  for (const i of candidateIndices) {
    const flat = flattenForSimilarity(bars[i]);
    if (flat.size > 0) flattened.set(i, flat);
  }

  const pool = new Set(flattened.keys());
  const clusters: BeatCluster[] = [];

  while (clusters.length < maxClusters && pool.size > 0) {
    let best = -1;
    let bestScore = -Infinity;
    for (const i of pool) {
      let score = 0;
      let n = 0;
      for (const j of pool) {
        if (i === j) continue;
        score += jaccardSimilarity(flattened.get(i)!, flattened.get(j)!);
        n++;
      }
      const avg = n > 0 ? score / n : 0;
      if (avg > bestScore) {
        bestScore = avg;
        best = i;
      }
    }
    if (best === -1) break;
    const members = [...pool].filter(
      (i) => i === best || jaccardSimilarity(flattened.get(i)!, flattened.get(best)!) >= CLUSTER_MEMBER_SIMILARITY
    );
    clusters.push({ medoidIndex: best, memberIndices: members });
    for (const m of members) pool.delete(m);
  }

  // A short or very repetitive song might not have three distinct grooves —
  // pad with the strongest cluster(s) already found rather than leaving a
  // slot empty.
  const found = clusters.length;
  for (let i = 0; found > 0 && clusters.length < maxClusters; i++) {
    clusters.push(clusters[i % found]);
  }

  return clusters;
}

// A hit only has to show up in this fraction of a cluster's repeats to make
// it into the rendered pattern. Onset detection/classification is noisy
// hit-to-hit, so trusting only the one medoid bar's own hits — for kick/snare
// just as much as cymbal — routinely dropped a real, steady part of the
// groove just because that specific repeat happened to miss a hit every
// other repeat has. Pooling across every repeat rather than one bar is also
// what "listen to more of the song" means for this pipeline: there's no
// per-pattern audio window to widen (a pattern is one bar by construction),
// so more context comes from voting across all of that groove's occurrences
// instead of trusting a single one.
const HIT_SLOT_VOTE_FRACTION = 0.34;

// Which sixteenth-note slots a given instrument plays on within a cluster,
// pooled across every repeat rather than trusting just the medoid bar.
function votedSlotsForInstrument(bars: BarHit[][], cluster: BeatCluster, instrument: InstrumentId): Set<number> {
  const slotVotes = new Map<number, number>();
  for (const idx of cluster.memberIndices) {
    const slotsSeenInThisBar = new Set<number>();
    for (const hit of bars[idx]) {
      if (hit.instrument !== instrument) continue;
      if (!slotsSeenInThisBar.has(hit.slot)) {
        slotsSeenInThisBar.add(hit.slot);
        slotVotes.set(hit.slot, (slotVotes.get(hit.slot) ?? 0) + 1);
      }
    }
  }
  const slotThreshold = Math.max(1, Math.ceil(cluster.memberIndices.length * HIT_SLOT_VOTE_FRACTION));
  const slots = new Set<number>();
  for (const [slot, count] of slotVotes) {
    if (count >= slotThreshold) slots.add(slot);
  }
  return slots;
}

// Kick or snare's voted slots for a cluster, falling back to the medoid
// bar's own hits (unthresholded) if voting leaves nothing — e.g. a short
// cluster where repeats disagree enough that no slot clears the threshold.
// Never drops the instrument outright just because voting was strict.
function coreHitsForCluster(bars: BarHit[][], cluster: BeatCluster, instrument: InstrumentId): BarHit[] {
  const voted = votedSlotsForInstrument(bars, cluster, instrument);
  if (voted.size > 0) return [...voted].map((slot) => ({ slot, instrument }));
  return bars[cluster.medoidIndex].filter((h) => h.instrument === instrument);
}

// Which single cymbal voice a cluster favors, and which sixteenth-note slots
// it plays on — pooled across every repeat rather than trusting just the
// medoid bar's own hits. Returns null if the cluster has no cymbal-family
// hits to vote from at all (see renderBeatPattern for the fallback that
// covers that case).
function cymbalHitsForCluster(bars: BarHit[][], cluster: BeatCluster): BarHit[] | null {
  const instrumentVotes = new Map<InstrumentId, number>();
  for (const idx of cluster.memberIndices) {
    for (const hit of bars[idx]) {
      if (!CYMBAL_VOICES.includes(hit.instrument)) continue;
      instrumentVotes.set(hit.instrument, (instrumentVotes.get(hit.instrument) ?? 0) + 1);
    }
  }
  if (instrumentVotes.size === 0) return null;

  // A real drummer sticks to one cymbal for a groove rather than alternating
  // hi-hat/ride hit to hit.
  let cymbalVoice: InstrumentId = "hihatClosed";
  let topVotes = -1;
  for (const voice of CYMBAL_VOICES) {
    const v = instrumentVotes.get(voice) ?? 0;
    if (v > topVotes) {
      topVotes = v;
      cymbalVoice = voice;
    }
  }

  const slots = votedSlotsForInstrument(bars, cluster, cymbalVoice);
  return [...slots].map((slot) => ({ slot, instrument: cymbalVoice }));
}

// The default cymbal voice for a main beat that has no cymbal-family hits
// anywhere nearby to borrow (see findFallbackCymbalHits) — a plain
// quarter-note closed hi-hat, since a cover drummer needs *something* to
// keep time with rather than being left with just kick+snare.
function defaultCymbalHits(): BarHit[] {
  return [0, 4, 8, 12].map((slot) => ({ slot, instrument: "hihatClosed" as InstrumentId }));
}

// A whole-song fallback pattern for kick or snare — the most consistent
// recurring bar elsewhere in the song that actually has this instrument —
// for any main beat whose own cluster has none at all. Unlike the cymbal
// fallback above, this has no synthetic last resort: a groove missing kick
// or snare entirely is often a real musical choice (a stripped-down section,
// a breakdown), not just a detection gap, so if nothing in the whole song
// has this instrument either, it's left out rather than invented.
function findFallbackHits(bars: BarHit[][], candidateIndices: number[], instrument: InstrumentId): BarHit[] {
  const candidates = candidateIndices.filter((i) => bars[i].some((h) => h.instrument === instrument));
  if (candidates.length === 0) return [];
  const [cluster] = clusterBeatBars(bars, candidates, 1);
  return cluster ? coreHitsForCluster(bars, cluster, instrument) : [];
}

// A whole-song fallback cymbal voice+pattern, for any main beat whose own
// medoid/repeats happen to have no cymbal hits — plausible when a groove's
// hi-hat sits quiet enough in the mix to miss onset detection in that
// stretch, or a section genuinely plays without one. Picked the same way a
// single cluster's cymbal voice is (the most consistent recurring
// voice+slots), just searched across every candidate bar in the song rather
// than one cluster's own members, so every main beat still ends up with a
// steady cymbal a drummer could actually cover the song with, rather than
// shipping bare kick+snare just because this specific repeat's hi-hat missed
// onset detection.
function findFallbackCymbalHits(bars: BarHit[][], candidateIndices: number[]): BarHit[] {
  const barHasCymbal = (i: number) => bars[i].some((h) => CYMBAL_VOICES.includes(h.instrument));
  const cymbalCandidates = candidateIndices.filter(barHasCymbal);
  if (cymbalCandidates.length > 0) {
    const [cluster] = clusterBeatBars(bars, cymbalCandidates, 1);
    const hits = cluster ? cymbalHitsForCluster(bars, cluster) : null;
    if (hits && hits.length > 0) return hits;
  }
  return defaultCymbalHits();
}

interface CoreFallbacks {
  kick: BarHit[];
  snare: BarHit[];
  cymbal: BarHit[];
}

function renderBeatPattern(
  bars: BarHit[][],
  cluster: BeatCluster,
  fallback: CoreFallbacks,
  beatsPerBar: number
): StoredLine[] {
  const ownCymbalHits = cymbalHitsForCluster(bars, cluster);
  const cymbalHits = ownCymbalHits && ownCymbalHits.length > 0 ? ownCymbalHits : fallback.cymbal;

  const ownKickHits = coreHitsForCluster(bars, cluster, "kick");
  const kickHits = ownKickHits.length > 0 ? ownKickHits : fallback.kick;

  const ownSnareHits = coreHitsForCluster(bars, cluster, "snare");
  const snareHits = ownSnareHits.length > 0 ? ownSnareHits : fallback.snare;

  return barToStoredLines([...kickHits, ...snareHits, ...cymbalHits], BEAT_INSTRUMENT_ORDER, beatsPerBar);
}

function barToStoredLines(bar: BarHit[], instrumentOrder: InstrumentId[], beatsPerBar: number): StoredLine[] {
  const slotsByInstrument = new Map<InstrumentId, Set<number>>();
  for (const hit of bar) {
    if (!slotsByInstrument.has(hit.instrument)) slotsByInstrument.set(hit.instrument, new Set());
    slotsByInstrument.get(hit.instrument)!.add(hit.slot);
  }

  const lines: StoredLine[] = [];
  for (const instrument of instrumentOrder) {
    const slots = slotsByInstrument.get(instrument);
    if (!slots || slots.size === 0) continue;

    const blocks: (string | null)[] = new Array(MAX_BEATS).fill(null);
    for (let beat = 0; beat < beatsPerBar; beat++) {
      const hits: RhythmHit[] = [];
      for (let k = 0; k < 4; k++) {
        const globalSlot = beat * 4 + k;
        hits.push({ type: slots.has(globalSlot) ? "note" : "rest", note: "sixteenth" });
      }
      blocks[beat] = hits.some((h) => h.type === "note") ? tileFromHits(hits).id : null;
    }
    lines.push({ instrument, blocks, volume: 100 });
  }
  return lines;
}

// --- Debug instrumentation (gated by DEBUG_TRANSCRIBE env var) -----------

function percentiles(values: number[], ps: number[]): string {
  if (values.length === 0) return "n=0";
  const sorted = [...values].sort((a, b) => a - b);
  return (
    `n=${values.length} ` +
    ps.map((p) => `p${p}=${sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))].toFixed(3)}`).join(" ")
  );
}

function debugDump(ctx: {
  mono: { sampleRate: number; samples: Float32Array };
  onsetTimes: number[];
  features: OnsetFeatures[];
  bpm: number;
  gridOrigin: number;
  beatsPerBar: number;
  bars: BarHit[][];
  interiorIndices: number[];
  fillIndex: number | null;
  clusters: BeatCluster[];
  tomDecay: TomDecayThresholds;
}) {
  const { mono, onsetTimes, features, bpm, gridOrigin, beatsPerBar, bars, interiorIndices, fillIndex, clusters, tomDecay } =
    ctx;
  const durationSeconds = mono.samples.length / mono.sampleRate;
  console.error(
    `\n=== duration ${durationSeconds.toFixed(1)}s | onsets ${onsetTimes.length} | bpm ${bpm.toFixed(1)} | gridOrigin ${gridOrigin.toFixed(3)}s | beatsPerBar ${beatsPerBar} | bars ${bars.length} | tomDecay low=${tomDecay.low.toFixed(3)} mid=${tomDecay.mid.toFixed(3)} ===`
  );

  const lowDominant = features.filter((f) => f.lowRatio > KICK_LOW_RATIO);
  const midDominant = features.filter((f) => f.lowRatio <= KICK_LOW_RATIO && f.midRatio > SNARE_MID_RATIO);
  const highDominant = features.filter(
    (f) => f.lowRatio <= KICK_LOW_RATIO && f.midRatio <= SNARE_MID_RATIO && f.highRatio > HIHAT_HIGH_RATIO
  );
  console.error(
    "lowDominant (kick/tom) decayRatio:",
    percentiles(lowDominant.map((f) => f.decayRatio), [10, 25, 50, 75, 90])
  );
  console.error(
    "midDominant (snare/tom) decayRatio:",
    percentiles(midDominant.map((f) => f.decayRatio), [10, 25, 50, 75, 90])
  );
  console.error(
    "midDominant (snare/tom) highRatio (would-be cymbal content):",
    percentiles(midDominant.map((f) => f.highRatio), [10, 25, 50, 75, 90, 95])
  );
  console.error(
    "midDominant (snare/tom) midRatio (how far above SNARE_MID_RATIO):",
    percentiles(midDominant.map((f) => f.midRatio), [10, 25, 50, 75, 90])
  );
  console.error("all lowRatio/midRatio/highRatio percentiles:");
  console.error("  lowRatio:", percentiles(features.map((f) => f.lowRatio), [10, 25, 50, 75, 90]));
  console.error("  midRatio:", percentiles(features.map((f) => f.midRatio), [10, 25, 50, 75, 90]));
  console.error("  highRatio:", percentiles(features.map((f) => f.highRatio), [10, 25, 50, 75, 90]));

  const cymbalCandidates = features.filter((f) => f.lowRatio <= KICK_LOW_RATIO && f.midRatio <= SNARE_MID_RATIO);
  console.error(
    `cymbal-branch candidates (failed low+mid checks): n=${cymbalCandidates.length}/${features.length} highRatio:`,
    percentiles(cymbalCandidates.map((f) => f.highRatio), [10, 25, 50, 75, 90, 95])
  );
  console.error(
    "highDominant (cymbal) decayRatio:",
    percentiles(highDominant.map((f) => f.decayRatio), [10, 25, 50, 75, 90])
  );
  console.error(
    "highDominant (cymbal) highPeakiness:",
    percentiles(highDominant.map((f) => f.highPeakiness), [10, 25, 50, 75, 90])
  );
  console.error("highDominant (cymbal) peakRms:", percentiles(highDominant.map((f) => f.peakRms), [10, 25, 50, 75, 90]));
  console.error("all peakRms:", percentiles(features.map((f) => f.peakRms), [10, 25, 50, 75, 90, 95, 99]));

  const defaultedToNone = features.filter((f) => broadBand(f) === "none");
  console.error(`defaulted-to-snare (no band dominant): n=${defaultedToNone.length}/${features.length}`);

  const instrumentCounts = new Map<InstrumentId, number>();
  for (const bar of bars) for (const hit of bar) instrumentCounts.set(hit.instrument, (instrumentCounts.get(hit.instrument) ?? 0) + 1);
  console.error("instrument totals:", Object.fromEntries(instrumentCounts));
  console.error("median peak rms:", median(features.map((f) => f.peakRms)).toFixed(4));

  for (let i = 0; i < bars.length; i++) {
    const marker = i === fillIndex ? " <-- FILL" : !interiorIndices.includes(i) ? " (edge, excluded)" : "";
    const hits = [...bars[i]]
      .sort((a, b) => a.slot - b.slot)
      .map((h) => `${h.instrument}@${h.slot}`)
      .join(" ");
    console.error(`bar ${String(i).padStart(3)} [score ${fillScore(bars[i])}]: ${hits}${marker}`);
  }

  console.error(
    "clusters:",
    clusters.map((c) => ({ medoid: c.medoidIndex, members: c.memberIndices }))
  );
}
