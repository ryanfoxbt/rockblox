import { InstrumentId } from "./instruments";
import { NOTE_FRACTION, RhythmTile } from "./rhythm";

export interface LineState {
  instrument: InstrumentId;
  blocks: (RhythmTile | null)[];
}

let sharedNoiseBuffer: AudioBuffer | null = null;

function getNoiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  if (!sharedNoiseBuffer || sharedNoiseBuffer.sampleRate !== ctx.sampleRate) {
    const length = ctx.sampleRate * 2;
    sharedNoiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = sharedNoiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  }
  return sharedNoiseBuffer;
}

function noiseBurst(
  ctx: BaseAudioContext,
  dest: AudioNode,
  time: number,
  opts: {
    filterType: BiquadFilterType;
    freq: number;
    Q?: number;
    duration: number;
    gain: number;
  }
) {
  const src = ctx.createBufferSource();
  src.buffer = getNoiseBuffer(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = opts.filterType;
  filter.frequency.value = opts.freq;
  if (opts.Q !== undefined) filter.Q.value = opts.Q;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(opts.gain, time);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + opts.duration);
  src.connect(filter).connect(gain).connect(dest);
  src.start(time);
  src.stop(time + opts.duration + 0.05);
}

function tonePulse(
  ctx: BaseAudioContext,
  dest: AudioNode,
  time: number,
  opts: {
    type: OscillatorType;
    freqStart: number;
    freqEnd?: number;
    duration: number;
    gain: number;
  }
) {
  const osc = ctx.createOscillator();
  osc.type = opts.type;
  osc.frequency.setValueAtTime(opts.freqStart, time);
  if (opts.freqEnd !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.freqEnd), time + opts.duration);
  }
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(opts.gain, time);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + opts.duration);
  osc.connect(gain).connect(dest);
  osc.start(time);
  osc.stop(time + opts.duration + 0.05);
}

function playKick(ctx: BaseAudioContext, dest: AudioNode, time: number) {
  tonePulse(ctx, dest, time, { type: "sine", freqStart: 150, freqEnd: 40, duration: 0.22, gain: 1 });
  noiseBurst(ctx, dest, time, { filterType: "lowpass", freq: 400, duration: 0.03, gain: 0.6 });
}

function playSnare(ctx: BaseAudioContext, dest: AudioNode, time: number) {
  noiseBurst(ctx, dest, time, { filterType: "highpass", freq: 900, Q: 0.7, duration: 0.18, gain: 0.9 });
  tonePulse(ctx, dest, time, { type: "triangle", freqStart: 190, freqEnd: 140, duration: 0.12, gain: 0.5 });
}

function playHiHat(ctx: BaseAudioContext, dest: AudioNode, time: number, open: boolean) {
  noiseBurst(ctx, dest, time, {
    filterType: "highpass",
    freq: 7500,
    Q: 0.8,
    duration: open ? 0.35 : 0.06,
    gain: 0.5,
  });
}

function playCrash(ctx: BaseAudioContext, dest: AudioNode, time: number) {
  noiseBurst(ctx, dest, time, { filterType: "highpass", freq: 5000, Q: 0.5, duration: 1.8, gain: 0.55 });
  noiseBurst(ctx, dest, time, { filterType: "bandpass", freq: 6500, Q: 0.4, duration: 1.4, gain: 0.35 });
}

function playRide(ctx: BaseAudioContext, dest: AudioNode, time: number) {
  noiseBurst(ctx, dest, time, { filterType: "bandpass", freq: 4500, Q: 1.2, duration: 0.6, gain: 0.35 });
  tonePulse(ctx, dest, time, { type: "sine", freqStart: 850, duration: 0.3, gain: 0.15 });
}

function playTom(ctx: BaseAudioContext, dest: AudioNode, time: number, baseFreq: number) {
  tonePulse(ctx, dest, time, {
    type: "sine",
    freqStart: baseFreq * 1.6,
    freqEnd: baseFreq,
    duration: 0.28,
    gain: 0.9,
  });
}

function playRimshot(ctx: BaseAudioContext, dest: AudioNode, time: number) {
  noiseBurst(ctx, dest, time, { filterType: "bandpass", freq: 1800, Q: 2, duration: 0.08, gain: 0.7 });
  tonePulse(ctx, dest, time, { type: "square", freqStart: 400, duration: 0.04, gain: 0.3 });
}

