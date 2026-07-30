import { InstrumentId } from "./instruments";
import { LineState } from "./audioEngine";
import { NOTE_FRACTION } from "./rhythm";

// General MIDI percussion key map (channel 10).
const GM_DRUM_NOTE: Record<InstrumentId, number> = {
  kick: 36,
  snare: 38,
  hihatClosed: 42,
  hihatOpen: 46,
  crash: 49,
  ride: 51,
  lowTom: 45,
  midTom: 47,
  highTom: 50,
  rimshot: 37,
};

const PPQ = 480; // ticks per quarter note
const NOTE_VELOCITY = 100;
const NOTE_GATE_TICKS = 20; // short one-shot gate, drum hits don't sustain

function encodeVarLen(value: number): number[] {
  const bytes: number[] = [value & 0x7f];
  value >>>= 7;
  while (value > 0) {
    bytes.unshift((value & 0x7f) | 0x80);
    value >>>= 7;
  }
  return bytes;
}

interface NoteEvent {
  tick: number;
  isOn: boolean;
  note: number;
  velocity: number;
}

export function encodeSongToMidi(lines: LineState[], bpm: number, measureBeats: number): Blob {
  const noteEvents: NoteEvent[] = [];

  for (const line of lines) {
    const note = GM_DRUM_NOTE[line.instrument];
    const velocity = Math.max(1, Math.min(127, Math.round(NOTE_VELOCITY * (line.volume / 100))));
    for (let beatIndex = 0; beatIndex < measureBeats; beatIndex++) {
      const tile = line.blocks[beatIndex];
      if (!tile) continue;
      let beatOffset = 0;
      for (const h of tile.hits) {
        if (h.type === "note") {
          const onTick = Math.round((beatIndex + beatOffset) * PPQ);
          noteEvents.push({ tick: onTick, isOn: true, note, velocity });
          noteEvents.push({ tick: onTick + NOTE_GATE_TICKS, isOn: false, note, velocity: 0 });
        }
        beatOffset += NOTE_FRACTION[h.note];
      }
    }
  }

  // Note-offs before note-ons at the same tick, so overlapping hits don't cut each other short.
  noteEvents.sort((a, b) => a.tick - b.tick || Number(a.isOn) - Number(b.isOn));

  const trackChunks: number[][] = [];
  let lastTick = 0;
  const pushEvent = (tick: number, bytes: number[]) => {
    trackChunks.push([...encodeVarLen(tick - lastTick), ...bytes]);
    lastTick = tick;
  };

  const microsPerQuarter = Math.round(60000000 / bpm);
  pushEvent(0, [
    0xff,
    0x51,
    0x03,
    (microsPerQuarter >> 16) & 0xff,
    (microsPerQuarter >> 8) & 0xff,
    microsPerQuarter & 0xff,
  ]);
  pushEvent(0, [0xff, 0x58, 0x04, measureBeats, 2, 24, 8]); // time signature, denominator 2^2 = 4

  const DRUM_CHANNEL = 9; // MIDI channel 10
  for (const ev of noteEvents) {
    const status = (ev.isOn ? 0x90 : 0x80) | DRUM_CHANNEL;
    pushEvent(ev.tick, [status, ev.note, ev.velocity]);
  }

  pushEvent(Math.max(lastTick, measureBeats * PPQ), [0xff, 0x2f, 0x00]);

  const trackData = trackChunks.flat();
  const header = [
    0x4d, 0x54, 0x68, 0x64, // "MThd"
    0x00, 0x00, 0x00, 0x06,
    0x00, 0x00, // format 0
    0x00, 0x01, // 1 track
    (PPQ >> 8) & 0xff, PPQ & 0xff,
  ];
  const trackHeader = [
    0x4d, 0x54, 0x72, 0x6b, // "MTrk"
    (trackData.length >>> 24) & 0xff,
    (trackData.length >>> 16) & 0xff,
    (trackData.length >>> 8) & 0xff,
    trackData.length & 0xff,
  ];

  return new Blob([new Uint8Array([...header, ...trackHeader, ...trackData])], { type: "audio/midi" });
}
