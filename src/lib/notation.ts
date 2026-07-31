import type * as VexflowModule from "vexflow";
import { InstrumentId } from "./instruments";
import { NoteName, NOTE_FRACTION } from "./rhythm";
import { LineData } from "./song";

type VF = typeof VexflowModule;

interface StaffPosition {
  key: string;
  // VexFlow inline notehead-glyph override, appended to the key as
  // "note/octave/CODE" — "X2" for an x-notehead (cymbals), "D2" for a
  // black diamond (rimshot). Omitted means the default round notehead.
  noteheadCode?: string;
  annotation?: string;
}

// Staff positions match the standard drum key (kick=F4 space, snare=C5 space,
// hi-hat=F5 top line, ride=G5 above the staff, crash=A5 ledger above, etc.)
const INSTRUMENT_POSITION: Record<InstrumentId, StaffPosition> = {
  kick: { key: "f/4" },
  lowTom: { key: "a/4" },
  midTom: { key: "d/5" },
  snare: { key: "c/5" },
  rimshot: { key: "c/5", noteheadCode: "D2" },
  highTom: { key: "e/5" },
  ride: { key: "g/5", noteheadCode: "X2" },
  hihatClosed: { key: "f/5", noteheadCode: "X2" },
  hihatOpen: { key: "f/5", noteheadCode: "X2", annotation: "o" },
  crash: { key: "a/5", noteheadCode: "X2" },
};

// Every instrument shares one upward stem, matching the reference drum key's
// own convention — and, as a bonus, sidesteps a VexFlow 5.0.0 beam-rendering
// bug where a downward-stem beam fails to connect its first note whenever
// that note has fewer beam lines than the notes following it.
const STEM_DIRECTION = 1; // VF.Stem.UP

// One beat is divided into 24 ticks so every duration in the tile catalog —
// including triplets — lands on a whole number of ticks: quarter=24,
// dottedEighth=18, eighth=12, eighthTriplet=8, sixteenth=6, sixteenthTriplet=4.
const TICKS_PER_BEAT = 24;

const NOTE_TICKS: Record<NoteName, number> = Object.fromEntries(
  Object.entries(NOTE_FRACTION).map(([note, fraction]) => [note, Math.round(fraction * TICKS_PER_BEAT)])
) as Record<NoteName, number>;

interface DurationInfo {
  code: string;
  dots: number;
  isTriplet: boolean;
}

const KNOWN_DURATIONS: [number, DurationInfo][] = [
  [24, { code: "q", dots: 0, isTriplet: false }],
  [18, { code: "8", dots: 1, isTriplet: false }],
  [12, { code: "8", dots: 0, isTriplet: false }],
  [8, { code: "8", dots: 0, isTriplet: true }],
  [6, { code: "16", dots: 0, isTriplet: false }],
  [4, { code: "16", dots: 0, isTriplet: true }],
];

function durationForTicks(ticks: number): DurationInfo {
  const exact = KNOWN_DURATIONS.find(([t]) => t === ticks);
  if (exact) return exact[1];
  // An irregular gap can only happen when a triplet subdivision on one line
  // collides with a straight subdivision on another within the same beat —
  // snap to the closest known duration rather than failing to render.
  const [, info] = KNOWN_DURATIONS.reduce((closest, entry) =>
    Math.abs(entry[0] - ticks) < Math.abs(closest[0] - ticks) ? entry : closest
  );
  return info;
}

export interface NotationLayout {
  beatBoundariesX: number[];
  staveTopY: number;
  staveBottomY: number;
}

const STAVE_MARGIN_X = 10;
const STAVE_Y = 110;
const CANVAS_HEIGHT = 280;

// A slot within a beat: either a chord of simultaneous instrument hits, or a
// rest covering a stretch where nothing on the kit sounds.
interface Segment {
  ticks: number;
  instruments: InstrumentId[] | null;
}

