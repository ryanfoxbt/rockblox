import { InstrumentId } from "./instruments";
import { hitVelocityMultiplier, NOTE_FRACTION, RhythmTile } from "./rhythm";
import { DEFAULT_KIT, sampleUrlsForKit } from "./drumKits";
import { loadFartBuffers } from "./fartKit";
import { CustomSamples, base64ToArrayBuffer } from "./customSamples";

export interface LineState {
  instrument: InstrumentId;
  blocks: (RhythmTile | null)[];
  volume: number; // 0-100
}

export type BufferMap = Map<InstrumentId, AudioBuffer>;

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

  const loading = loadingByKit.get(kit);
  if (loading) return loading;

  if (kit === "Fart") {
    // Synthesized per slot by default, with any real recording dropped into
    // public/fart-kit/ overriding that slot — see fartKit.ts.
    const promise = loadFartBuffers(ctx).then((map) => {
      bufferCacheByKit.set(kit, map);
      loadingByKit.delete(kit);
      return map;
    });
    loadingByKit.set(kit, promise);
    return promise;
  }

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

// User-recorded takes (from the "record your own fart" feature) only make
// sense layered onto the Fart kit's slots — decode each one and overlay it
// onto a copy of that kit's buffers, leaving the shared cache untouched.
async function withCustomSamples(
  ctx: BaseAudioContext,
  buffers: BufferMap,
  kit: string,
  customSamples?: CustomSamples
): Promise<BufferMap> {
  if (kit !== "Fart" || !customSamples) return buffers;
  const entries = Object.entries(customSamples) as [InstrumentId, string | undefined][];
  const decoded = await Promise.all(
    entries
      .filter((entry): entry is [InstrumentId, string] => !!entry[1])
      .map(async ([instrument, base64]) => {
        const audioBuffer = await ctx.decodeAudioData(base64ToArrayBuffer(base64));
        return [instrument, audioBuffer] as const;
      })
  );
  if (decoded.length === 0) return buffers;
  const merged: BufferMap = new Map(buffers);
  for (const [instrument, audioBuffer] of decoded) merged.set(instrument, audioBuffer);
  return merged;
}

/** A kit's buffers, with any recorded takes for it layered on top — the one entry point both single-slot and Stack Builder playback/rendering load buffers through. */
export async function loadEffectiveBuffers(
  ctx: BaseAudioContext,
  kit: string,
  customSamples?: CustomSamples
): Promise<BufferMap> {
  const base = await loadDrumBuffers(ctx, kit);
  return withCustomSamples(ctx, base, kit, customSamples);
}

export function triggerInstrument(
  ctx: BaseAudioContext,
  dest: AudioNode,
  buffers: BufferMap,
  instrument: InstrumentId,
  time: number,
  volume: number
): AudioBufferSourceNode | undefined {
  const buffer = buffers.get(instrument);
  if (!buffer) return undefined;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.value = volume / 100;
  src.connect(gain).connect(dest);
  src.start(time);
  return src;
}

// Returns the source nodes it started, so callers that need to hard-stop a
// still-playing arrangement mid-flight (Stack Builder) can track and stop
// them individually — the main looping player ignores the return value.
export function scheduleLoopEvents(
  ctx: BaseAudioContext,
  dest: AudioNode,
  buffers: BufferMap,
  lines: LineState[],
  measureBeats: number,
  beatSeconds: number,
  loopStart: number
): AudioBufferSourceNode[] {
  const sources: AudioBufferSourceNode[] = [];
  for (let beatIndex = 0; beatIndex < measureBeats; beatIndex++) {
    for (const line of lines) {
      const t = line.blocks[beatIndex];
      if (!t) continue;
      let beatOffset = 0;
      for (const h of t.hits) {
        if (h.type === "note") {
          const time = loopStart + beatIndex * beatSeconds + beatOffset * beatSeconds;
          const volume = line.volume * hitVelocityMultiplier(h.accent);
          const src = triggerInstrument(ctx, dest, buffers, line.instrument, time, volume);
          if (src) sources.push(src);
        }
        beatOffset += NOTE_FRACTION[h.note];
      }
    }
  }
  return sources;
}

