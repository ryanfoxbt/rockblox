// The bass voice. Each note is synthesized live from oscillators + a lowpass
// + an amp envelope — no sample files, so it sounds identical in the editor,
// the Stack Builder, and the offline MP3 render, and there's nothing to host
// or decode. Oscillators are band-limited, so there's no aliasing "buzz" the
// old pitch-shifted-sample approach had, and pitch is exact.

import { hitVelocityMultiplier } from "./rhythm";
import { type BassNote, type BassVoiceId, DEFAULT_BASS_VOICE } from "./bassline";

function midiToFreq(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

interface OscSpec {
  type: OscillatorType;
  // Frequency multiple of the note's fundamental (0.5 = one octave down,
  // 2 = one octave up).
  ratio: number;
  detune?: number; // cents
  gain: number; // relative mix level
}

interface BassVoiceSpec {
  oscillators: OscSpec[];
  // Lowpass tracking the note: cutoff = freq * mult, swept from `open` down to
  // `close` over the note's decay, with resonance `q`.
  filter: { openMult: number; closeMult: number; q: number; minHz: number };
  // Amp envelope, seconds / ratio. `sustain` is the level held after the
  // initial decay until the note's own length runs out.
  amp: { attack: number; decay: number; sustain: number; release: number };
  // Optional pluck: start `semitones` sharp and glide to pitch over `time`.
  pitchEnv?: { semitones: number; time: number };
  // Overall level trim for this voice so they're roughly matched.
  gain: number;
}

// Oscillator mix gains per voice are normalized to sum ~0.9, so a voice's raw
// output can't exceed ~1 before the amp envelope even when its partials line
// up in phase. The master bus also runs through a limiter (see audioEngine),
// but keeping the source clean means the limiter almost never has to act.
const VOICES: Record<BassVoiceId, BassVoiceSpec> = {
  electric: {
    oscillators: [
      { type: "sawtooth", ratio: 1, gain: 0.42 },
      { type: "sine", ratio: 0.5, gain: 0.48 },
    ],
    filter: { openMult: 6, closeMult: 2.5, q: 4, minHz: 90 },
    amp: { attack: 0.008, decay: 0.14, sustain: 0.72, release: 0.09 },
    gain: 0.95,
  },
  pick: {
    oscillators: [
      { type: "sawtooth", ratio: 1, gain: 0.4 },
      { type: "square", ratio: 1, detune: 4, gain: 0.16 },
      { type: "sine", ratio: 0.5, gain: 0.34 },
    ],
    filter: { openMult: 11, closeMult: 3.5, q: 6, minHz: 120 },
    amp: { attack: 0.004, decay: 0.1, sustain: 0.55, release: 0.07 },
    pitchEnv: { semitones: 0.25, time: 0.02 },
    gain: 0.9,
  },
  upright: {
    oscillators: [
      { type: "triangle", ratio: 1, gain: 0.66 },
      { type: "sine", ratio: 1, detune: -6, gain: 0.24 },
    ],
    filter: { openMult: 4.5, closeMult: 2, q: 2, minHz: 70 },
    amp: { attack: 0.006, decay: 0.22, sustain: 0.28, release: 0.16 },
    pitchEnv: { semitones: 0.4, time: 0.05 },
    gain: 1,
  },
  synth: {
    oscillators: [
      { type: "sine", ratio: 1, gain: 0.56 },
      { type: "square", ratio: 2, detune: 3, gain: 0.1 },
      { type: "sine", ratio: 0.5, gain: 0.28 },
    ],
    filter: { openMult: 5, closeMult: 4, q: 1, minHz: 80 },
    amp: { attack: 0.014, decay: 0.2, sustain: 0.85, release: 0.14 },
    gain: 0.9,
  },
  muted: {
    oscillators: [
      { type: "sine", ratio: 1, gain: 0.62 },
      { type: "triangle", ratio: 1, gain: 0.28 },
    ],
    filter: { openMult: 3.5, closeMult: 2, q: 2, minHz: 60 },
    amp: { attack: 0.005, decay: 0.09, sustain: 0.14, release: 0.06 },
    gain: 1,
  },
};

function voiceSpec(voice: BassVoiceId): BassVoiceSpec {
  return VOICES[voice] ?? VOICES[DEFAULT_BASS_VOICE];
}

// Overall bass level trim. Calibrated so a default-volume (90) note sits well
// under a kick hit rather than fighting it, leaving the mix headroom.
const OUTPUT_TRIM = 0.42;

/**
 * Schedules one bass note as a live synth voice. Returns the oscillator nodes
 * so a hard-stop caller (Stack Builder) can stop them individually.
 */
export function triggerBassNote(
  ctx: BaseAudioContext,
  dest: AudioNode,
  note: BassNote,
  time: number,
  beatSeconds: number,
  lineVolume: number,
  voice: BassVoiceId
): OscillatorNode[] {
  const spec = voiceSpec(voice);
  const freq = midiToFreq(note.midi);
  const holdSeconds = Math.max(0.06, note.duration * beatSeconds);
  const { attack, decay, sustain, release } = spec.amp;
  const endTime = time + holdSeconds + release;

  const peak =
    (lineVolume / 100) * hitVelocityMultiplier(note.accent) * spec.gain * OUTPUT_TRIM;

  // Lowpass, swept from open to closed over the decay.
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.Q.value = spec.filter.q;
  const openHz = Math.max(spec.filter.minHz, freq * spec.filter.openMult);
  const closeHz = Math.max(spec.filter.minHz, freq * spec.filter.closeMult);
  filter.frequency.setValueAtTime(openHz, time);
  filter.frequency.exponentialRampToValueAtTime(Math.max(1, closeHz), time + decay + 0.001);

  // Amp envelope.
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0, time);
  amp.gain.linearRampToValueAtTime(peak, time + attack);
  amp.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * sustain), time + attack + decay);
  amp.gain.setValueAtTime(Math.max(0.0001, peak * sustain), time + holdSeconds);
  amp.gain.exponentialRampToValueAtTime(0.0001, endTime);
  amp.gain.setValueAtTime(0, endTime + 0.005);

  filter.connect(amp).connect(dest);

  const oscs: OscillatorNode[] = [];
  for (const o of spec.oscillators) {
    const osc = ctx.createOscillator();
    osc.type = o.type;
    if (o.detune) osc.detune.value = o.detune;
    const base = freq * o.ratio;
    if (spec.pitchEnv) {
      osc.frequency.setValueAtTime(base * 2 ** (spec.pitchEnv.semitones / 12), time);
      osc.frequency.exponentialRampToValueAtTime(base, time + spec.pitchEnv.time);
    } else {
      osc.frequency.setValueAtTime(base, time);
    }
    const og = ctx.createGain();
    og.gain.value = o.gain;
    osc.connect(og).connect(filter);
    osc.start(time);
    osc.stop(endTime + 0.03);
    oscs.push(osc);
  }
  return oscs;
}
