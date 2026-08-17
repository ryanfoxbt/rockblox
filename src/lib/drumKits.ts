import { InstrumentId } from "./instruments";
import { SAMPLE_URL as ACOUSTIC_SAMPLE_URL } from "./drumSamples";

export const DRUM_KITS = ["Acoustic", "TR-808", "Casio-RZ1", "LM-2", "MFB-512", "Roland CR-8000", "Fart"] as const;
export type DrumKit = (typeof DRUM_KITS)[number];
export const DEFAULT_KIT: DrumKit = "MFB-512";

// "Fart" isn't sample-backed at all — it's synthesized in audioEngine.ts —
// so it's excluded from the sample-based machine kits below.
type MachineKit = Exclude<DrumKit, "Acoustic" | "Fart">;

const DRUM_MACHINE_BASE_URL: Record<MachineKit, string> = {
  "TR-808": "https://smpldsnds.github.io/drum-machines/TR-808",
  "Casio-RZ1": "https://smpldsnds.github.io/drum-machines/Casio-RZ1",
  "LM-2": "https://smpldsnds.github.io/drum-machines/LM-2",
  "MFB-512": "https://smpldsnds.github.io/drum-machines/MFB-512",
  "Roland CR-8000": "https://smpldsnds.github.io/drum-machines/Roland-CR-8000",
};

// Each drum-machine sample set names/organizes its samples differently, and a
// few kits don't have every voice we model (most vintage drum machines have
// only one cymbal, not a separate crash/ride) — those fall back to the
// closest real sample in that kit rather than staying silent.
const DRUM_MACHINE_SAMPLE_PATH: Record<MachineKit, Record<InstrumentId, string>> = {
  "TR-808": {
    kick: "kick/bd0000",
    snare: "snare/sd0000",
    hihatClosed: "hihat-close/ch",
    hihatOpen: "hihat-open/oh00",
    crash: "cymbal/cy0000",
    ride: "cymbal/cy0000",
    lowTom: "tom-low/lt00",
    midTom: "mid-tom/mt00",
    highTom: "tom-hi/ht00",
    rimshot: "rimshot/rs",
  },
  "Casio-RZ1": {
    kick: "kick",
    snare: "snare",
    hihatClosed: "hihat-closed",
    hihatOpen: "hihat-open",
    crash: "crash",
    ride: "ride",
    lowTom: "tom-3",
    midTom: "tom-2",
    highTom: "tom-1",
    rimshot: "clave",
  },
  "LM-2": {
    kick: "kick",
    snare: "snare-m",
    hihatClosed: "hhclosed",
    hihatOpen: "hhopen",
    crash: "crash",
    ride: "ride",
    lowTom: "tom-l",
    midTom: "tom-m",
    highTom: "tom-h",
    rimshot: "stick-m",
  },
  "MFB-512": {
    kick: "kick",
    snare: "snare",
    hihatClosed: "hihat-closed",
    hihatOpen: "hihat-open",
    crash: "cymbal",
    ride: "cymbal",
    lowTom: "tom-low",
    midTom: "tom-mid",
    highTom: "tom-hi",
    rimshot: "clap",
  },
  "Roland CR-8000": {
    kick: "kick",
    snare: "snare",
    hihatClosed: "hihat-closed",
    hihatOpen: "hihat-open",
    crash: "cymball", // typo in the upstream sample manifest, not ours
    ride: "cymball",
    lowTom: "tom-low",
    midTom: "tom-low",
    highTom: "tom-high",
    rimshot: "rimshot",
  },
};

function isMachineKit(kit: string): kit is MachineKit {
  return kit in DRUM_MACHINE_BASE_URL;
}

/** Absolute sample URL per instrument for the given kit. */
export function sampleUrlsForKit(kit: string): Record<InstrumentId, string> {
  if (!isMachineKit(kit)) return ACOUSTIC_SAMPLE_URL;
  const base = DRUM_MACHINE_BASE_URL[kit];
  const paths = DRUM_MACHINE_SAMPLE_PATH[kit];
  const result = {} as Record<InstrumentId, string>;
  for (const [instrument, path] of Object.entries(paths) as [InstrumentId, string][]) {
    result[instrument] = `${base}/${path}.ogg`;
  }
  return result;
}
