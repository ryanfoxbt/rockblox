// Turns an isolated drums-stem WAV (from Replicate/Demucs, see stemSeparate.ts)
// into one representative one-bar RockBlocks pattern.
//
// There's no off-the-shelf hosted "audio -> drum notes" API, so this is a
// hand-rolled, best-effort pipeline: spectral-flux onset detection, tempo by
// autocorrelating the onset train, a frequency-band heuristic to classify
// each hit as kick/snare/closed-hihat/open-hihat, then grouping hits into
// 4-beat bars and picking the bar most similar to the rest of the song as
// "the" pattern. It'll nail simple, punchy grooves and struggle with busy
// fills, ghost notes, or heavily processed kits — expected to be reviewed
// and touched up in the Editor afterward, not treated as exact.
import FFT from "fft.js";
import { InstrumentId } from "./instruments";
import { RhythmHit, tileFromHits } from "./rhythm";
import { MAX_BEATS, StoredLine } from "./song";

export interface TranscribedPattern {
  bpm: number;
  measureLength: number;
  lines: StoredLine[];
}

const BEATS_PER_BAR = 4;
const SLOTS_PER_BAR = BEATS_PER_BAR * 4; // 4 sixteenth-note slots per beat

const ONSET_FFT_SIZE = 2048;
const ONSET_HOP_SIZE = 512;
const ONSET_THRESHOLD_FACTOR = 1.6; // local mean + this * local std
const ONSET_LOCAL_WINDOW_SECONDS = 0.5;
const MIN_ONSET_GAP_SECONDS = 0.06;
const MIN_ONSET_COUNT = 8;

const CLASSIFY_FFT_SIZE = 1024;
const CLASSIFY_LOW_HZ = 150;
const CLASSIFY_MID_HIGH_HZ = 800;
const CLASSIFY_HIGH_HZ = 3000;
const KICK_LOW_RATIO = 0.45;
// A linear frequency axis gives the >3000Hz band far more bins than the
// <150Hz or 150-800Hz bands purely by span, so broadband noise (a snare's
// wires as much as a hihat's shimmer) always reads as "mostly high energy."
// The mid-band check below is what actually separates them: a snare's shell
// resonance concentrates real energy around 150-800Hz that a hihat/cymbal —
// almost nothing below a few kHz — doesn't have, so it's checked first.
const SNARE_MID_RATIO = 0.12;
const HIHAT_HIGH_RATIO = 0.4;

const MIN_BPM = 60;
const MAX_BPM = 200;

const INSTRUMENT_ORDER: InstrumentId[] = ["kick", "snare", "hihatClosed", "hihatOpen"];

export function transcribeDrums(wavBuffer: Buffer): TranscribedPattern {
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

  const classified = onsetTimes.map((time) => ({ time, instrument: classifyOnset(mono, time) }));
  const bars = groupIntoBars(classified, gridOrigin, beatSeconds);
  const representative = pickRepresentativeBar(bars);

  return {
    bpm: Math.round(bpm),
    measureLength: BEATS_PER_BAR,
    lines: barToStoredLines(representative),
  };
}

// --- WAV parsing -------------------------------------------------------

interface WavData {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  samples: Float32Array; // interleaved, normalized to [-1, 1]
}

