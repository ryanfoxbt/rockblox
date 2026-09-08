// The bass voice: a small set of anchor samples, one per ~octave, that get
// pitch-shifted via playbackRate to reach every note the generator asks for.
// Nearest-anchor selection keeps every shift inside ~half an octave, where
// playbackRate resampling still sounds like a bass and not a chipmunk.
//
// Any anchor whose .mp3 is missing is replaced by a synthesized tone at the
// same pitch, so the feature works with no audio assets checked in at all —
// exactly how the "Fart" kit degrades (see fartKit.ts). Drop real files into
// public/bass/ later and they take over with no code change.

import { hitVelocityMultiplier } from "./rhythm";
import type { BassNote } from "./bassline";

// anchor MIDI note -> public/bass filename stem
const BASS_ANCHORS: Record<number, string> = {
  28: "bass-E1",
  40: "bass-E2",
  52: "bass-E3",
};

export type BassBufferMap = Map<number, AudioBuffer>;

let cache: BassBufferMap | null = null;
let loading: Promise<BassBufferMap> | null = null;

function midiToFreq(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

// A plain, slightly buzzy synth-bass one-shot — sawtooth + sub sine through a
// one-pole lowpass with a percussive decay. ~1.4s so a long held note has
// something to sustain into before the gain envelope closes it.
function synthesizeBassAnchor(ctx: BaseAudioContext, midi: number): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const duration = 1.4;
  const length = Math.floor(duration * sampleRate);
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  const freq = midiToFreq(midi);

  let phase = 0;
  let lp = 0;
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    phase += freq / sampleRate;
    phase -= Math.floor(phase);
    const saw = 2 * (phase - Math.floor(phase + 0.5));
    const sub = Math.sin(2 * Math.PI * phase); // one octave feel via same phase
    const raw = saw * 0.55 + sub * 0.6;

    // Lowpass that opens brighter at the attack and closes over the decay.
    const cutoff = 0.28 - 0.2 * Math.min(1, t / duration);
    lp += (raw - lp) * cutoff;

    const attack = Math.min(1, t / 0.006);
    const decay = Math.exp(-t * 3.2);
    data[i] = lp * attack * decay * 0.9;
  }
  return buffer;
}

async function fetchAnchor(ctx: BaseAudioContext, stem: string): Promise<AudioBuffer | null> {
  try {
    const res = await fetch(`/bass/${stem}.mp3`);
    if (!res.ok) return null;
    return await ctx.decodeAudioData(await res.arrayBuffer());
  } catch {
    return null;
  }
}

/** Anchor buffers for the bass, one per entry in BASS_ANCHORS. Cached and reused across contexts, like loadDrumBuffers. */
export function loadBassBuffers(ctx: BaseAudioContext): Promise<BassBufferMap> {
  if (cache) return Promise.resolve(cache);
  if (loading) return loading;

  loading = Promise.all(
    Object.entries(BASS_ANCHORS).map(async ([midiStr, stem]) => {
      const midi = Number(midiStr);
      const sampled = await fetchAnchor(ctx, stem);
      return [midi, sampled ?? synthesizeBassAnchor(ctx, midi)] as const;
    })
  ).then((entries) => {
    cache = new Map(entries);
    loading = null;
    return cache;
  });

  return loading;
}

function nearestAnchor(buffers: BassBufferMap, midi: number): number {
  let best = 40;
  let bestDist = Infinity;
  for (const anchor of buffers.keys()) {
    const d = Math.abs(anchor - midi);
    if (d < bestDist) {
      bestDist = d;
      best = anchor;
    }
  }
  return best;
}

// Overall trim so a 100-volume bassline sits under the drums rather than on
// top of them.
const BASS_TRIM = 0.8;

/**
 * Schedules one bass note. `lineVolume` is the bassline's 0-100 volume; the
 * note's own accent scales it further (reusing the drum velocity curve).
 * Returns the source node so a hard-stop caller can track it.
 */
export function triggerBassNote(
  ctx: BaseAudioContext,
  dest: AudioNode,
  buffers: BassBufferMap,
  note: BassNote,
  time: number,
  beatSeconds: number,
  lineVolume: number
): AudioBufferSourceNode | undefined {
  const anchor = nearestAnchor(buffers, note.midi);
  const buffer = buffers.get(anchor);
  if (!buffer) return undefined;

  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.playbackRate.value = 2 ** ((note.midi - anchor) / 12);

  const peak = Math.max(0, (lineVolume / 100) * hitVelocityMultiplier(note.accent) * BASS_TRIM);
  const holdSeconds = Math.max(0.08, note.duration * beatSeconds);
  const release = 0.08;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(peak, time + 0.008);
  gain.gain.setValueAtTime(peak, time + holdSeconds);
  gain.gain.linearRampToValueAtTime(0, time + holdSeconds + release);

  src.connect(gain).connect(dest);
  src.start(time);
  src.stop(time + holdSeconds + release + 0.02);
  return src;
}
