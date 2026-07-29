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

const INSTRUMENT_POSITION: Record<InstrumentId, StaffPosition> = {
  kick: { key: "c/4", stemUp: false },
  lowTom: { key: "f/4", stemUp: false },
  midTom: { key: "a/4", stemUp: false },
  snare: { key: "b/4", stemUp: false },
  rimshot: { key: "b/4", notehead: "d", stemUp: false },
  highTom: { key: "d/5", stemUp: false },
  ride: { key: "f/5", notehead: "x", stemUp: true },
  hihatClosed: { key: "g/5", notehead: "x", stemUp: true },
  hihatOpen: { key: "g/5", notehead: "x", stemUp: true, annotation: "o" },
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
          const ghost = new VF.GhostNote({ duration: DURATION_CODE[hit.note], dots });
          notes.push(ghost);
          beatNotes.push(ghost);
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
      }

      beatStartNotes[beat] = beatStartNotes[beat] ?? beatNotes[0];

      if (tile && hits.some((h) => isTriplet(h.note))) {
        tuplets.push(new VF.Tuplet(beatNotes, { numNotes: 3, notesOccupied: 2 }));
        if (beatNotes.length >= 2) beams.push(new VF.Beam(beatNotes));
      } else {
        let run: InstanceType<VF["StemmableNote"]>[] = [];
        const flush = () => {
          if (run.length >= 2) beams.push(new VF.Beam(run));
          run = [];
        };
        hits.forEach((h, i) => {
          if (h.type === "note" && isBeamable(h.note)) {
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
