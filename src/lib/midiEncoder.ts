import { InstrumentId } from "./instruments";
import { LineState } from "./audioEngine";
import { hitVelocityMultiplier, NOTE_FRACTION } from "./rhythm";
import {
  type Bassline,
  type BassVoiceId,
  type ExportPart,
  basslineHasNotes,
  basslineVoice,
} from "./bassline";

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

const DRUM_CHANNEL = 9; // MIDI channel 10
const BASS_CHANNEL = 0; // MIDI channel 1

// GM bass program (0-indexed) closest to each synthesized voice, so the
// exported MIDI opens with a matching sound in a DAW.
const BASS_VOICE_PROGRAM: Record<BassVoiceId, number> = {
  electric: 33, // Electric Bass (finger)
  pick: 34, // Electric Bass (pick)
  upright: 32, // Acoustic Bass
  synth: 38, // Synth Bass 1
  muted: 39, // Synth Bass 2
};

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

// Appends one line-set's drum note events at a given beat offset — shared by
// the single-slot encoder below and the Stack Builder encoder, which
// concatenates several slots' worth of lines back to back at one shared tempo.
function pushLineNoteEvents(noteEvents: NoteEvent[], lines: LineState[], measureBeats: number, beatOffsetStart: number) {
  for (const line of lines) {
    const note = GM_DRUM_NOTE[line.instrument];
    const velocity = Math.max(1, Math.min(127, Math.round(NOTE_VELOCITY * (line.volume / 100))));
    for (let beatIndex = 0; beatIndex < measureBeats; beatIndex++) {
      const tile = line.blocks[beatIndex];
      if (!tile) continue;
      let beatOffset = 0;
      for (const h of tile.hits) {
        if (h.type === "note") {
          const onTick = Math.round((beatOffsetStart + beatIndex + beatOffset) * PPQ);
          noteEvents.push({ tick: onTick, isOn: true, note, velocity });
          noteEvents.push({ tick: onTick + NOTE_GATE_TICKS, isOn: false, note, velocity: 0 });
        }
        beatOffset += NOTE_FRACTION[h.note];
      }
    }
  }
}

// Bassline notes are pitched and actually sustain, so unlike drum hits they
// carry a real gate length derived from each note's duration.
function pushBassNoteEvents(
  noteEvents: NoteEvent[],
  bassline: Bassline,
  measureBeats: number,
  beatOffsetStart: number
) {
  const volume = bassline.settings.volume;
  for (const n of bassline.notes) {
    const start = n.beat + n.offset;
    if (start >= measureBeats) continue;
    const duration = Math.min(n.duration, measureBeats - start);
    const onTick = Math.round((beatOffsetStart + start) * PPQ);
    const gate = Math.max(24, Math.round(duration * PPQ) - 4);
    const velocity = Math.max(
      1,
      Math.min(127, Math.round(NOTE_VELOCITY * (volume / 100) * hitVelocityMultiplier(n.accent)))
    );
    noteEvents.push({ tick: onTick, isOn: true, note: n.midi, velocity });
    noteEvents.push({ tick: onTick + gate, isOn: false, note: n.midi, velocity: 0 });
  }
}

interface MidiTrack {
  name: string;
  channel: number;
  events: NoteEvent[];
  // Only the first track in a multi-track file carries the tempo/time-signature
  // meta events (the conventional "conductor" role).
  includeTempo: boolean;
  timeSigNumerator: number;
  // GM program change to emit at tick 0, if any (drums need none — channel 10
  // is always percussion).
  program?: number;
}

function encodeTrackChunk(track: MidiTrack, bpm: number, totalTicks: number): number[] {
  // Note-offs before note-ons at the same tick, so repeated notes don't cut
  // each other short.
  const events = [...track.events].sort((a, b) => a.tick - b.tick || Number(a.isOn) - Number(b.isOn));

  const chunks: number[][] = [];
  let lastTick = 0;
  const pushEvent = (tick: number, bytes: number[]) => {
    chunks.push([...encodeVarLen(tick - lastTick), ...bytes]);
    lastTick = tick;
  };

  pushEvent(0, [0xff, 0x03, track.name.length, ...Array.from(track.name, (c) => c.charCodeAt(0) & 0x7f)]);

  if (track.includeTempo) {
    const microsPerQuarter = Math.round(60000000 / bpm);
    pushEvent(0, [
      0xff,
      0x51,
      0x03,
      (microsPerQuarter >> 16) & 0xff,
      (microsPerQuarter >> 8) & 0xff,
      microsPerQuarter & 0xff,
    ]);
    pushEvent(0, [0xff, 0x58, 0x04, track.timeSigNumerator, 2, 24, 8]); // denominator 2^2 = 4
  }

  if (track.program !== undefined) {
    pushEvent(0, [0xc0 | track.channel, track.program]);
  }

  for (const ev of events) {
    const status = (ev.isOn ? 0x90 : 0x80) | track.channel;
    pushEvent(ev.tick, [status, ev.note, ev.velocity]);
  }

  pushEvent(Math.max(lastTick, totalTicks), [0xff, 0x2f, 0x00]);

  const trackData = chunks.flat();
  return [
    0x4d, 0x54, 0x72, 0x6b, // "MTrk"
    (trackData.length >>> 24) & 0xff,
    (trackData.length >>> 16) & 0xff,
    (trackData.length >>> 8) & 0xff,
    trackData.length & 0xff,
    ...trackData,
  ];
}

