import { SlotLetter } from "./board";
import { CustomSamples } from "./customSamples";
import {
  BufferMap,
  LineState,
  StackStepPlayable,
  loadEffectiveBuffers,
  renderStackToBuffer,
  scheduleLoopEvents,
} from "./audioEngine";

export interface StackSlotSource {
  slot: SlotLetter;
  kit: string;
  customSamples?: CustomSamples;
}

export interface StackStepSource {
  slot: SlotLetter;
  lines: LineState[];
  measureLength: number;
}

const START_DELAY_SECONDS = 0.15;

// Plays a Stack Builder arrangement start-to-finish (not looping, unlike
// RockBloxPlayer) — every event for the whole song is scheduled up front
// against absolute AudioContext time. Web Audio handles that fine even for
// a few hundred events, so unlike the main player's infinite loop, no
// lookahead re-scheduling timer is needed.
export class StackPlayer {
  private ctx: AudioContext;
  private master: GainNode;
  private slotBuffers = new Map<SlotLetter, BufferMap>();
  private sources: AudioBufferSourceNode[] = [];
  private playing = false;
  private startTime = 0;
  private totalDuration = 0;
  private endTimerId: number | null = null;

  constructor() {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.85;
    this.master.connect(this.ctx.destination);
  }

  /** Resolves and caches each referenced slot's buffers once, regardless of how many times that slot repeats in the song. */
  async loadSlots(slots: StackSlotSource[]): Promise<void> {
    await Promise.all(
      slots.map(async (s) => {
        const buffers = await loadEffectiveBuffers(this.ctx, s.kit, s.customSamples);
        this.slotBuffers.set(s.slot, buffers);
      })
    );
  }

  private buildPlayableSteps(steps: StackStepSource[]): StackStepPlayable[] {
    const playable: StackStepPlayable[] = [];
    for (const step of steps) {
      const buffers = this.slotBuffers.get(step.slot);
      if (buffers) playable.push({ lines: step.lines, measureLength: step.measureLength, buffers });
    }
    return playable;
  }

  isPlaying() {
    return this.playing;
  }

  async play(steps: StackStepSource[], bpm: number): Promise<void> {
    if (this.playing) return;
    if (this.ctx.state === "suspended") await this.ctx.resume();

    const playable = this.buildPlayableSteps(steps);
    const beatSeconds = 60 / bpm;
    const t0 = this.ctx.currentTime + START_DELAY_SECONDS;

    let elapsed = 0;
    this.sources = [];
    for (const step of playable) {
      const started = scheduleLoopEvents(
        this.ctx,
        this.master,
        step.buffers,
        step.lines,
        step.measureLength,
        beatSeconds,
        t0 + elapsed
      );
      this.sources.push(...started);
      elapsed += beatSeconds * step.measureLength;
    }

    this.totalDuration = elapsed;
    this.startTime = t0;
    this.playing = true;

    this.endTimerId = window.setTimeout(() => {
      this.playing = false;
      this.sources = [];
    }, Math.max(0, (START_DELAY_SECONDS + elapsed) * 1000) + 50);
  }

  stop(): void {
    if (this.endTimerId !== null) {
      window.clearTimeout(this.endTimerId);
      this.endTimerId = null;
    }
    for (const src of this.sources) {
      try {
        src.stop();
      } catch {
        // Already finished — fine to ignore.
      }
    }
    this.sources = [];
    this.playing = false;
  }

  getProgress(): { elapsed: number; total: number } | null {
    if (!this.playing || this.totalDuration <= 0) return null;
    const elapsed = Math.max(0, Math.min(this.totalDuration, this.ctx.currentTime - this.startTime));
    return { elapsed, total: this.totalDuration };
  }

  /** Reuses the same preloaded buffers as live playback — no re-decoding for the MP3 export. */
  async renderToBuffer(steps: StackStepSource[], bpm: number): Promise<AudioBuffer> {
    return renderStackToBuffer(this.buildPlayableSteps(steps), bpm);
  }

  destroy(): void {
    this.stop();
    this.ctx.close();
  }
}
