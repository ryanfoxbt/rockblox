import { InstrumentId } from "./instruments";
import { NOTE_FRACTION, RhythmTile } from "./rhythm";
import { DEFAULT_KIT, sampleUrlsForKit } from "./drumKits";
import { synthesizeFartBuffers } from "./fartKit";

export interface LineState {
  instrument: InstrumentId;
  blocks: (RhythmTile | null)[];
  volume: number; // 0-100
}

type BufferMap = Map<InstrumentId, AudioBuffer>;

// Decoded AudioBuffers aren't tied to the context that decoded them, so we
// decode each kit's samples exactly once and reuse the same buffers for both
// live playback and offline (MP3) rendering — no re-fetching, no re-decoding.
// Every kit — including the drum-machine ones — is just a set of one-shot
// sample files we fetch and decode ourselves; we deliberately don't use
// smplr's own DrumMachine/Scheduler classes for playback, since their
// wall-clock-based scheduling breaks OfflineAudioContext rendering (only the
// first ~200ms would render correctly). Every hit here gets a fresh
// AudioBufferSourceNode with an absolute, pre-computed start time instead, so
// it's exactly as reliable offline as it is live, for any kit.
const bufferCacheByKit = new Map<string, BufferMap>();
const loadingByKit = new Map<string, Promise<BufferMap>>();

export function loadDrumBuffers(ctx: BaseAudioContext, kit: string): Promise<BufferMap> {
  const cached = bufferCacheByKit.get(kit);
  if (cached) return Promise.resolve(cached);

  if (kit === "Fart") {
    // Synthesized instead of fetched — no network round trip needed, so we
    // can build and cache it synchronously just like the fetched kits above.
    const map = synthesizeFartBuffers(ctx);
    bufferCacheByKit.set(kit, map);
    return Promise.resolve(map);
  }

  const loading = loadingByKit.get(kit);
  if (loading) return loading;

  const urls = sampleUrlsForKit(kit);
  const promise = Promise.all(
    (Object.entries(urls) as [InstrumentId, string][]).map(async ([instrument, url]) => {
      const res = await fetch(url);
      const arrayBuffer = await res.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      return [instrument, audioBuffer] as const;
    })
  ).then((entries) => {
    const map: BufferMap = new Map(entries);
    bufferCacheByKit.set(kit, map);
    loadingByKit.delete(kit);
    return map;
  });

  loadingByKit.set(kit, promise);
  return promise;
}

export function triggerInstrument(
  ctx: BaseAudioContext,
  dest: AudioNode,
  buffers: BufferMap,
  instrument: InstrumentId,
  time: number,
  volume: number
) {
  const buffer = buffers.get(instrument);
  if (!buffer) return;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.value = volume / 100;
  src.connect(gain).connect(dest);
  src.start(time);
}

function scheduleLoopEvents(
  ctx: BaseAudioContext,
  dest: AudioNode,
  buffers: BufferMap,
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
          triggerInstrument(ctx, dest, buffers, line.instrument, time, line.volume);
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
  loops: number,
  kit: string
): Promise<AudioBuffer> {
  const sampleRate = 44100;
  const beatSeconds = 60 / bpm;
  const loopDuration = beatSeconds * measureBeats;
  const totalSeconds = loopDuration * loops + RENDER_TAIL_SECONDS;
  const offlineCtx = new OfflineAudioContext(2, Math.ceil(totalSeconds * sampleRate), sampleRate);

  const master = offlineCtx.createGain();
  master.gain.value = 0.85;
  master.connect(offlineCtx.destination);

  const buffers = await loadDrumBuffers(offlineCtx, kit);

  for (let loop = 0; loop < loops; loop++) {
    scheduleLoopEvents(offlineCtx, master, buffers, lines, measureBeats, beatSeconds, loop * loopDuration);
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
  private buffers: BufferMap | null = null;
  private kit: string;
  private readyPromise: Promise<void>;
  private lines: LineState[] = [];
  private bpm = 100;
  private measureBeats = 0;
  private playing = false;
  private timerId: number | null = null;
  private nextLoopTime = 0;
  private currentLoopStart = 0;
  private currentLoopDuration = 0;

  constructor(initialKit: string = DEFAULT_KIT) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.85;
    this.master.connect(this.ctx.destination);
    this.kit = initialKit;
    this.readyPromise = loadDrumBuffers(this.ctx, initialKit).then((buffers) => {
      this.buffers = buffers;
    });
  }

  /** Resolves once the current kit's samples have been fetched and decoded. */
  get ready(): Promise<void> {
    return this.readyPromise;
  }

  getKit(): string {
    return this.kit;
  }

  setKit(kit: string): Promise<void> {
    if (kit === this.kit && this.buffers) return this.readyPromise;
    this.kit = kit;
    this.buffers = null;
    this.readyPromise = loadDrumBuffers(this.ctx, kit).then((buffers) => {
      this.buffers = buffers;
    });
    return this.readyPromise;
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
    await this.readyPromise;
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
    if (!this.buffers) return;
    scheduleLoopEvents(this.ctx, this.master, this.buffers, this.lines, this.measureBeats, beatSeconds, loopStart);
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
