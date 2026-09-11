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

// One beat's slice of a stave, in canvas pixels — what the playhead
// highlight box is drawn over. A bar's last beat runs to its own closing
// barline rather than to the next bar's first note, so a highlight never
// straddles a barline.
export interface BeatSpan {
  x0: number;
  x1: number;
}

export interface NotationLayout {
  beatSpans: BeatSpan[];
  staveTopY: number;
  staveBottomY: number;
  // The width/height the system was actually drawn at, in whole pixels —
  // always the width the caller offered, or (from float rounding) a pixel
  // either side of it. A bar too busy to fit at full size draws at the size
  // it actually needs and then shrinks — see drawSystem — so this never
  // exceeds what was offered by more than rounding: callers size their
  // "paper" to it and never need to scroll to see the rest of a bar.
  width: number;
  height: number;
}

// The horizontal padding each view's white "paper" puts around the SVG.
// Shared so a view can offer drawSystem the width it will really have
// *inside* that padding, then grow the paper back by the same amount — miss
// this and the last beat of a bar hangs off the edge of the page.
export const PAPER_PADDING = 16;

// Floor a caller should clamp its measured width to before offering it to
// drawSystem — low enough that it can never itself exceed a real container's
// width (guarding only against a momentary 0px reading mid-transition, not
// against any screen an actual phone would ever report), so this floor can
// never become the reason a bar doesn't fit.
export const MIN_DRAW_WIDTH = 40;

const STAVE_MARGIN_X = 10;
// A Stave draws its top line 40px below its own y, so this puts the top line
// 90px down the canvas: headroom for a crash's ledger line, up-stems, beams,
// tuplet numbers and accent marks, with room left under the bottom line for
// the kick and for rests.
const STAVE_Y = 50;
const CANVAS_HEIGHT = 190;
// How far past the outer staff lines the playhead box reaches: enough above
// to cover a crash and its accent, enough below to cover the kick.
const HIGHLIGHT_ABOVE = 56;
const HIGHLIGHT_BELOW = 22;
// Breathing room between a bar's last notehead and its closing barline.
const NOTE_END_PAD = 12;
// Floor width for a bar, however empty it is — an all-rests bar shouldn't
// collapse to the width of its clef.
const MIN_BAR_WIDTH = 170;

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

// Everything one measure needs in order to be drawn, built *before* any
// width has been settled on. Splitting "build" from "draw" is what lets the
// caller ask how much room the music actually needs (`minWidth`) and then
// hand back a stave wide enough for it — rather than picking a width first
// and watching the notes spill past the closing barline, which is what a
// busy bar on a narrow screen used to do.
interface MeasureSpec {
  y: number;
  lines: NotationLine[];
  startBeat: number;
  numBeats: number;
  showClefAndTime: boolean;
  isContinuation: boolean;
}

interface PreparedMeasure {
  stave: InstanceType<VF["Stave"]>;
  voice: InstanceType<VF["Voice"]>;
  formatter: InstanceType<VF["Formatter"]>;
  beams: InstanceType<VF["Beam"]>[];
  tuplets: InstanceType<VF["Tuplet"]>[];
  beatStartNotes: (InstanceType<VF["StemmableNote"]> | undefined)[];
  // Narrowest stave width that still fits every notehead, modifier and the
  // gap before the closing barline.
  minWidth: number;
}

