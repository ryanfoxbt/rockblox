import type * as VexflowModule from "vexflow";
import { InstrumentId } from "./instruments";
import { HitAccent, NoteName, NOTE_FRACTION, RhythmTile } from "./rhythm";
import { measureSplit } from "./song";

export type VF = typeof VexflowModule;

// Structural rather than importing LineData directly, so callers can pass
// either the editor's LineData (which carries an id) or a Stack Builder
// slot's plain LineState — both shapes work here since only these two
// fields are read.
export interface NotationLine {
  instrument: InstrumentId;
  blocks: (RhythmTile | null)[];
}

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

// One instrument's onset at a given tick, carrying its dynamic level along
// so the notehead can be marked with an accent (">") or wrapped in
// parentheses (ghost) the same way a real drum chart would.
interface OnsetHit {
  instrument: InstrumentId;
  accent?: HitAccent;
}

// A slot within a beat: either a chord of simultaneous instrument hits, or a
// rest covering a stretch where nothing on the kit sounds.
interface Segment {
  ticks: number;
  instruments: OnsetHit[] | null;
}

// Draws one measure's stave/voice/beams/tuplets at (x, y) and returns each
// beat's first-note X (for playhead highlighting) plus the stave's right
// edge. `startBeat` offsets which of the pattern's beats this measure covers,
// so an 8-beat pattern can be split across two 4/4 measures — see drawStave.
interface MeasureDrawOptions {
  x: number;
  y: number;
  width: number;
  lines: NotationLine[];
  startBeat: number;
  numBeats: number;
  showClefAndTime: boolean;
  isContinuation: boolean;
}

