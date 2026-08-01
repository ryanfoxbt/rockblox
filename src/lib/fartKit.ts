import { INSTRUMENTS, InstrumentId } from "./instruments";

// The "Fart" kit has no sample files — each hit is synthesized on the fly as
// a buzzy, pitch-drooping tone (the classic "raspberry" waveform) so the kit
// works offline and needs no third-party sample host.
interface FartParams {
  duration: number; // seconds
  startFreq: number; // Hz, pitch at the start of the hit
  endFreq: number; // Hz, pitch it droops to by the end
  noiseAmount: number; // 0-1, how much breathy noise is mixed into the buzz
  brightness: number; // 0-1, one-pole lowpass coefficient — higher is buzzier/brighter
}

const FART_PARAMS: Record<InstrumentId, FartParams> = {
  kick: { duration: 0.55, startFreq: 90, endFreq: 45, noiseAmount: 0.15, brightness: 0.35 },
  snare: { duration: 0.22, startFreq: 220, endFreq: 150, noiseAmount: 0.35, brightness: 0.5 },
  hihatClosed: { duration: 0.08, startFreq: 500, endFreq: 420, noiseAmount: 0.55, brightness: 0.7 },
  hihatOpen: { duration: 0.3, startFreq: 480, endFreq: 300, noiseAmount: 0.5, brightness: 0.6 },
  crash: { duration: 0.8, startFreq: 350, endFreq: 120, noiseAmount: 0.6, brightness: 0.55 },
  ride: { duration: 0.5, startFreq: 300, endFreq: 180, noiseAmount: 0.45, brightness: 0.5 },
  lowTom: { duration: 0.4, startFreq: 130, endFreq: 70, noiseAmount: 0.2, brightness: 0.4 },
  midTom: { duration: 0.35, startFreq: 170, endFreq: 95, noiseAmount: 0.2, brightness: 0.45 },
  highTom: { duration: 0.3, startFreq: 220, endFreq: 130, noiseAmount: 0.2, brightness: 0.5 },
  rimshot: { duration: 0.12, startFreq: 260, endFreq: 200, noiseAmount: 0.3, brightness: 0.6 },
};

function synthesizeFart(ctx: BaseAudioContext, params: FartParams): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.max(1, Math.floor(params.duration * sampleRate));
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  let phase = 0;
  let filtered = 0;
  let noiseFiltered = 0;
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const progress = t / params.duration;

    // A slow wobble on top of the pitch droop gives it that "buzzing lips" character.
    const wobble = Math.sin(2 * Math.PI * 35 * t) * 0.06;
    const freq = params.startFreq + (params.endFreq - params.startFreq) * progress + params.startFreq * wobble;
    phase += freq / sampleRate;
    phase -= Math.floor(phase);
    const saw = 2 * (phase - Math.floor(phase + 0.5)); // sawtooth: richer/buzzier than a sine

    const attack = Math.min(1, t / 0.008);
    const release = Math.min(1, (params.duration - t) / (params.duration * 0.35));
    const envelope = Math.max(0, Math.min(attack, release));

    const noise = Math.random() * 2 - 1;
    noiseFiltered = noiseFiltered * 0.9 + noise * 0.1;

    const raw = saw * (1 - params.noiseAmount) + noiseFiltered * params.noiseAmount;
    filtered += (raw - filtered) * params.brightness;

    data[i] = filtered * envelope * 0.9;
  }

  return buffer;
}

export function synthesizeFartBuffers(ctx: BaseAudioContext): Map<InstrumentId, AudioBuffer> {
  const map = new Map<InstrumentId, AudioBuffer>();
  for (const { id } of INSTRUMENTS) {
    map.set(id, synthesizeFart(ctx, FART_PARAMS[id]));
  }
  return map;
}