const RENDER_TAIL_SECONDS = 2;

export async function renderSongToBuffer(
  lines: LineState[],
  bpm: number,
  measureBeats: number,
  loops: number,
  kit: string,
  customSamples?: CustomSamples
): Promise<AudioBuffer> {
  const sampleRate = 44100;
  const beatSeconds = 60 / bpm;
  const loopDuration = beatSeconds * measureBeats;
  const totalSeconds = loopDuration * loops + RENDER_TAIL_SECONDS;
  const offlineCtx = new OfflineAudioContext(2, Math.ceil(totalSeconds * sampleRate), sampleRate);

  const master = offlineCtx.createGain();
  master.gain.value = 0.85;
  master.connect(offlineCtx.destination);

  const buffers = await loadEffectiveBuffers(offlineCtx, kit, customSamples);

  for (let loop = 0; loop < loops; loop++) {
    scheduleLoopEvents(offlineCtx, master, buffers, lines, measureBeats, beatSeconds, loop * loopDuration);
  }

  return offlineCtx.startRendering();
}

// One entry per Stack Builder step, with that step's buffers already
// resolved (see loadEffectiveBuffers) — callers preload per-slot buffers
// once and reuse them across both live playback and this offline render, no
// re-decoding either way.
export interface StackStepPlayable {
  lines: LineState[];
  measureLength: number;
  buffers: BufferMap;
}

