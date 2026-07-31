import type * as VexflowModule from "vexflow";
import { InstrumentId } from "./instruments";
import { NoteName, RhythmHit } from "./rhythm";
import { LineData } from "./song";

type VF = typeof VexflowModule;

interface StaffPosition {
  key: string;
  notehead?: "x" | "d";
  stemUp: boolean;
  annotation?: string;
}

// Staff positions match the standard drum key (kick=F4 space, snare=C5 space,
// hi-hat=F5 top line, ride=G5 above the staff, crash=A5 ledger above, etc.)
// Every voice uses an upward stem, matching the reference drum key's own
// convention — and, as a bonus, sidesteps a VexFlow 5.0.0 beam rendering bug
// where a downward-stem beam fails to connect its first note whenever that
// note has fewer beam lines than the notes following it (confirmed in
// isolation, independent of this app's code).
const INSTRUMENT_POSITION: Record<InstrumentId, StaffPosition> = {
  kick: { key: "f/4", stemUp: true },
  lowTom: { key: "a/4", stemUp: true },
  midTom: { key: "d/5", stemUp: true },
  snare: { key: "c/5", stemUp: true },
  rimshot: { key: "c/5", notehead: "d", stemUp: true },
  highTom: { key: "e/5", stemUp: true },
  ride: { key: "g/5", notehead: "x", stemUp: true },
  hihatClosed: { key: "f/5", notehead: "x", stemUp: true },
  hihatOpen: { key: "f/5", notehead: "x", stemUp: true, annotation: "o" },
  crash: { key: "a/5", notehead: "x", stemUp: true },
};

const DURATION_CODE: Record<NoteName, string> = {
  quarter: "q",
  dottedEighth: "8",
  eighth: "8",
  sixteenth: "16",
  eighthTriplet: "8",
  sixteenthTriplet: "16",
};

function isDotted(note: NoteName): boolean {
  return note === "dottedEighth";
}

function isBeamable(note: NoteName): boolean {
  return note !== "quarter";
}

function isTriplet(note: NoteName): boolean {
  return note === "eighthTriplet" || note === "sixteenthTriplet";
}

export interface NotationLayout {
  beatBoundariesX: number[];
  staveTopY: number;
  staveBottomY: number;
}

const STAVE_MARGIN_X = 10;
const STAVE_Y = 110;
const CANVAS_HEIGHT = 280;

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

  const voices: InstanceType<VF["Voice"]>[] = [];
  const beams: InstanceType<VF["Beam"]>[] = [];
  const tuplets: InstanceType<VF["Tuplet"]>[] = [];
  const staveNotes: InstanceType<VF["StaveNote"]>[] = [];
  const beatStartNotes: (InstanceType<VF["StemmableNote"]> | undefined)[] = new Array(
    measureLength
  ).fill(undefined);

  for (const line of lines) {
    const pos = INSTRUMENT_POSITION[line.instrument];
    const voice = new VF.Voice({ numBeats: measureLength, beatValue: 4 });
    voice.setStrict(false);
    const notes: InstanceType<VF["StemmableNote"]>[] = [];

    for (let beat = 0; beat < measureLength; beat++) {
      const tile = line.blocks[beat];
      const beatNotes: InstanceType<VF["StemmableNote"]>[] = [];

      const hits: RhythmHit[] = tile ? tile.hits : [{ type: "rest", note: "quarter" }];

      for (const hit of hits) {
        const dots = isDotted(hit.note) ? 1 : 0;

        if (hit.type === "rest") {
          if (!tile) {
            // Nothing was placed on this beat at all — stay silent rather than
            // cluttering the page with a rest for every unplayed instrument.
            const ghost = new VF.GhostNote({ duration: DURATION_CODE[hit.note], dots });
            notes.push(ghost);
            beatNotes.push(ghost);
            continue;
          }
          // A rest inside an otherwise active beat carries real rhythmic
          // information, so show it — on this instrument's own line, so beams
          // that run through it stay flat instead of jumping pitch — and let
          // the beam run through it.
          const restNote = new VF.StaveNote({
            keys: [pos.key],
            duration: `${DURATION_CODE[hit.note]}r`,
            dots,
          });
          if (dots > 0) VF.Dot.buildAndAttach([restNote], { all: true });
          notes.push(restNote);
          beatNotes.push(restNote);
          staveNotes.push(restNote);
          continue;
        }

        const staveNote = new VF.StaveNote({
          keys: [pos.key],
          duration: DURATION_CODE[hit.note],
          dots,
          type: pos.notehead,
        });
        if (dots > 0) VF.Dot.buildAndAttach([staveNote], { all: true });
        staveNote.setStemDirection(pos.stemUp ? VF.Stem.UP : VF.Stem.DOWN);
        if (pos.annotation) {
          staveNote.addModifier(
            new VF.Annotation(pos.annotation).setVerticalJustification(VF.AnnotationVerticalJustify.TOP)
          );
        }
        notes.push(staveNote);
        beatNotes.push(staveNote);
        staveNotes.push(staveNote);
      }

      beatStartNotes[beat] = beatStartNotes[beat] ?? beatNotes[0];

      // Rests rendered above (when a tile is placed) have no stem of their own,
      // so beams must be built with generateBeams's beam_rests option rather
      // than a plain `new VF.Beam(...)`, which requires every member to have one.
      const stemDirection = pos.stemUp ? 1 : -1;
      if (tile && hits.some((h) => isTriplet(h.note))) {
        tuplets.push(new VF.Tuplet(beatNotes, { numNotes: 3, notesOccupied: 2 }));
        if (beatNotes.length >= 2) {
          beams.push(
            ...VF.Beam.generateBeams(beatNotes, { beamRests: true, stemDirection: stemDirection })
          );
        }
      } else {
        let run: InstanceType<VF["StemmableNote"]>[] = [];
        const flush = () => {
          if (run.length >= 2) {
            beams.push(
              ...VF.Beam.generateBeams(run, { beamRests: true, stemDirection: stemDirection })
            );
          }
          run = [];
        };
        hits.forEach((h, i) => {
          if (isBeamable(h.note)) {
            run.push(beatNotes[i]);
          } else {
            flush();
          }
        });
        flush();
      }
    }

    voice.addTickables(notes);
    voices.push(voice);
  }

  new VF.Formatter().joinVoices(voices).formatToStave(voices, stave);
  // VexFlow's multi-voice formatter automatically nudges notes apart
  // horizontally whenever two voices land on the same tick (its SATB-style
  // "voice collision avoidance"), so simultaneous hits across instrument
  // lines don't land at the exact same x. Drum notation wants the opposite —
  // notes on the same beat should sit directly on top of one another — so
  // undo that shift after formatting places notes at their shared tick x.
  staveNotes.forEach((n) => n.setXShift(0));
  voices.forEach((v) => v.draw(context, stave));
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
