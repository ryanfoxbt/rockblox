import { InstrumentId } from "./instruments";

// Real acoustic drum hits from the Versilian Community Sample Library (VCSL,
// CC0), self-hosted in public/samples/drums so playback never depends on a
// third-party server being reachable at runtime. See CREDITS.md there for
// the exact source sample per instrument.
export const SAMPLE_URL: Record<InstrumentId, string> = {
  kick: "/samples/drums/kick.ogg",
  snare: "/samples/drums/snare.ogg",
  rimshot: "/samples/drums/rimshot.ogg",
  hihatClosed: "/samples/drums/hihat-closed.ogg",
  hihatOpen: "/samples/drums/hihat-open.ogg",
  crash: "/samples/drums/crash.ogg",
  ride: "/samples/drums/ride.ogg",
  lowTom: "/samples/drums/low-tom.ogg",
  midTom: "/samples/drums/mid-tom.ogg",
  highTom: "/samples/drums/high-tom.ogg",
};
