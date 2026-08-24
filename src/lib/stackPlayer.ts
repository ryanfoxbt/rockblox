import { CustomSamples } from "./customSamples";
import {
  BufferMap,
  LineState,
  StackStepPlayable,
  loadEffectiveBuffers,
  renderStackToBuffer,
  scheduleLoopEvents,
} from "./audioEngine";

// `slot` is a plain string, not lib/board's SlotLetter ("A"-"D") — a real
// board's Stack is always built from exactly those four, but this player is
// also reused by /test's full-song preview, which can have as many
// arbitrarily-labeled slots as a song actually needs (see
// transcribeDrums.ts's transcribeFullSong). A SlotLetter is itself a valid
// string, so every existing board-Stack call site keeps working unchanged.
export interface StackSlotSource {
  slot: string;
  kit: string;
  customSamples?: CustomSamples;
}

export interface StackStepSource {
  slot: string;
  lines: LineState[];
  measureLength: number;
}

const START_DELAY_SECONDS = 0.15;
// How far ahead of a pass's end the next pass gets scheduled — mirrors
// RockBloxPlayer's lookahead, and exists for the same reason: it gives the
// resync-on-visibility-change logic below a grid to snap back onto.
const LOOKAHEAD_SECONDS = 0.15;

// Plays a Stack Builder arrangement start-to-finish, optionally looping the
// whole thing so people can jam along with it. A non-looping pass schedules
// every event for the whole song up front against absolute AudioContext
// time — Web Audio handles that fine even for a few hundred events. Looping
// instead schedules one pass at a time, re-scheduling the next pass shortly
// before the current one ends (same lookahead-timer approach as
// RockBloxPlayer's infinite loop, and vulnerable to the same backgrounded-tab
// timer throttling, so it gets the same visibilitychange resync).
export class StackPlayer {
  private ctx: AudioContext;
  private master: GainNode;
  private slotBuffers = new Map<string, BufferMap>();
  private sources: AudioBufferSourceNode[] = [];
  private playing = false;
  private loop = false;
  private steps: StackStepSource[] = [];
  private bpm = 100;
  private currentPassStart = 0;
  private nextPassTime = 0;
  private totalDuration = 0;
  private endTimerId: number | null = null;

  constructor() {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.85;
    this.master.connect(this.ctx.destination);
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
  }

  private handleVisibilityChange = () => {
    if (document.visibilityState !== "visible" || !this.playing || !this.loop) return;
    void this.resyncAfterGap();
  };

  // Safari on iOS has a WebKit-only AudioContext state, "interrupted",
  // distinct from "suspended" — entered when another app (e.g. Photos
  // playing a video) takes the device's audio session while this tab is
  // backgrounded. The browser never auto-recovers from it, so code that only
  // checks for "suspended" leaves playback stuck. See RockBloxPlayer.needsResume.
  private needsResume(): boolean {
    const state: string = this.ctx.state;
    return state === "suspended" || state === "interrupted";
  }

  private async resyncAfterGap() {
    if (this.needsResume()) {
      try {
        await this.ctx.resume();
      } catch {
        // Will retry on the next play() or visibility change.
      }
    }
    if (!this.playing || !this.loop) return;
    if (this.endTimerId !== null) {
      window.clearTimeout(this.endTimerId);
      this.endTimerId = null;
    }
    const passDuration = this.totalDuration;
    if (passDuration > 0) {
      const target = this.ctx.currentTime + LOOKAHEAD_SECONDS;
      const passesElapsed = Math.max(0, Math.ceil((target - this.currentPassStart) / passDuration));
      this.nextPassTime = this.currentPassStart + passesElapsed * passDuration;
    } else {
      this.nextPassTime = this.ctx.currentTime + START_DELAY_SECONDS;
    }
    this.schedulePassAndNext();
  }

  // schedulePassAndNext reads `this.loop` fresh each time it runs (rather
  // than capturing it), so toggling this while playing takes effect at the
  // very next pass boundary without needing to touch any pending timer.
  setLoop(loop: boolean): void {
    this.loop = loop;
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

  /** Retunes an in-progress (or not-yet-started) playback — takes effect at the next scheduled pass, same as the tempo read fresh each call in schedulePassAndNext. */
  setBpm(bpm: number): void {
    this.bpm = bpm;
  }

  async play(steps: StackStepSource[], bpm: number, loop: boolean = false): Promise<void> {
    if (this.playing) return;
    if (this.needsResume()) await this.ctx.resume();
    if (this.buildPlayableSteps(steps).length === 0) return;

    this.steps = steps;
    this.bpm = bpm;
    this.loop = loop;
    this.nextPassTime = this.ctx.currentTime + START_DELAY_SECONDS;
    this.playing = true;
    this.schedulePassAndNext();
  }

  private schedulePassAndNext = () => {
    if (!this.playing) return;
    const playable = this.buildPlayableSteps(this.steps);
    const beatSeconds = 60 / this.bpm;
    const passStart = this.nextPassTime;
    this.currentPassStart = passStart;

    let elapsed = 0;
    const sources: AudioBufferSourceNode[] = [];
    for (const step of playable) {
      const started = scheduleLoopEvents(
        this.ctx,
        this.master,
        step.buffers,
        step.lines,
        step.measureLength,
        beatSeconds,
        passStart + elapsed
      );
      sources.push(...started);
      elapsed += beatSeconds * step.measureLength;
    }
    this.sources = sources;
    this.totalDuration = elapsed;
    this.nextPassTime = passStart + elapsed;

    if (this.loop) {
      const delayMs = Math.max(0, (this.nextPassTime - this.ctx.currentTime - LOOKAHEAD_SECONDS) * 1000);
      this.endTimerId = window.setTimeout(this.schedulePassAndNext, delayMs);
    } else {
      const delayMs = Math.max(0, (this.nextPassTime - this.ctx.currentTime) * 1000) + 50;
      this.endTimerId = window.setTimeout(() => {
        this.playing = false;
        this.sources = [];
      }, delayMs);
    }
  };

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
    const elapsed = Math.max(0, Math.min(this.totalDuration, this.ctx.currentTime - this.currentPassStart));
    return { elapsed, total: this.totalDuration };
  }

  /** Reuses the same preloaded buffers as live playback — no re-decoding for the MP3 export. */
  async renderToBuffer(steps: StackStepSource[], bpm: number): Promise<AudioBuffer> {
    return renderStackToBuffer(this.buildPlayableSteps(steps), bpm);
  }

  destroy(): void {
    this.stop();
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    this.ctx.close().catch(() => {});
  }
}