function drawOneMeasure(
  VF: VF,
  context: ReturnType<VF["Renderer"]["prototype"]["getContext"]>,
  { x, y, width, lines, startBeat, numBeats, showClefAndTime, isContinuation }: MeasureDrawOptions
): { beatStartX: number[]; noteEndX: number } {
  const stave = new VF.Stave(x, y, Math.max(width, 120));
  if (showClefAndTime) {
    stave.addClef("percussion");
    stave.addTimeSignature(`${numBeats}/4`);
  }
  // A continuation measure butts up against the previous one, so its own
  // begin barline would double against that measure's end barline — drop it.
  if (isContinuation) stave.setBegBarType(VF.Barline.type.NONE);
  stave.setContext(context).draw();

  // Real drum notation puts every instrument on one shared staff voice, with
  // simultaneous hits drawn as one chorded notehead group under a single
  // stem/beam — not one independent voice per instrument. That's the piece
  // this file got wrong before: N separate voices meant N separate beams
  // stacked on top of each other, and per-voice formatting that never
  // actually aligned same-beat hits.
  const voice = new VF.Voice({ numBeats, beatValue: 4 });
  voice.setStrict(false);

  const notes: InstanceType<VF["StemmableNote"]>[] = [];
  const beams: InstanceType<VF["Beam"]>[] = [];
  const tuplets: InstanceType<VF["Tuplet"]>[] = [];
  const beatStartNotes: (InstanceType<VF["StemmableNote"]> | undefined)[] = new Array(
    numBeats
  ).fill(undefined);

  // A rest at the start or end of a would-be beam group isn't beamed in
  // standard notation: a subdivided beat with one of its hits turned to a
  // rest reads as a flagged note next to a rest, not a one-note beam. Trim
  // edge rests off the group and only return it when two or more sounding
  // notes are left. `beamRests` stays on at the call sites so a rest *between*
  // two hits still beams through, which is correct.
  const beamableRun = (
    group: { note: InstanceType<VF["StemmableNote"]>; isRest: boolean }[]
  ): InstanceType<VF["StemmableNote"]>[] | null => {
    let start = 0;
    let end = group.length;
    while (start < end && group[start].isRest) start++;
    while (end > start && group[end - 1].isRest) end--;
    const trimmed = group.slice(start, end);
    const sounding = trimmed.filter((g) => !g.isRest).length;
    return sounding >= 2 ? trimmed.map((g) => g.note) : null;
  };

  for (let beat = 0; beat < numBeats; beat++) {
    // Collect every note onset in this beat, across all instrument lines,
    // keyed by its tick offset — so hits that land on the same tick become
    // one chord instead of independently-positioned noteheads.
    const onsetsByTick = new Map<number, OnsetHit[]>();
    let anyTilePlaced = false;
    let anyRealNote = false;

    for (const line of lines) {
      const tile = line.blocks[startBeat + beat];
      if (!tile) continue;
      anyTilePlaced = true;

      let cursor = 0;
      for (const hit of tile.hits) {
        const ticks = NOTE_TICKS[hit.note];
        if (hit.type === "note") {
          anyRealNote = true;
          const existing = onsetsByTick.get(cursor);
          if (existing) {
            if (!existing.some((o) => o.instrument === line.instrument)) {
              existing.push({ instrument: line.instrument, accent: hit.accent });
            }
          } else {
            onsetsByTick.set(cursor, [{ instrument: line.instrument, accent: hit.accent }]);
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

      const keys = seg.instruments.map(({ instrument: inst }) => {
        const pos = INSTRUMENT_POSITION[inst];
        return pos.noteheadCode ? `${pos.key}/${pos.noteheadCode}` : pos.key;
      });
      const staveNote = new VF.StaveNote({ keys, duration: code, dots });
      if (dots > 0) VF.Dot.buildAndAttach([staveNote], { all: true });
      staveNote.setStemDirection(STEM_DIRECTION);
      seg.instruments.forEach(({ instrument: inst, accent }, i) => {
        const annotation = INSTRUMENT_POSITION[inst].annotation;
        if (annotation) {
          staveNote.addModifier(
            new VF.Annotation(annotation).setVerticalJustification(VF.AnnotationVerticalJustify.TOP),
            i
          );
        }
        // ">" above the notehead for an accented hit — same articulation a
        // real drum chart would use.
        if (accent === "accent") staveNote.addModifier(new VF.Articulation("a>"), i);
      });
      // Parentheses around the whole chord for a ghost note — only when
      // every instrument sounding at this instant is ghosted, since VexFlow
      // parenthesizes a note as a whole rather than one key within a chord.
      if (seg.instruments.every((o) => o.accent === "ghost")) {
        VF.Parenthesis.buildAndAttach([staveNote]);
      }
      notes.push(staveNote);
      beatNotes.push(staveNote);
    }

    beatStartNotes[beat] = beatNotes[0];

    // Rests have no stem of their own, so beams must be built with
    // generateBeams's beamRests option rather than a plain `new VF.Beam(...)`,
    // which requires every member to already have one.
    if (beatHasTriplet) {
      tuplets.push(new VF.Tuplet(beatNotes, { numNotes: 3, notesOccupied: 2 }));
      const toBeam = beamableRun(
        beatNotes.map((note, i) => ({ note, isRest: !segments[i].instruments }))
      );
      if (toBeam) {
        beams.push(
          ...VF.Beam.generateBeams(toBeam, { beamRests: true, stemDirection: STEM_DIRECTION })
        );
      }
    } else {
      let run: { note: InstanceType<VF["StemmableNote"]>; isRest: boolean }[] = [];
      const flush = () => {
        const toBeam = beamableRun(run);
        if (toBeam) {
          beams.push(
            ...VF.Beam.generateBeams(toBeam, { beamRests: true, stemDirection: STEM_DIRECTION })
          );
        }
        run = [];
      };
      segments.forEach((seg, i) => {
        if (seg.ticks !== TICKS_PER_BEAT) run.push({ note: beatNotes[i], isRest: !seg.instruments });
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

  return {
    beatStartX: beatStartNotes.map((n) => n?.getAbsoluteX() ?? stave.getNoteStartX()),
    noteEndX: stave.getNoteEndX(),
  };
}

// Draws a pattern as one or more measures on a single horizontal system at
// vertical offset `y`, returning the per-beat X boundaries a playhead
// highlight needs. An 8-beat pattern is written as two 4/4 measures (see
// measureSplit) the way a drummer would actually read it; 3-7 beats stay a
// single bar in their own time signature. Shared by renderNotation and the
// Stack Builder's renderStackNotation.
function drawStave(
  VF: VF,
  context: ReturnType<VF["Renderer"]["prototype"]["getContext"]>,
  y: number,
  lines: NotationLine[],
  measureLength: number,
  width: number
): NotationLayout {
  const bars = measureSplit(measureLength);
  const usableWidth = Math.max(width - STAVE_MARGIN_X * 2, 200);
  // The first measure carries the clef + time signature, so it needs the
  // extra room; take that evenly off the continuation measures.
  const clefTimeBonus = bars.length > 1 ? 44 : 0;
  const evenWidth = usableWidth / bars.length;

  const beatBoundariesX: number[] = [];
  let x = STAVE_MARGIN_X;
  let startBeat = 0;
  let lastNoteEndX = x;

  bars.forEach((numBeats, barIndex) => {
    const barWidth =
      barIndex === 0 ? evenWidth + clefTimeBonus : evenWidth - clefTimeBonus / (bars.length - 1);
    const { beatStartX, noteEndX } = drawOneMeasure(VF, context, {
      x,
      y,
      width: barWidth,
      lines,
      startBeat,
      numBeats,
      showClefAndTime: barIndex === 0,
      isContinuation: barIndex > 0,
    });
    beatBoundariesX.push(...beatStartX);
    lastNoteEndX = noteEndX;
    x += barWidth;
    startBeat += numBeats;
  });
  beatBoundariesX.push(lastNoteEndX);

  return { beatBoundariesX, staveTopY: y - 60, staveBottomY: y + 60 };
}

export function renderNotation(
  VF: VF,
  container: HTMLDivElement,
  lines: NotationLine[],
  measureLength: number,
  width: number
): NotationLayout {
  container.innerHTML = "";
  const renderer = new VF.Renderer(container, VF.Renderer.Backends.SVG);
  renderer.resize(width, CANVAS_HEIGHT);
  const context = renderer.getContext();
  return drawStave(VF, context, STAVE_Y, lines, measureLength, width);
}

// Renders exactly one measure — beats [startBeat, startBeat + numBeats) of
// `lines` — as its own clef-and-time-signature stave filling the width. The
// fullscreen Sheet Music view uses this to page through an 8-beat pattern
// one 4/4 bar at a time; whole-pattern views use renderNotation /
// renderStackNotation instead.
export function renderNotationPage(
  VF: VF,
  container: HTMLDivElement,
  lines: NotationLine[],
  startBeat: number,
  numBeats: number,
  width: number
): NotationLayout {
  container.innerHTML = "";
  const renderer = new VF.Renderer(container, VF.Renderer.Backends.SVG);
  renderer.resize(width, CANVAS_HEIGHT);
  const context = renderer.getContext();
  const { beatStartX, noteEndX } = drawOneMeasure(VF, context, {
    x: STAVE_MARGIN_X,
    y: STAVE_Y,
    width: Math.max(width - STAVE_MARGIN_X * 2, 200),
    lines,
    startBeat,
    numBeats,
    showClefAndTime: true,
    isContinuation: false,
  });
  return {
    beatBoundariesX: [...beatStartX, noteEndX],
    staveTopY: STAVE_Y - 60,
    staveBottomY: STAVE_Y + 60,
  };
}

// One row of the Stack sheet music: a single bar drawn on its own full-width
// stave. A step whose pattern is 8 beats (or any multiple of 4 over 4)
// expands to two-plus of these — the way the fullscreen SheetMusicView
// paginates — so each bar keeps a full line to itself and stays readable on
// a phone, instead of two 4/4 bars sharing one narrow line.
export interface StackNotationRow {
  lines: NotationLine[];
  startBeat: number;
  numBeats: number;
}

// The row breakdown for a list of steps, without the note data — the
// paginated view uses it to count rows and to map the playback position
// (step + beat) onto a row before renderStackNotation is ever called.
export interface StackRowSpec {
  stepIndex: number;
  startBeat: number;
  numBeats: number;
}

export function expandStackRows(steps: { measureLength: number }[]): StackRowSpec[] {
  const rows: StackRowSpec[] = [];
  steps.forEach((step, stepIndex) => {
    let startBeat = 0;
    for (const numBeats of measureSplit(step.measureLength)) {
      if (numBeats > 0) rows.push({ stepIndex, startBeat, numBeats });
      startBeat += numBeats;
    }
  });
  return rows;
}

export interface StackNotationLayout {
  // One entry per rendered row (bar), in song order — each row's own beat
  // boundaries (for playhead highlighting) plus the stave's Y band on the
  // shared canvas.
  rows: NotationLayout[];
}

// Exported so callers (Stack Builder's paginated sheet-music view) can work
// out how many staves fit in a given pixel height before ever calling
// renderStackNotation, instead of guessing and overflowing the page.
export const STACK_STAVE_SPACING = CANVAS_HEIGHT - 60;

// Draws each row as its own full-width, clef-and-time stave, stacked
// vertically in song order — Stack Builder plays steps sequentially rather
// than as one combined measure, so the sheet music mirrors that; splitting
// each step into 4/4 bars (see expandStackRows) keeps every bar full-width.
export function renderStackNotation(
  VF: VF,
  container: HTMLDivElement,
  rows: StackNotationRow[],
  width: number
): StackNotationLayout {
  container.innerHTML = "";
  const totalHeight = Math.max(1, rows.length) * STACK_STAVE_SPACING + 60;
  const renderer = new VF.Renderer(container, VF.Renderer.Backends.SVG);
  renderer.resize(width, totalHeight);
  const context = renderer.getContext();

  const usableWidth = Math.max(width - STAVE_MARGIN_X * 2, 200);
  const layouts = rows.map((row, i) => {
    const y = STAVE_Y + i * STACK_STAVE_SPACING;
    const { beatStartX, noteEndX } = drawOneMeasure(VF, context, {
      x: STAVE_MARGIN_X,
      y,
      width: usableWidth,
      lines: row.lines,
      startBeat: row.startBeat,
      numBeats: row.numBeats,
      showClefAndTime: true,
      isContinuation: false,
    });
    return {
      beatBoundariesX: [...beatStartX, noteEndX],
      staveTopY: y - 60,
      staveBottomY: y + 60,
    };
  });

  return { rows: layouts };
}
