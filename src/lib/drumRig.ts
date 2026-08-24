import { InstrumentId } from "./instruments";
import { NotationLine } from "./notation";
import { HitAccent, NOTE_FRACTION } from "./rhythm";

// Which limb plays which drum piece, for the Drum Teacher view — a standard
// basic-groove convention (right hand keeps time on hi-hat/ride/toms/crash,
// left hand plays the backbeat, right foot works the kick), not a
// biomechanically exact transcription of any specific performance. Good
// enough to show a beginner "one correct way to play this."
export type Limb = "leftHand" | "rightHand" | "rightFoot";

const LIMB_FOR_INSTRUMENT: Record<InstrumentId, Limb> = {
  kick: "rightFoot",
  snare: "leftHand",
  rimshot: "leftHand",
  lowTom: "leftHand",
  hihatClosed: "rightHand",
  hihatOpen: "rightHand",
  ride: "rightHand",
  crash: "rightHand",
  highTom: "rightHand",
  midTom: "rightHand",
};

export function limbForInstrument(id: InstrumentId): Limb {
  return LIMB_FOR_INSTRUMENT[id];
}

export interface DrumHitEvent {
  // Absolute position within the measure, in beats (e.g. 2.5) — same units
  // as RockBloxPlayer.getPlayheadInfo()'s beat+fraction.
  beat: number;
  instrument: InstrumentId;
  limb: Limb;
  accent?: HitAccent;
}

// One measure's worth of hit events, sorted by time — the same timing math
// as audioEngine.ts's scheduleLoopEvents, but producing visual events (for
// the Drum Teacher view) instead of scheduling audio.
export function computeHitEvents(lines: NotationLine[], measureBeats: number): DrumHitEvent[] {
  const events: DrumHitEvent[] = [];
  for (let beatIndex = 0; beatIndex < measureBeats; beatIndex++) {
    for (const line of lines) {
      const tile = line.blocks[beatIndex];
      if (!tile) continue;
      let beatOffset = 0;
      for (const h of tile.hits) {
        if (h.type === "note") {
          events.push({
            beat: beatIndex + beatOffset,
            instrument: line.instrument,
            limb: limbForInstrument(line.instrument),
            accent: h.accent,
          });
        }
        beatOffset += NOTE_FRACTION[h.note];
      }
    }
  }
  events.sort((a, b) => a.beat - b.beat);
  return events;
}