export function renderNotation(
  VF: VF,
  container: HTMLDivElement,
  lines: LineData[],
  measureLength: number,
  width: number
): NotationLayout {
  container.innerHTML = "";

  const renderer = new VF.Renderer(container, VF.Renderer.Backends.SVG);
  renderer.resize(width, CANVAS_HEIGHT);
  const context = renderer.getContext();

  const staveWidth = Math.max(width - STAVE_MARGIN_X * 2, 200);
  const stave = new VF.Stave(STAVE_MARGIN_X, STAVE_Y, staveWidth);
  stave.addClef("percussion");
  stave.addTimeSignature(`${measureLength}/4`);
  stave.setContext(context).draw();

  // Real drum notation puts every instrument on one shared staff voice, with
  // simultaneous hits drawn as one chorded notehead group under a single
  // stem/beam — not one independent voice per instrument. That's the piece
  // this file got wrong before: N separate voices meant N separate beams
  // stacked on top of each other, and per-voice formatting that never
  // actually aligned same-beat hits.
  const voice = new VF.Voice({ numBeats: measureLength, beatValue: 4 });
  voice.setStrict(false);

  const notes: InstanceType<VF["StemmableNote"]>[] = [];
  const beams: InstanceType<VF["Beam"]>[] = [];
  const tuplets: InstanceType<VF["Tuplet"]>[] = [];
  const beatStartNotes: (InstanceType<VF["StemmableNote"]> | undefined)[] = new Array(
    measureLength
  ).fill(undefined);

  for (let beat = 0; beat < measureLength; beat++) {
    // Collect every note onset in this beat, across all instrument lines,
    // keyed by its tick offset — so hits that land on the same tick become
    // one chord instead of independently-positioned noteheads.
    const onsetsByTick = new Map<number, InstrumentId[]>();
    let anyTilePlaced = false;
    let anyRealNote = false;

    for (const line of lines) {
      const tile = line.blocks[beat];
      if (!tile) continue;
      anyTilePlaced = true;

      let cursor = 0;
      for (const hit of tile.hits) {
        const ticks = NOTE_TICKS[hit.note];
        if (hit.type === "note") {
          anyRealNote = true;
          const existing = onsetsByTick.get(cursor);
          if (existing) {
            if (!existing.includes(line.instrument)) existing.push(line.instrument);
          } else {
            onsetsByTick.set(cursor, [line.instrument]);
          }
        }
        cursor += ticks;
      }
    }

    if (!anyTilePlaced) {
      // Nothing placed on this beat by any instrument — stay silent rather
      // than cluttering the page with a rest for every unplayed instrument.
      const ghost = new VF.GhostNote({ duration: "q" });
      notes.push(ghost);
      beatStartNotes[beat] = ghost;
      continue;
    }

    const segments: Segment[] = [];
    if (!anyRealNote) {
      // Something was placed, but every hit on every line is a rest.
      segments.push({ ticks: TICKS_PER_BEAT, instruments: null });
    } else {
      const onsetTicks = [...onsetsByTick.keys()].sort((a, b) => a - b);
      if (onsetTicks[0] > 0) {
        // Silence before the first attack in the beat.
        segments.push({ ticks: onsetTicks[0], instruments: null });
      }
      onsetTicks.forEach((tick, i) => {
        const end = i + 1 < onsetTicks.length ? onsetTicks[i + 1] : TICKS_PER_BEAT;
        segments.push({ ticks: end - tick, instruments: onsetsByTick.get(tick)! });
      });
    }

    const beatNotes: InstanceType<VF["StemmableNote"]>[] = [];
    let beatHasTriplet = false;

    for (const seg of segments) {
      const { code, dots, isTriplet } = durationForTicks(seg.ticks);
      if (isTriplet) beatHasTriplet = true;

      if (!seg.instruments) {
        const restNote = new VF.StaveNote({ keys: ["b/4"], duration: `${code}r`, dots });
        if (dots > 0) VF.Dot.buildAndAttach([restNote], { all: true });
        notes.push(restNote);
        beatNotes.push(restNote);
        continue;
      }

      const keys = seg.instruments.map((inst) => {
        const pos = INSTRUMENT_POSITION[inst];
        return pos.noteheadCode ? `${pos.key}/${pos.noteheadCode}` : pos.key;
      });
      const staveNote = new VF.StaveNote({ keys, duration: code, dots });
      if (dots > 0) VF.Dot.buildAndAttach([staveNote], { all: true });
      staveNote.setStemDirection(STEM_DIRECTION);
      seg.instruments.forEach((inst, i) => {
        const annotation = INSTRUMENT_POSITION[inst].annotation;
        if (annotation) {
          staveNote.addModifier(
            new VF.Annotation(annotation).setVerticalJustification(VF.AnnotationVerticalJustify.TOP),
            i
          );
        }
      });
      notes.push(staveNote);
      beatNotes.push(staveNote);
    }

    beatStartNotes[beat] = beatNotes[0];

    // Rests have no stem of their own, so beams must be built with
    // generateBeams's beamRests option rather than a plain `new VF.Beam(...)`,
    // which requires every member to already have one.
    if (beatHasTriplet) {
      tuplets.push(new VF.Tuplet(beatNotes, { numNotes: 3, notesOccupied: 2 }));
      if (beatNotes.length >= 2) {
        beams.push(
          ...VF.Beam.generateBeams(beatNotes, { beamRests: true, stemDirection: STEM_DIRECTION })
        );
      }
    } else {
      let run: InstanceType<VF["StemmableNote"]>[] = [];
      const flush = () => {
        if (run.length >= 2) {
          beams.push(
            ...VF.Beam.generateBeams(run, { beamRests: true, stemDirection: STEM_DIRECTION })
          );
        }
        run = [];
      };
      segments.forEach((seg, i) => {
        if (seg.ticks !== TICKS_PER_BEAT) run.push(beatNotes[i]);
        else flush();
      });
      flush();
    }
  }

  voice.addTickables(notes);
  new VF.Formatter().joinVoices([voice]).formatToStave([voice], stave);
  voice.draw(context, stave);
  beams.forEach((b) => b.setContext(context).draw());
  tuplets.forEach((t) => t.setContext(context).draw());

  const beatBoundariesX = beatStartNotes.map((n) => n?.getAbsoluteX() ?? stave.getNoteStartX());
  beatBoundariesX.push(stave.getNoteEndX());

  return {
    beatBoundariesX,
    staveTopY: STAVE_Y - 60,
    staveBottomY: STAVE_Y + 60,
  };
}