export function triggerInstrument(
  ctx: BaseAudioContext,
  dest: AudioNode,
  instrument: InstrumentId,
  time: number
) {
  switch (instrument) {
    case "kick":
      return playKick(ctx, dest, time);
    case "snare":
      return playSnare(ctx, dest, time);
    case "hihatClosed":
      return playHiHat(ctx, dest, time, false);
    case "hihatOpen":
      return playHiHat(ctx, dest, time, true);
    case "crash":
      return playCrash(ctx, dest, time);
    case "ride":
      return playRide(ctx, dest, time);
    case "lowTom":
      return playTom(ctx, dest, time, 100);
    case "midTom":
      return playTom(ctx, dest, time, 150);
    case "highTom":
      return playTom(ctx, dest, time, 220);
    case "rimshot":
      return playRimshot(ctx, dest, time);
  }
}

function scheduleLoopEvents(
  ctx: BaseAudioContext,
  dest: AudioNode,
  lines: LineState[],
  measureBeats: number,
  beatSeconds: number,
  loopStart: number
) {
  for (let beatIndex = 0; beatIndex < measureBeats; beatIndex++) {
    for (const line of lines) {
      const t = line.blocks[beatIndex];
      if (!t) continue;
      let beatOffset = 0;
      for (const h of t.hits) {
        if (h.type === "note") {
          const time = loopStart + beatIndex * beatSeconds + beatOffset * beatSeconds;
          triggerInstrument(ctx, dest, line.instrument, time);
        }
        beatOffset += NOTE_FRACTION[h.note];
      }
    }
  }
}

const RENDER_TAIL_SECONDS = 2;

export async function renderSongToBuffer(
  lines: LineState[],
  bpm: number,
  measureBeats: number,
  loops: number
): Promise<AudioBuffer> {
  const sampleRate = 44100;
  const beatSeconds = 60 / bpm;
  const loopDuration = beatSeconds * measureBeats;
  const totalSeconds = loopDuration * loops + RENDER_TAIL_SECONDS;
  const offlineCtx = new OfflineAudioContext(2, Math.ceil(totalSeconds * sampleRate), sampleRate);

  const master = offlineCtx.createGain();
  master.gain.value = 0.85;
  master.connect(offlineCtx.destination);

  for (let loop = 0; loop < loops; loop++) {
    scheduleLoopEvents(offlineCtx, master, lines, measureBeats, beatSeconds, loop * loopDuration);
  }

  return offlineCtx.startRendering();
}

export interface PlayheadInfo {
  beat: number;
  fraction: number;
}

const LOOKAHEAD_SECONDS = 0.15;

export class RockBloxPlayer {
  private ctx: AudioContext;
  private master: GainNode;
  private lines: LineState[] = [];
  private bpm = 100;
  private measureBeats = 0;
  private playing = false;
  private timerId: number | null = null;
  private nextLoopTime = 0;
  private currentLoopStart = 0;
  private currentLoopDuration = 0;

  constructor() {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.85;
    this.master.connect(this.ctx.destination);
  }

  updateSong(lines: LineState[], bpm: number, measureBeats: number) {
    this.lines = lines;
    this.bpm = bpm;
    this.measureBeats = measureBeats;
  }

  isPlaying() {
    return this.playing;
  }

  async play() {
    if (this.playing || this.measureBeats < 1) return;
    if (this.ctx.state === "suspended") await this.ctx.resume();
    this.playing = true;
    this.nextLoopTime = this.ctx.currentTime + 0.1;
    this.scheduleLoopAndNext();
  }

  stop() {
    this.playing = false;
    if (this.timerId !== null) {
      window.clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  private scheduleEvents(loopStart: number, beatSeconds: number) {
    scheduleLoopEvents(this.ctx, this.master, this.lines, this.measureBeats, beatSeconds, loopStart);
  }

  private scheduleLoopAndNext = () => {
    if (!this.playing || this.measureBeats < 1) return;
    const beatSeconds = 60 / this.bpm;
    const loopDuration = beatSeconds * this.measureBeats;
    const loopStart = this.nextLoopTime;
    this.currentLoopStart = loopStart;
    this.currentLoopDuration = loopDuration;
    this.scheduleEvents(loopStart, beatSeconds);
    this.nextLoopTime = loopStart + loopDuration;
    const delayMs = Math.max(0, (this.nextLoopTime - this.ctx.currentTime - LOOKAHEAD_SECONDS) * 1000);
    this.timerId = window.setTimeout(this.scheduleLoopAndNext, delayMs);
  };

  getPlayheadInfo(): PlayheadInfo | null {
    if (!this.playing || this.currentLoopDuration <= 0) return null;
    let elapsed = (this.ctx.currentTime - this.currentLoopStart) % this.currentLoopDuration;
    if (elapsed < 0) elapsed += this.currentLoopDuration;
    const beatSeconds = this.currentLoopDuration / this.measureBeats;
    const beat = Math.floor(elapsed / beatSeconds);
    const fraction = (elapsed % beatSeconds) / beatSeconds;
    return { beat, fraction };
  }
}
