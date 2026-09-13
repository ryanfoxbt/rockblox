import { INSTRUMENTS, InstrumentId } from "./instruments";

// The "Cats" kit has no sample files — like fartKit.ts, each hit is
// synthesized on the fly, so it works offline and needs no third-party
// sample host. Every voice is built from the same small model: a sawtooth
// (for a meow's vocal "buzz") blended with noise (breath/hiss), driven
// through two resonant peaks standing in for a vowel's formants — the same
// trick real formant synthesizers use to turn a buzzy source into something
// that reads as a voice instead of a tone. `toneAmount` controls that
// blend, so the same machinery covers a pitched "meow" (mostly sawtooth) and
// a noise-only "hiss" (mostly noise, still shaped by the resonators — that's
// what makes filtered noise read as "sss" instead of static).
interface CatParams {
  duration: number; // seconds
  // 3-point pitch contour: rises from startFreq to peakFreq over the first
  // `riseFraction` of the hit, then falls to endFreq — the characteristic
  // "mee-ow" shape. Ignored where toneAmount is ~0 (noise-only voices).
  startFreq: number;
  peakFreq: number;
  endFreq: number;
  riseFraction: number; // 0-1
  toneAmount: number; // 0 = pure noise, 1 = pure buzz
  formant1: number; // Hz, first resonant peak
  formant2: number; // Hz, second resonant peak
  resonance: number; // 0-1, formant sharpness (higher = narrower/whistlier)
  vibratoRate: number; // Hz, 0 = none
  vibratoDepth: number; // fraction of freq
  tremoloRate: number; // Hz, 0 = none — a purr's ~25-30Hz amplitude buzz
  tremoloDepth: number; // 0-1
  brightness: number; // one-pole lowpass coefficient, final tone shaping
  attack: number; // seconds
  releaseFraction: number; // fraction of duration spent releasing
  gain: number; // overall level trim
}