function parseWav(buffer: Buffer): WavData {
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

// --- Per-hit classification ---------------------------------------------

function classifyOnsetRatios(
  mono: { sampleRate: number; samples: Float32Array },
  timeSeconds: number
): { lowRatio: number; midRatio: number; highRatio: number } {
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
  for (let b = 1; b < bins; b++) {
    const re = out[2 * b];
    const im = out[2 * b + 1];
    const energy = re * re + im * im;
    const hz = b * binHz;
    totalEnergy += energy;
    if (hz < CLASSIFY_LOW_HZ) lowEnergy += energy;
    else if (hz < CLASSIFY_MID_HIGH_HZ) midEnergy += energy;
    else if (hz > CLASSIFY_HIGH_HZ) highEnergy += energy;
  }
  if (totalEnergy <= 0) return { lowRatio: 0, midRatio: 0, highRatio: 0 };
  return { lowRatio: lowEnergy / totalEnergy, midRatio: midEnergy / totalEnergy, highRatio: highEnergy / totalEnergy };
}

function classifyOnset(mono: { sampleRate: number; samples: Float32Array }, timeSeconds: number): InstrumentId {
  const { samples, sampleRate } = mono;
  const startSample = Math.max(0, Math.round(timeSeconds * sampleRate));
  const { lowRatio, midRatio, highRatio } = classifyOnsetRatios(mono, timeSeconds);
  if (lowRatio === 0 && midRatio === 0 && highRatio === 0) return "snare";

  if (lowRatio > KICK_LOW_RATIO) return "kick";
  if (midRatio > SNARE_MID_RATIO) return "snare";
  if (highRatio > HIHAT_HIGH_RATIO) {
    return sustainsHighEnergy(samples, sampleRate, startSample) ? "hihatOpen" : "hihatClosed";
  }
  return "snare";
}

// Closed hi-hats choke almost immediately; open ones keep ringing. A crude
// first-difference high-pass is enough to tell "faded out" from "still going"
// without a second full FFT per hit.
function sustainsHighEnergy(samples: Float32Array, sampleRate: number, onsetSample: number): boolean {
  const early = highPassEnergy(samples, sampleRate, onsetSample, 0.005, 0.03);
  const late = highPassEnergy(samples, sampleRate, onsetSample, 0.15, 0.25);
  if (early <= 0) return false;
  return late / early > 0.15;
}

function highPassEnergy(
  samples: Float32Array,
  sampleRate: number,
  onsetSample: number,
  fromSeconds: number,
  toSeconds: number
): number {
  const from = onsetSample + Math.round(fromSeconds * sampleRate);
  const to = onsetSample + Math.round(toSeconds * sampleRate);
  let energy = 0;
  let prev = samples[from] ?? 0;
  for (let i = from + 1; i < to; i++) {
    const s = samples[i] ?? 0;
    const diff = s - prev;
    energy += diff * diff;
    prev = s;
  }
  return energy;
}

// --- Bar grouping + representative-bar selection -------------------------

type BarPattern = Map<InstrumentId, Set<number>>; // instrument -> set of hit sixteenth-slots (0..15)

function groupIntoBars(
  onsets: { time: number; instrument: InstrumentId }[],
  gridOrigin: number,
  beatSeconds: number
): BarPattern[] {
  const sixteenthSeconds = beatSeconds / 4;
  const bars: BarPattern[] = [];
  for (const onset of onsets) {
    const slotIndex = Math.round((onset.time - gridOrigin) / sixteenthSeconds);
    if (slotIndex < 0) continue; // before the grid origin — pre-roll noise, not part of the groove
    const barIndex = Math.floor(slotIndex / SLOTS_PER_BAR);
    const slotInBar = slotIndex - barIndex * SLOTS_PER_BAR;
    while (bars.length <= barIndex) bars.push(new Map());
    const bar = bars[barIndex];
    if (!bar.has(onset.instrument)) bar.set(onset.instrument, new Set());
    bar.get(onset.instrument)!.add(slotInBar);
  }
  return bars;
}

function flattenBar(bar: BarPattern): Set<string> {
  const flat = new Set<string>();
  for (const [instrument, slots] of bar) for (const slot of slots) flat.add(`${instrument}:${slot}`);
  return flat;
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const key of a) if (b.has(key)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// "The most common one" per the product's brief: the bar whose hit pattern
// is, on average, most similar to every other bar in the song. Skips the
// first/last bar when there's enough material to spare, since those are
// disproportionately likely to be a sparse intro or a one-off fill rather
// than the actual repeating groove.
function pickRepresentativeBar(bars: BarPattern[]): BarPattern {
  const pool = bars.length > 4 ? bars.slice(1, -1) : bars;
  const candidates = pool.filter((bar) => flattenBar(bar).size > 0);
  const scored = candidates.length > 0 ? candidates : pool;

  const flattened = scored.map(flattenBar);
  let bestIndex = 0;
  let bestScore = -Infinity;
  for (let i = 0; i < scored.length; i++) {
    let score = 0;
    for (let j = 0; j < scored.length; j++) {
      if (i === j) continue;
      score += jaccardSimilarity(flattened[i], flattened[j]);
    }
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }
  return scored[bestIndex];
}

function barToStoredLines(bar: BarPattern): StoredLine[] {
  const lines: StoredLine[] = [];
  for (const instrument of INSTRUMENT_ORDER) {
    const slots = bar.get(instrument);
    if (!slots || slots.size === 0) continue;

    const blocks: (string | null)[] = new Array(MAX_BEATS).fill(null);
    for (let beat = 0; beat < BEATS_PER_BAR; beat++) {
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