// `startBeat` offsets which of the pattern's beats this measure covers, so
// an 8-beat pattern can be split across two 4/4 measures — see drawSystem.
function prepareMeasure(
  VF: VF,
  context: ReturnType<VF["Renderer"]["prototype"]["getContext"]>,
  { y, lines, startBeat, numBeats, showClefAndTime, isContinuation }: MeasureSpec
): PreparedMeasure {
  // x and width are provisional: drawMeasure moves and resizes the stave
  // once every bar in the system has reported what it needs.
  const stave = new VF.Stave(0, y, MIN_BAR_WIDTH);
  if (showClefAndTime) {
    stave.addClef("percussion");
    stave.addTimeSignature(`${numBeats}/4`);
  }
  // A continuation measure butts up against the previous one, so its own
  // begin barline would double against that measure's end barline — drop it.
  if (isContinuation) stave.setBegBarType(VF.Barline.type.NONE);
  stave.setContext(context);

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
    // Parallel to `segments`/`beatNotes` — kept around so the tuplet bracket
    // below can tell a clean single-level triplet run (every subdivision in
    // the beat the same note value) from a nested mix of two different
    // triplet levels, without re-deriving durations from ticks a second time.
    const segmentDurations = segments.map((seg) => durationForTicks(seg.ticks));
    let beatHasTriplet = false;

    for (const [i, seg] of segments.entries()) {
      const { code, dots, isTriplet } = segmentDurations[i];
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
      seg.instruments.forEach(({ instrument: inst, accent }, keyIndex) => {
        const annotation = INSTRUMENT_POSITION[inst].annotation;
        if (annotation) {
          staveNote.addModifier(
            new VF.Annotation(annotation).setVerticalJustification(VF.AnnotationVerticalJustify.TOP),
            keyIndex
          );
        }
        // ">" above the notehead for an accented hit — same articulation a
        // real drum chart would use.
        if (accent === "accent") staveNote.addModifier(new VF.Articulation("a>"), keyIndex);
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
      // VexFlow draws one flat bracket over every note passed to it, with
      // whatever numNotes/notesOccupied it's given — it has no notion of a
      // bracket only "really" covering some of its notes. A clean run where
      // every triplet subdivision in the beat is the same note value (three
      // eighth-triplets, or six sixteenth-triplets filling the whole beat as
      // a sextuplet) can report its actual count instead of a hardcoded "3"
      // that only happened to be right when there were exactly 3 of them —
      // that hardcoding is what used to bracket a full beat of six
      // sixteenth-triplets as "3". A beat that nests two different triplet
      // levels (an eighth-triplet subdivided further into sixteenth-
      // triplets) has no single honest count to report — VexFlow can't draw
      // nested brackets here — so it keeps the 3:2 approximation that
      // already reads fine for those tiles.
      const tripletTicks = segments
        .map((seg, i) => (segmentDurations[i].isTriplet ? seg.ticks : null))
        .filter((t): t is number => t !== null);
      const sameLevel = tripletTicks.every((t) => t === tripletTicks[0]);
      const numNotes = sameLevel ? tripletTicks.length : 3;
      // A triplet note always takes 2/3 the time of a "straight" note at the
      // same level — that's the definition of "triplet" — so the straight-
      // note-equivalent count is always 2/3 of the triplet note count.
      const notesOccupied = sameLevel ? Math.round((tripletTicks.length * 2) / 3) : 2;
      tuplets.push(
        new VF.Tuplet(beatNotes, { numNotes, notesOccupied, ratioed: false })
      );
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

  // joinVoices has to come before preCalculateMinTotalWidth, and both have
  // to happen on the same Formatter that later justifies the voice — so keep
  // this one around for drawMeasure instead of making a fresh one there.
  const formatter = new VF.Formatter().joinVoices([voice]);
  // What the formatter would need between the stave's note-start and
  // note-end. Everything left of the note-start (begin barline, clef, time
  // signature) is fixed by the modifiers, so measure it off the stave itself
  // rather than guessing at a "clef bonus".
  const noteRoom = formatter.preCalculateMinTotalWidth([voice]);
  const leftOverhead = stave.getNoteStartX() - stave.getX();
  const minWidth = Math.max(
    MIN_BAR_WIDTH,
    Math.ceil(leftOverhead + noteRoom + VF.Stave.defaultPadding + NOTE_END_PAD)
  );

  return { stave, voice, formatter, beams, tuplets, beatStartNotes, minWidth };
}

// Places a prepared measure at `x` with the width the system settled on, and
// draws it. Returns one span per beat — a bar's last beat runs to its own
// note-end, so a playhead box never straddles the barline into the next bar.
function drawMeasure(
  context: ReturnType<VF["Renderer"]["prototype"]["getContext"]>,
  prepared: PreparedMeasure,
  x: number,
  width: number
): BeatSpan[] {
  const { stave, voice, formatter, beams, tuplets, beatStartNotes } = prepared;
  stave.setX(x);
  stave.setWidth(width);
  stave.draw();

  formatter.formatToStave([voice], stave);
  voice.draw(context, stave);
  beams.forEach((b) => b.setContext(context).draw());
  tuplets.forEach((t) => t.setContext(context).draw());

  const noteEndX = stave.getNoteEndX();
  const starts = beatStartNotes.map((n) => n?.getAbsoluteX() ?? stave.getNoteStartX());
  return starts.map((x0, i) => ({ x0, x1: i + 1 < starts.length ? starts[i + 1] : noteEndX }));
}

// Lays out and draws one or more measures as a single horizontal system, and
// reports back where each beat sits.
//
// `availWidth` is an offer, not an order, but it's never exceeded. Every bar
// first says how narrow it can get without its notes colliding or running
// past the barline; if the offer covers that total, the slack is shared out
// in proportion to what each bar asked for (a bar of 16ths earns more room
// than a bar of quarters, and the bar carrying the clef and time signature
// earns the room those take). If it doesn't — a busy bar on a narrow phone —
// the system is drawn at the natural size its notes need and then the whole
// drawing is scaled down (via the SVG's viewBox, so every note, beam and
// tuplet shrinks together rather than any one element being recomputed at a
// different size) until it fits inside what was offered. A bar never has to
// be scrolled to see the rest of it; on a very narrow screen a very busy bar
// just reads smaller.
function drawSystem(
  VF: VF,
  context: ReturnType<VF["Renderer"]["prototype"]["getContext"]>,
  renderer: InstanceType<VF["Renderer"]>,
  specs: MeasureSpec[],
  availWidth: number
): NotationLayout {
  const prepared = specs.map((spec) => prepareMeasure(VF, context, spec));
  const totalMin = prepared.reduce((sum, p) => sum + p.minWidth, 0);
  // The system's natural size: fills availWidth when the music has room to
  // spare, or grows past it to whatever the busiest layout actually needs —
  // never squeezed at this stage, so nothing collides or gets clipped.
  const naturalUsable = Math.ceil(Math.max(availWidth - STAVE_MARGIN_X * 2, totalMin));
  const naturalWidth = naturalUsable + STAVE_MARGIN_X * 2;

  // Resize before anything is drawn: the SVG has to be as wide as the system
  // or a bar would be clipped by the viewport rather than laid out fully.
  renderer.resize(naturalWidth, CANVAS_HEIGHT);

  const beatSpans: BeatSpan[] = [];
  let x = STAVE_MARGIN_X;
  prepared.forEach((p, i) => {
    // Give the last bar whatever pixels rounding left over, so the system
    // ends exactly on the right margin.
    const barWidth =
      i === prepared.length - 1
        ? naturalUsable - (x - STAVE_MARGIN_X)
        : Math.round((p.minWidth / totalMin) * naturalUsable);
    beatSpans.push(...drawMeasure(context, p, x, barWidth));
    x += barWidth;
  });

  // Shrink the finished drawing down to fit, if it needed more than it was
  // offered. Scale is never above 1 — a system that already fit at natural
  // size (the common case) is left exactly as drawn. Only SVGContext has a
  // viewBox to lean on for this — a canvas target (the fractal-art video
  // exporter's sheet-music rasterizer, see renderNotationMeasureToCanvas)
  // is left at natural size instead and relies on its own caller to scale
  // the finished canvas down via drawImage, which it always does anyway.
  const svgContext = "setViewBox" in context ? (context as InstanceType<VF["SVGContext"]>) : null;
  const scale = svgContext ? Math.min(1, availWidth / naturalWidth) : 1;
  const width = Math.round(naturalWidth * scale);
  const height = Math.round(CANVAS_HEIGHT * scale);
  if (svgContext && scale < 1) {
    // renderer.resize shrinks the SVG's own width/height attributes, which
    // on its own would crop the natural-sized drawing rather than shrink
    // it — VexFlow's resize resets the viewBox to match 1:1. Stretching the
    // viewBox back out to the natural coordinate space after is what turns
    // that crop into a scale-down: the browser fits the full (unclipped)
    // drawing into the smaller box.
    renderer.resize(width, height);
    svgContext.setViewBox(0, 0, naturalWidth, CANVAS_HEIGHT);
  }

  const stave = prepared[0].stave;
  return {
    beatSpans: beatSpans.map((s) => ({ x0: s.x0 * scale, x1: s.x1 * scale })),
    staveTopY: (stave.getYForLine(0) - HIGHLIGHT_ABOVE) * scale,
    staveBottomY: (stave.getYForLine(4) + HIGHLIGHT_BELOW) * scale,
    width,
    height,
  };
}

function newRenderer(VF: VF, container: HTMLDivElement) {
  container.innerHTML = "";
  const renderer = new VF.Renderer(container, VF.Renderer.Backends.SVG);
  return { renderer, context: renderer.getContext() };
}

// Renders a whole pattern as one system: an 8-beat pattern is written as two
// 4/4 measures (see measureSplit) the way a drummer would actually read it;
// 3-7 beats stay a single bar in their own time signature.
export function renderNotation(
  VF: VF,
  container: HTMLDivElement,
  lines: NotationLine[],
  measureLength: number,
  availWidth: number
): NotationLayout {
  const { renderer, context } = newRenderer(VF, container);
  let startBeat = 0;
  const specs: MeasureSpec[] = measureSplit(measureLength).map((numBeats, i) => {
    const spec: MeasureSpec = {
      y: STAVE_Y,
      lines,
      startBeat,
      numBeats,
      showClefAndTime: i === 0,
      isContinuation: i > 0,
    };
    startBeat += numBeats;
    return spec;
  });
  return drawSystem(VF, context, renderer, specs, availWidth);
}

// Renders exactly one measure — beats [startBeat, startBeat + numBeats) of
// `lines` — as its own clef-and-time-signature stave. The fullscreen Sheet
// Music views use this to page through an arrangement one bar at a time;
// whole-pattern views use renderNotation instead.
export function renderNotationPage(
  VF: VF,
  container: HTMLDivElement,
  lines: NotationLine[],
  startBeat: number,
  numBeats: number,
  availWidth: number
): NotationLayout {
  const { renderer, context } = newRenderer(VF, container);
  return drawSystem(
    VF,
    context,
    renderer,
    [{ y: STAVE_Y, lines, startBeat, numBeats, showClefAndTime: true, isContinuation: false }],
    availWidth
  );
}

// Same as renderNotationPage — one clef-and-time-signature measure — but
// drawn onto an HTMLCanvasElement via VexFlow's Canvas backend rather than
// into an SVG-holding container. Exists for exactly one caller: the
// fractal-art video exporter, which composites the result onto another
// canvas via drawImage. That's not just a style difference — an SVG
// rasterized through an <img> (the obvious way to get notation onto a
// canvas) gets its own isolated rendering context that can't see
// VexFlow's Bravura music-glyph font, which is registered on `document`
// via the FontFace API rather than embedded in the SVG markup itself, so
// every notehead/clef/time-signature glyph falls back to a generic font —
// they're all in the same Private-Use-Area code block, so this renders as
// a wall of garbled boxes. A canvas target has no such isolation: its 2D
// text calls resolve fonts through the same `document.fonts` as anything
// else on the page, attached to the DOM or not.
export function renderNotationMeasureToCanvas(
  VF: VF,
  canvas: HTMLCanvasElement,
  lines: NotationLine[],
  startBeat: number,
  numBeats: number,
  availWidth: number
): NotationLayout {
  const renderer = new VF.Renderer(canvas, VF.Renderer.Backends.CANVAS);
  const context = renderer.getContext();
  return drawSystem(
    VF,
    context,
    renderer,
    [{ y: STAVE_Y, lines, startBeat, numBeats, showClefAndTime: true, isContinuation: false }],
    availWidth
  );
}

// Positions a playhead box over one beat of a rendered system. Every view
// that shows notation highlights the beat the same way, so they share this
// rather than each re-deriving the geometry from a layout.
export function placeBeatHighlight(
  el: HTMLElement,
  layout: NotationLayout | null,
  beat: number | null
) {
  const span = beat === null ? undefined : layout?.beatSpans[beat];
  if (!layout || !span) {
    el.style.opacity = "0";
    return;
  }
  el.style.opacity = "1";
  el.style.left = `${span.x0 - 5}px`;
  el.style.width = `${Math.max(span.x1 - span.x0 + 5, 10)}px`;
  el.style.top = `${layout.staveTopY}px`;
  el.style.height = `${layout.staveBottomY - layout.staveTopY}px`;
}

// Scrolls a highlighted beat back into view when the bar is wider than the
// screen — otherwise the playhead walks off the right edge of a busy bar on
// a phone and the reader has to chase it by hand.
export function keepBeatVisible(scroller: HTMLElement | null, el: HTMLElement) {
  if (!scroller || el.style.opacity === "0") return;
  const box = el.getBoundingClientRect();
  const view = scroller.getBoundingClientRect();
  const margin = 24;
  if (box.left < view.left + margin) {
    scroller.scrollLeft -= view.left + margin - box.left;
  } else if (box.right > view.right - margin) {
    scroller.scrollLeft += box.right - (view.right - margin);
  }
}

// One bar of a Stack arrangement, tied back to its step. The Stack sheet-
// music view writes the whole arrangement out one bar per screen (like the
// editor's SheetMusicView), so an 8-beat step contributes two 4/4 bars and a
// 3-7 beat step one bar in its own meter; `stepIndex` lets the view map
// playback position onto a bar and label which section it's in.
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