const CAT_PARAMS: Record<InstrumentId, CatParams> = {
  // Deep "yowl" — the kick's low-end thump reimagined as a chest-voice meow.
  kick: {
    duration: 0.5,
    startFreq: 220,
    peakFreq: 380,
    endFreq: 180,
    riseFraction: 0.25,
    toneAmount: 0.8,
    formant1: 500,
    formant2: 1400,
    resonance: 0.97,
    vibratoRate: 6,
    vibratoDepth: 0.04,
    tremoloRate: 0,
    tremoloDepth: 0,
    brightness: 0.5,
    attack: 0.02,
    releaseFraction: 0.5,
    gain: 0.95,
  },
  // A sharp hiss — noise shaped by high, wide-open formants rather than a
  // vowel, so it reads as "sss" instead of a pitch.
  snare: {
    duration: 0.22,
    startFreq: 260,
    peakFreq: 260,
    endFreq: 260,
    riseFraction: 0.5,
    toneAmount: 0.03,
    formant1: 3200,
    formant2: 6500,
    resonance: 0.9,
    vibratoRate: 0,
    vibratoDepth: 0,
    tremoloRate: 0,
    tremoloDepth: 0,
    brightness: 0.8,
    attack: 0.003,
    releaseFraction: 0.7,
    gain: 0.85,
  },
  // A quick upward "chirrup" — the bird-like trill cats make, standing in
  // for the hi-hat's tick.
  hihatClosed: {
    duration: 0.09,
    startFreq: 500,
    peakFreq: 900,
    endFreq: 700,
    riseFraction: 0.4,
    toneAmount: 0.7,
    formant1: 900,
    formant2: 2600,
    resonance: 0.96,
    vibratoRate: 0,
    vibratoDepth: 0,
    tremoloRate: 0,
    tremoloDepth: 0,
    brightness: 0.6,
    attack: 0.004,
    releaseFraction: 0.6,
    gain: 0.75,
  },
  // A longer "mew" for the open hat's held sizzle.
  hihatOpen: {
    duration: 0.3,
    startFreq: 450,
    peakFreq: 750,
    endFreq: 400,
    riseFraction: 0.3,
    toneAmount: 0.65,
    formant1: 800,
    formant2: 2400,
    resonance: 0.96,
    vibratoRate: 7,
    vibratoDepth: 0.05,
    tremoloRate: 0,
    tremoloDepth: 0,
    brightness: 0.55,
    attack: 0.006,
    releaseFraction: 0.6,
    gain: 0.75,
  },
  // A harsh fight-yowl/screech for the crash's big, noisy hit.
  crash: {
    duration: 0.8,
    startFreq: 300,
    peakFreq: 900,
    endFreq: 500,
    riseFraction: 0.2,
    toneAmount: 0.55,
    formant1: 700,
    formant2: 2800,
    resonance: 0.965,
    vibratoRate: 9,
    vibratoDepth: 0.08,
    tremoloRate: 0,
    tremoloDepth: 0,
    brightness: 0.6,
    attack: 0.01,
    releaseFraction: 0.7,
    gain: 0.9,
  },
  // A sustained purr — low buzz plus the ~27Hz amplitude modulation that's
  // a purr's actual acoustic signature, in place of the ride's wash.
  ride: {
    duration: 0.5,
    startFreq: 130,
    peakFreq: 150,
    endFreq: 130,
    riseFraction: 0.5,
    toneAmount: 0.35,
    formant1: 250,
    formant2: 900,
    resonance: 0.9,
    vibratoRate: 0,
    vibratoDepth: 0,
    tremoloRate: 27,
    tremoloDepth: 0.5,
    brightness: 0.35,
    attack: 0.02,
    releaseFraction: 0.4,
    gain: 0.75,
  },
  lowTom: {
    duration: 0.35,
    startFreq: 260,
    peakFreq: 420,
    endFreq: 220,
    riseFraction: 0.3,
    toneAmount: 0.75,
    formant1: 550,
    formant2: 1500,
    resonance: 0.97,
    vibratoRate: 6,
    vibratoDepth: 0.04,
    tremoloRate: 0,
    tremoloDepth: 0,
    brightness: 0.5,
    attack: 0.015,
    releaseFraction: 0.55,
    gain: 0.88,
  },
  midTom: {
    duration: 0.3,
    startFreq: 340,
    peakFreq: 550,
    endFreq: 300,
    riseFraction: 0.3,
    toneAmount: 0.75,
    formant1: 650,
    formant2: 1800,
    resonance: 0.97,
    vibratoRate: 6.5,
    vibratoDepth: 0.045,
    tremoloRate: 0,
    tremoloDepth: 0,
    brightness: 0.52,
    attack: 0.012,
    releaseFraction: 0.55,
    gain: 0.85,
  },
  // A higher kitten-ish "mew" for the highest tom.
  highTom: {
    duration: 0.25,
    startFreq: 450,
    peakFreq: 700,
    endFreq: 400,
    riseFraction: 0.3,
    toneAmount: 0.75,
    formant1: 800,
    formant2: 2200,
    resonance: 0.97,
    vibratoRate: 7,
    vibratoDepth: 0.05,
    tremoloRate: 0,
    tremoloDepth: 0,
    brightness: 0.55,
    attack: 0.01,
    releaseFraction: 0.55,
    gain: 0.8,
  },
  // A dry claw-tap click for the rimshot — almost all noise, gone in a blink.
  rimshot: {
    duration: 0.09,
    startFreq: 1200,
    peakFreq: 1200,
    endFreq: 1200,
    riseFraction: 0.5,
    toneAmount: 0.15,
    formant1: 1800,
    formant2: 4200,
    resonance: 0.9,
    vibratoRate: 0,
    vibratoDepth: 0,
    tremoloRate: 0,
    tremoloDepth: 0,
    brightness: 0.85,
    attack: 0.001,
    releaseFraction: 0.8,
    gain: 0.7,
  },
};