function encodeTracksToMidi(tracks: MidiTrack[], bpm: number, totalBeats: number): Blob {
  const totalTicks = Math.round(totalBeats * PPQ);
  const format = tracks.length > 1 ? 1 : 0;
  const header = [
    0x4d, 0x54, 0x68, 0x64, // "MThd"
    0x00, 0x00, 0x00, 0x06,
    0x00, format,
    (tracks.length >> 8) & 0xff, tracks.length & 0xff,
    (PPQ >> 8) & 0xff, PPQ & 0xff,
  ];
  const body = tracks.flatMap((t) => encodeTrackChunk(t, bpm, totalTicks));
  return new Blob([new Uint8Array([...header, ...body])], { type: "audio/midi" });
}

// Builds the drum and/or bass tracks for `part`. The first track returned
// carries the tempo, so drums-only and bass-only each come back as a single
// self-contained track (format 0), while "full" returns two (format 1) that a
// DAW imports as separate, independently mutable parts.
function tracksFor(
  part: ExportPart,
  timeSigNumerator: number,
  drumEvents: NoteEvent[],
  bassEvents: NoteEvent[],
  hasBass: boolean,
  bassProgram: number
): MidiTrack[] {
  const drumTrack: MidiTrack = {
    name: "Drums",
    channel: DRUM_CHANNEL,
    events: drumEvents,
    includeTempo: true,
    timeSigNumerator,
  };
  const bassTrack: MidiTrack = {
    name: "Bass",
    channel: BASS_CHANNEL,
    events: bassEvents,
    includeTempo: true,
    timeSigNumerator,
    program: bassProgram,
  };

  if (part === "drums" || !hasBass) return [drumTrack];
  if (part === "bass") return [bassTrack];
  // "full": drums first (owns the tempo), bass second.
  bassTrack.includeTempo = false;
  return [drumTrack, bassTrack];
}

export function encodeSongToMidi(
  lines: LineState[],
  bpm: number,
  measureBeats: number,
  bassline?: Bassline | null,
  part: ExportPart = "full"
): Blob {
  const drumEvents: NoteEvent[] = [];
  const bassEvents: NoteEvent[] = [];
  const hasBass = basslineHasNotes(bassline);
  if (part !== "bass") pushLineNoteEvents(drumEvents, lines, measureBeats, 0);
  if (part !== "drums" && hasBass) pushBassNoteEvents(bassEvents, bassline, measureBeats, 0);

  const bassProgram = BASS_VOICE_PROGRAM[basslineVoice(bassline?.settings)];
  const tracks = tracksFor(part, measureBeats, drumEvents, bassEvents, hasBass, bassProgram);
  return encodeTracksToMidi(tracks, bpm, measureBeats);
}

export interface StackMidiStep {
  lines: LineState[];
  measureLength: number;
  bassline?: Bassline | null;
}

/** Concatenates each step's lines back to back at one shared tempo, mirroring how StackPlayer schedules playback. */
export function encodeStackToMidi(steps: StackMidiStep[], bpm: number, part: ExportPart = "full"): Blob {
  const drumEvents: NoteEvent[] = [];
  const bassEvents: NoteEvent[] = [];
  const hasBass = steps.some((s) => basslineHasNotes(s.bassline));

  let beatOffset = 0;
  for (const step of steps) {
    if (part !== "bass") pushLineNoteEvents(drumEvents, step.lines, step.measureLength, beatOffset);
    if (part !== "drums" && basslineHasNotes(step.bassline)) {
      pushBassNoteEvents(bassEvents, step.bassline, step.measureLength, beatOffset);
    }
    beatOffset += step.measureLength;
  }

  const firstMeasureBeats = steps[0]?.measureLength ?? 4;
  const bassProgram =
    BASS_VOICE_PROGRAM[basslineVoice(steps.find((s) => basslineHasNotes(s.bassline))?.bassline?.settings)];
  const tracks = tracksFor(part, firstMeasureBeats, drumEvents, bassEvents, hasBass, bassProgram);
  return encodeTracksToMidi(tracks, bpm, beatOffset);
}