export async function renderStackToBuffer(steps: StackStepPlayable[], bpm: number): Promise<AudioBuffer> {
  const sampleRate = 44100;
  const beatSeconds = 60 / bpm;
  const stepDurations = steps.map((s) => beatSeconds * s.measureLength);
  const totalSeconds = stepDurations.reduce((a, b) => a + b, 0) + RENDER_TAIL_SECONDS;
  const offlineCtx = new OfflineAudioContext(2, Math.ceil(totalSeconds * sampleRate), sampleRate);

  const master = offlineCtx.createGain();
  master.gain.value = 0.85;
  master.connect(offlineCtx.destination);

  let elapsed = 0;
  steps.forEach((step, i) => {
    scheduleLoopEvents(offlineCtx, master, step.buffers, step.lines, step.measureLength, beatSeconds, elapsed);
    elapsed += stepDurations[i];
  });

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
  private baseBuffers: BufferMap | null = null;
  private buffers: BufferMap | null = null;
  private customBuffers: Map<InstrumentId, AudioBuffer> = new Map();
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
      this.baseBuffers = buffers;
      this.recomputeBuffers();
    });
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
    // A context can go "suspended" mid-playback for reasons outside a tab
    // visibility change too — most notably another app (or CarPlay/a
    // Bluetooth speaker taking over the phone's audio session) briefly
    // claiming the device's audio focus. Without this, playback would just
    // silently stay dead until the user hit Play again; this resumes on its
    // own as soon as focus is available.
    this.ctx.onstatechange = () => {
      if (this.ctx.state === "suspended" && this.playing) this.ctx.resume().catch(() => {});
    };
    this.setupMediaSession();
  }

  // Gives the OS a proper "Now Playing" entry for this tab — lock-screen and
  // Bluetooth/CarPlay media controls, and Control Center's now-playing card,
  // all key off the Media Session API rather than just "a tab is making
  // sound." A page that never sets this can end up treated as a lesser
  // audio source than a real media app (e.g. Spotify) still holding the
  // previous "Now Playing" slot, which reads as "can't play over Bluetooth."
  // A website still can't initiate Bluetooth pairing or pick a Sonos as an
  // output device itself — that's entirely OS-level — this just makes sure
  // RockBlocks plays properly and controllably through whatever output the
  // OS already has active.
  private setupMediaSession() {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: "RockBlocks",
      artist: "Custom drum beat",
      album: "RockBlocks",
      artwork: [
        { src: "/icon", sizes: "32x32", type: "image/png" },
        { src: "/apple-icon", sizes: "180x180", type: "image/png" },
      ],
    });
    navigator.mediaSession.setActionHandler("play", () => {
      void this.play();
    });
    navigator.mediaSession.setActionHandler("pause", () => this.stop());
    navigator.mediaSession.setActionHandler("stop", () => this.stop());
  }

  // Mobile browsers throttle or fully freeze this timer-driven lookahead
  // scheduler while the tab/app is backgrounded (and may suspend the
  // AudioContext outright). Left alone, the single pending setTimeout fires
  // once execution resumes with `nextLoopTime` far in the past, which then
  // schedules a burst of notes at/behind "now" and keeps re-firing near-
  // instantly until it catches up — heard as a garbled flurry of hits. On
  // returning to the foreground we instead resume the context and re-derive
  // the next loop boundary from the real elapsed time, preserving the beat's
  // original phase instead of replaying the backlog.
  private handleVisibilityChange = () => {
    if (document.visibilityState !== "visible" || !this.playing) return;
    void this.resyncAfterGap();
  };

  private async resyncAfterGap() {
    if (this.ctx.state === "suspended") {
      try {
        await this.ctx.resume();
      } catch {
        // Will retry resuming on the next play() or visibility change.
      }
    }
    if (!this.playing) return;
    if (this.timerId !== null) {
      window.clearTimeout(this.timerId);
      this.timerId = null;
    }
    if (this.currentLoopDuration > 0) {
      const target = this.ctx.currentTime + LOOKAHEAD_SECONDS;
      const loopsElapsed = Math.max(0, Math.ceil((target - this.currentLoopStart) / this.currentLoopDuration));
      this.nextLoopTime = this.currentLoopStart + loopsElapsed * this.currentLoopDuration;
    } else {
      this.nextLoopTime = this.ctx.currentTime + 0.1;
    }
    this.scheduleLoopAndNext();
  }

  /** Stops playback and releases the AudioContext — call when this player will no longer be used (e.g. its owning component unmounts). */
  destroy(): void {
    this.stop();
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    this.ctx.close().catch(() => {});
    if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
      navigator.mediaSession.setActionHandler("play", null);
      navigator.mediaSession.setActionHandler("pause", null);
      navigator.mediaSession.setActionHandler("stop", null);
      navigator.mediaSession.playbackState = "none";
    }
  }

  // Layers any recorded takes (currently Fart-kit-only) onto the freshly
  // loaded kit buffers, without touching the shared, cross-session cache in
  // bufferCacheByKit.
  private recomputeBuffers() {
    if (!this.baseBuffers) return;
    if (this.kit !== "Fart" || this.customBuffers.size === 0) {
      this.buffers = this.baseBuffers;
      return;
    }
    const merged: BufferMap = new Map(this.baseBuffers);
    for (const [instrument, audioBuffer] of this.customBuffers) merged.set(instrument, audioBuffer);
    this.buffers = merged;
  }

  /** Records a live mic take (see FartRecorder) into one kit slot for this session. */
  async setCustomSample(instrument: InstrumentId, arrayBuffer: ArrayBuffer): Promise<void> {
    const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
    this.customBuffers.set(instrument, audioBuffer);
    this.recomputeBuffers();
  }

  /** Seeds previously-saved recordings (base64, from a board/pattern) back into this player. */
  async loadCustomSamples(samples: CustomSamples): Promise<void> {
    const entries = Object.entries(samples) as [InstrumentId, string | undefined][];
    await Promise.all(
      entries
        .filter((entry): entry is [InstrumentId, string] => !!entry[1])
        .map(async ([instrument, base64]) => {
          const audioBuffer = await this.ctx.decodeAudioData(base64ToArrayBuffer(base64));
          this.customBuffers.set(instrument, audioBuffer);
        })
    );
    this.recomputeBuffers();
  }

  /** Discards this session's recorded takes (e.g. switching to a slot with none saved). */
  clearCustomSamples(): void {
    this.customBuffers.clear();
    this.recomputeBuffers();
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
      this.baseBuffers = buffers;
      this.recomputeBuffers();
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
    if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
      navigator.mediaSession.playbackState = "playing";
    }
  }

  stop() {
    this.playing = false;
    if (this.timerId !== null) {
      window.clearTimeout(this.timerId);
      this.timerId = null;
    }
    if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
      navigator.mediaSession.playbackState = "paused";
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
