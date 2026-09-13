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

// Standard MIDI note numbers are integers, so a quarter-tone bass note (see
// scales.ts) is exported as its nearest semitone plus a channel pitch bend —
// the only way to get a maqam's neutral 2nds/3rds/7ths into a plain MIDI
// file. The default GM pitch bend range (±2 semitones) covers our ±50-cent
// maqam offsets without needing an RPN sensitivity message.
//
// A raw MIDI player just holds whatever bend value it last received, so in
// principle "bend to target at note-on, reset to center at note-off" is
// enough. But a DAW that imports the file into an editable clip (Ableton
// included) turns those two points into a breakpoint envelope and *ramps*
// between them by default — which turns a steady quarter tone into a
// glissando across the whole note. `bend` events get a redundant point 1
// tick before each transition (see pushBassNoteEvents) so every ramp is
// effectively instantaneous and the note holds flat in between, regardless
// of how the importing DAW interpolates.
type TrackEvent =
  | { kind: "on"; tick: number; note: number; velocity: number }
  | { kind: "off"; tick: number; note: number }
  | { kind: "bend"; tick: number; cents: number };

const EVENT_ORDER: Record<TrackEvent["kind"], number> = { off: 0, bend: 1, on: 2 };

// 14-bit MIDI pitch bend value, centered at 8192, for a ±200-cent range.
function pitchBendBytes(cents: number, channel: number): number[] {
  const value = Math.max(0, Math.min(16383, Math.round(8192 + (cents / 200) * 8192)));
  return [0xe0 | channel, value & 0x7f, (value >> 7) & 0x7f];
}

// Nearest integer MIDI note plus how many cents short/long that is of the
// note's true (possibly quarter-tone) pitch.
function midiNoteAndBendCents(midi: number): { note: number; bendCents: number } {
  const note = Math.round(midi);
  return { note, bendCents: (midi - note) * 100 };
}

// Appends one line-set's drum note events at a given beat offset — shared by
// the single-slot encoder below and the Stack Builder encoder, which
// concatenates several slots' worth of lines back to back at one shared tempo.
function pushLineNoteEvents(noteEvents: TrackEvent[], lines: LineState[], measureBeats: number, beatOffsetStart: number) {
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
          noteEvents.push({ kind: "on", tick: onTick, note, velocity });
          noteEvents.push({ kind: "off", tick: onTick + NOTE_GATE_TICKS, note });
        }
        beatOffset += NOTE_FRACTION[h.note];
      }
    }
  }
}

// Bassline notes are pitched and actually sustain, so unlike drum hits they
// carry a real gate length derived from each note's duration.
function pushBassNoteEvents(
  noteEvents: TrackEvent[],
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
    const offTick = onTick + gate;
    const velocity = Math.max(
      1,
      Math.min(127, Math.round(NOTE_VELOCITY * (volume / 100) * hitVelocityMultiplier(n.accent)))
    );
    const { note, bendCents } = midiNoteAndBendCents(n.midi);
    if (bendCents) {
      // Prime the ramp into and out of the bend over a single tick, so a DAW
      // that linearly interpolates the two "real" bend points (see the
      // TrackEvent comment above) glides for a tick instead of the note's
      // whole duration.
      if (onTick > 0) noteEvents.push({ kind: "bend", tick: onTick - 1, cents: 0 });
      noteEvents.push({ kind: "bend", tick: onTick, cents: bendCents });
      noteEvents.push({ kind: "bend", tick: offTick - 1, cents: bendCents });
      noteEvents.push({ kind: "bend", tick: offTick, cents: 0 });
    }
    noteEvents.push({ kind: "on", tick: onTick, note, velocity });
    noteEvents.push({ kind: "off", tick: offTick, note });
  }
}

interface MidiTrack {
  name: string;
  channel: number;
  events: TrackEvent[];
  // Only the first track in a multi-track file carries the tempo/time-signature
  // meta events (the conventional "conductor" role).
  includeTempo: boolean;
  timeSigNumerator: number;
  // GM program change to emit at tick 0, if any (drums need none — channel 10
  // is always percussion).
  program?: number;
}

function encodeTrackChunk(track: MidiTrack, bpm: number, totalTicks: number): number[] {
  // Note-offs before note-ons at the same tick (so repeated notes don't cut
  // each other short), and any bend lands in between — before the note-on it
  // belongs to, after the note-off it's resetting past.
  const events = [...track.events].sort(
    (a, b) => a.tick - b.tick || EVENT_ORDER[a.kind] - EVENT_ORDER[b.kind]
  );

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
    if (ev.kind === "bend") {
      pushEvent(ev.tick, pitchBendBytes(ev.cents, track.channel));
    } else if (ev.kind === "on") {
      pushEvent(ev.tick, [0x90 | track.channel, ev.note, ev.velocity]);
    } else {
      pushEvent(ev.tick, [0x80 | track.channel, ev.note, 0]);
    }
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
  drumEvents: TrackEvent[],
  bassEvents: TrackEvent[],
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
  const drumEvents: TrackEvent[] = [];
  const bassEvents: TrackEvent[] = [];
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
  const drumEvents: TrackEvent[] = [];
  const bassEvents: TrackEvent[] = [];
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