function synthesizeCat(ctx: BaseAudioContext, params: CatParams): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.max(1, Math.floor(params.duration * sampleRate));
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  // Two 2-pole resonators (the "formants") run in parallel over the same
  // source and get summed — a standard, cheap way to turn a buzzy/noisy
  // source into something with a vowel-like color.
  const r = params.resonance;
  const w1 = (2 * Math.PI * params.formant1) / sampleRate;
  const w2 = (2 * Math.PI * params.formant2) / sampleRate;
  const c1a = 2 * r * Math.cos(w1);
  const c1b = -r * r;
  const c2a = 2 * r * Math.cos(w2);
  const c2b = -r * r;
  const formantGain = 1 - r; // rough normalization so resonance doesn't blow up the level

  let phase = 0;
  let f1x1 = 0;
  let f1x2 = 0;
  let f2x1 = 0;
  let f2x2 = 0;
  let filtered = 0;

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const progress = t / params.duration;

    let freq: number;
    if (progress < params.riseFraction) {
      const p = params.riseFraction > 0 ? progress / params.riseFraction : 1;
      freq = params.startFreq + (params.peakFreq - params.startFreq) * p;
    } else {
      const span = 1 - params.riseFraction;
      const p = span > 0 ? (progress - params.riseFraction) / span : 1;
      freq = params.peakFreq + (params.endFreq - params.peakFreq) * p;
    }
    if (params.vibratoRate > 0) freq *= 1 + Math.sin(2 * Math.PI * params.vibratoRate * t) * params.vibratoDepth;

    phase += freq / sampleRate;
    phase -= Math.floor(phase);
    const saw = 2 * (phase - Math.floor(phase + 0.5));
    const noise = Math.random() * 2 - 1;
    const source = saw * params.toneAmount + noise * (1 - params.toneAmount);

    const f1out = formantGain * source + c1a * f1x1 + c1b * f1x2;
    f1x2 = f1x1;
    f1x1 = f1out;
    const f2out = formantGain * source + c2a * f2x1 + c2b * f2x2;
    f2x2 = f2x1;
    f2x1 = f2out;

    const voiced = (f1out + f2out) * 0.5;
    filtered += (voiced - filtered) * params.brightness;

    let amp = filtered;
    if (params.tremoloRate > 0) {
      amp *= 1 - params.tremoloDepth * (0.5 + 0.5 * Math.sin(2 * Math.PI * params.tremoloRate * t));
    }

    const attack = Math.min(1, t / params.attack);
    const releaseStart = params.duration * (1 - params.releaseFraction);
    const release =
      t < releaseStart || params.releaseFraction <= 0
        ? 1
        : Math.max(0, (params.duration - t) / (params.duration * params.releaseFraction));
    const envelope = Math.min(attack, release);

    data[i] = amp * envelope * params.gain;
  }

  return buffer;
}

export function synthesizeCatBuffers(ctx: BaseAudioContext): Map<InstrumentId, AudioBuffer> {
  const map = new Map<InstrumentId, AudioBuffer>();
  for (const { id } of INSTRUMENTS) {
    map.set(id, synthesizeCat(ctx, CAT_PARAMS[id]));
  }
  return map;
}

// Real recordings, one per instrument slot, dropped into public/cat-kit/ —
// e.g. public/cat-kit/kick.mp3 — take over from the synthesized default for
// that slot, the same override convention as fartKit.ts. Nothing to wire up:
// any slot without a file just keeps using its synthesized sound.
const CAT_SAMPLE_BASE_URL = "/cat-kit";

async function loadCatSample(ctx: BaseAudioContext, id: InstrumentId): Promise<AudioBuffer | null> {
  try {
    const res = await fetch(`${CAT_SAMPLE_BASE_URL}/${id}.mp3`);
    if (!res.ok) return null;
    return await ctx.decodeAudioData(await res.arrayBuffer());
  } catch {
    return null;
  }
}

export async function loadCatBuffers(ctx: BaseAudioContext): Promise<Map<InstrumentId, AudioBuffer>> {
  const map = synthesizeCatBuffers(ctx);
  const overrides = await Promise.all(INSTRUMENTS.map(({ id }) => loadCatSample(ctx, id).then((buf) => [id, buf] as const)));
  for (const [id, buf] of overrides) {
    if (buf) map.set(id, buf);
  }
  return map;
}
