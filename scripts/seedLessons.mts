// One-off / re-runnable seed for the curated /school library — unlike
// scripts/seedSongs.mts (which copies an already-hand-built board), this
// content is original teaching material authored directly here as data: a
// stepwise beginner curriculum, each lesson adding one new idea to the last.
// See src/lib/drumSchool.ts for the matching index used by /school's list
// page, and src/db/schema.ts for the `lessons` table shape.
import { getDb } from "../src/db";
import { lessons } from "../src/db/schema";
import type { BoardSlotData } from "../src/lib/board";
import type { StoredLine } from "../src/lib/song";
import type { StackArrangement } from "../src/lib/stack";

// Every measure here is 4 beats; MAX_BEATS is 7, so pad out the rest with
// null (see src/lib/song.ts's computeMeasureLength — trailing nulls just
// trim the measure back down to 4).
function measure(...cells: (string | null)[]): (string | null)[] {
  return [...cells, ...Array(7 - cells.length).fill(null)];
}

function line(instrument: string, blocks: (string | null)[], volume?: number): StoredLine {
  return volume === undefined ? { instrument, blocks } : { instrument, blocks, volume };
}

// Mirrors rhythm.ts's own hit encoding (see encodeHits/decodeHits there) so
// lessons can author an exact hit/rest pattern — ghost notes, a shuffle
// feel, odd groupings — without hunting for a matching id in the static
// tile catalog. getTileById decodes any "c:...' id the same way regardless
// of whether it's in the catalog, so this round-trips exactly like a
// hand-placed tile would.
type NoteName = "sixteenth" | "eighth" | "dottedEighth" | "quarter" | "eighthTriplet" | "sixteenthTriplet";
const NOTE_CODE: Record<NoteName, string> = {
  sixteenth: "s",
  eighth: "e",
  dottedEighth: "d",
  quarter: "q",
  eighthTriplet: "te",
  sixteenthTriplet: "ts",
};
type HitAccent = "accent" | "ghost";
const ACCENT_CODE: Record<HitAccent, string> = { accent: "a", ghost: "g" };
interface Hit {
  type: "note" | "rest";
  note: NoteName;
  accent?: HitAccent;
}
// A real ghost/accent hit — not a whole quiet line — see rhythm.ts's
// HitAccent/ACCENT_VELOCITY. Only meaningful on a note (a rest has nothing
// to accent), matching cycleHitAccent's own rule there.
function N(note: NoteName, accent?: HitAccent): Hit {
  return { type: "note", note, accent };
}
function R(note: NoteName): Hit {
  return { type: "rest", note };
}
function custom(...hits: Hit[]): string {
  return (
    "c:" +
    hits
      .map((h) => {
        const base = `${h.type === "rest" ? "r" : "n"}${NOTE_CODE[h.note]}`;
        return h.accent ? `${base}:${ACCENT_CODE[h.accent]}` : base;
      })
      .join("-")
  );
}

function slot(bpm: number, lines: StoredLine[]): BoardSlotData {
  return { bpm, lines };
}

function stackId(n: number): string {
  return `step-lesson10-${n}`;
}

interface LessonSeed {
  slug: string;
  lessonNumber: number;
  title: string;
  teaches: string;
  slotA?: BoardSlotData | null;
  slotB?: BoardSlotData | null;
  slotC?: BoardSlotData | null;
  slotD?: BoardSlotData | null;
  stack?: StackArrangement | null;
}

// --- Shared building blocks, reused/varied across lessons -----------------

const HIHAT_QUARTERS = measure("n-quarter", "n-quarter", "n-quarter", "n-quarter");
const HIHAT_EIGHTHS = measure("n-e-e", "n-e-e", "n-e-e", "n-e-e");
const HIHAT_SIXTEENTHS = measure("n-s-s-s-s", "n-s-s-s-s", "n-s-s-s-s", "n-s-s-s-s");
const BACKBEAT_SNARE = measure(null, "n-quarter", null, "n-quarter");
const KICK_1_AND_3 = measure("n-quarter", null, "n-quarter", null);
const CRASH_BEAT1 = measure("n-quarter", null, null, null);
// Shuffle/swing feel: hit - skip the middle triplet partial - hit. The
// backbone of the shuffle groove in Lesson 16.
const SHUFFLE_TILE = custom(N("eighthTriplet"), R("eighthTriplet"), N("eighthTriplet"));
const SHUFFLE_HIHAT = measure(SHUFFLE_TILE, SHUFFLE_TILE, SHUFFLE_TILE, SHUFFLE_TILE);
// The train beat's "chugga-chugga" feel: an accented downbeat eighth
// followed by a normal-velocity "and" — real per-hit dynamics (see
// rhythm.ts's HitAccent), not just two identical eighth notes.
const TRAIN_TILE = custom(N("eighth", "accent"), N("eighth"));
const TRAIN_SNARE = measure(TRAIN_TILE, TRAIN_TILE, TRAIN_TILE, TRAIN_TILE);
// A single ghost hit on the last sixteenth ("a") of a beat — real per-hit
// dynamics (see rhythm.ts's HitAccent), not a separate quiet line. Paired
// with a normal backbeat quarter on the beats in between, this is the
// stock "ghost note before the backbeat" pattern used in Lessons 12 and 17.
const GHOST_TAIL = custom(R("sixteenth"), R("sixteenth"), R("sixteenth"), N("sixteenth", "ghost"));
const GHOST_BACKBEAT_SNARE = measure(GHOST_TAIL, "n-quarter", GHOST_TAIL, "n-quarter");

// --- Additional building blocks for Lessons 51-100 -------------------------

// Reggae-style "skank": nothing on the downbeat, a single hit on every
// off-beat "and" — see Lesson 51.
const OFFBEAT_EIGHTH = custom(R("eighth"), N("eighth"));
const OFFBEAT_SKANK = measure(OFFBEAT_EIGHTH, OFFBEAT_EIGHTH, OFFBEAT_EIGHTH, OFFBEAT_EIGHTH);

// Three ghost hits packed into one beat, leaving only the second sixteenth
// silent — a denser cousin of GHOST_TAIL for Lesson 58's "cascade" and
// Lesson 86's kick-ostinato pairing.
const GHOST_CASCADE = custom(N("sixteenth", "ghost"), N("sixteenth", "ghost"), R("sixteenth"), N("sixteenth", "ghost"));
const GHOST_CASCADE_SNARE = measure(GHOST_CASCADE, "n-quarter", GHOST_CASCADE, "n-quarter");

// A continuous sixteenth-note kick with the accent alternating hit-to-hit —
// approximates the alternating-foot emphasis of a double-bass-pedal player,
// reused in Lessons 55 and 91.
const DOUBLE_KICK_ALT = measure(
  custom(N("sixteenth", "accent"), N("sixteenth"), N("sixteenth", "accent"), N("sixteenth")),
  custom(N("sixteenth"), N("sixteenth", "accent"), N("sixteenth"), N("sixteenth", "accent")),
  custom(N("sixteenth", "accent"), N("sixteenth"), N("sixteenth", "accent"), N("sixteenth")),
  custom(N("sixteenth"), N("sixteenth", "accent"), N("sixteenth"), N("sixteenth", "accent"))
);

// A one-bar snare fill that ramps from all-ghost to all-accent across the
// four beats — Lesson 59's dynamic crescendo, also used in Lesson 60.
const CRESCENDO_SNARE_FILL: StoredLine[] = [
  line(
    "snare",
    measure(
      custom(N("sixteenth", "ghost"), N("sixteenth", "ghost"), N("sixteenth", "ghost"), N("sixteenth", "ghost")),
      custom(N("sixteenth", "ghost"), N("sixteenth"), N("sixteenth"), N("sixteenth")),
      custom(N("sixteenth"), N("sixteenth"), N("sixteenth", "accent"), N("sixteenth")),
      custom(N("sixteenth", "accent"), N("sixteenth", "accent"), N("sixteenth", "accent"), N("sixteenth", "accent"))
    )
  ),
];

// A one-bar fill built entirely from triplet subdivisions instead of
// straight sixteenths — Lesson 61's triplet fill, also used in Lesson 70.
const TRIPLET_FILL: StoredLine[] = [
  line(
    "snare",
    measure(
      custom(N("eighthTriplet"), N("eighthTriplet"), N("eighthTriplet")),
      custom(N("eighthTriplet"), N("eighthTriplet"), N("eighthTriplet")),
      null,
      null
    )
  ),
  line("highTom", measure(null, null, custom(N("eighthTriplet"), N("eighthTriplet"), N("eighthTriplet")), null)),
  line("lowTom", measure(null, null, null, custom(N("eighthTriplet"), N("eighthTriplet"), N("eighthTriplet")))),
];

// Reused across several lessons from 11 on, same way a working drummer reuses
// a small vocabulary of stock fills across many songs rather than inventing
// a new one every time.
const TOM_RUN_FILL: StoredLine[] = [
  line("highTom", measure("n-quarter", null, null, null)),
  line("midTom", measure(null, "n-quarter", null, null)),
  line("lowTom", measure(null, null, "n-quarter", null)),
  line("snare", measure(null, null, null, "n-quarter")),
];
const EIGHTH_FILL: StoredLine[] = [
  line("hihatClosed", measure("n-e-e", "n-e-e", "n-e-e", null)),
  line("kick", KICK_1_AND_3),
  line("snare", measure(null, "n-quarter", null, "n-e-e")),
];
// The groove keeps playing for the first 3 beats; beat 4 breaks into a
// running sixteenth-note snare roll — see Lessons 17 and 19.
const SIXTEENTH_SNARE_FILL: StoredLine[] = [
  line("hihatClosed", measure("n-e-e", "n-e-e", "n-e-e", null)),
  line("kick", measure("n-quarter", null, "n-quarter", null)),
  line("snare", measure(null, "n-quarter", null, "n-s-s-s-s")),
];

// --- A wider, difficulty-tiered fill vocabulary ----------------------------
// bundle()'s fillC/fillD defaults (TOM_RUN_FILL/EIGHTH_FILL) are fine for a
// handful of early lessons but were getting reused verbatim across dozens of
// lessons that never bothered to override them — every fill sounding like
// plain quarter notes. These give every lesson a fill matched to where it
// sits in the course. Roughly ordered easiest to hardest; see the bundle()
// call sites below for which lesson uses which.
//
// Rudiment approximations: the engine has no true near-zero-duration grace
// note, so a flam (one grace note before the main hit) or drag (two grace
// notes) is approximated as one or two short ghost hits immediately before
// an accented main hit, using the shortest available subdivisions
// (sixteenth or sixteenth-triplet) — a simplification, not a claim of exact
// rudiment timing.

// Tier 2 (~roughly Lessons 10-20): still simple, but more shapes than just
// the default tom-run/eighth fill so this stretch doesn't sound identical
// lesson to lesson.
const TOM_RUN_REVERSE_FILL: StoredLine[] = [
  line("lowTom", measure("n-quarter", null, null, null)),
  line("midTom", measure(null, "n-quarter", null, null)),
  line("highTom", measure(null, null, "n-quarter", null)),
  line("snare", measure(null, null, null, "n-quarter")),
];
const SNARE_BUILD_FILL: StoredLine[] = [line("snare", measure(null, "n-quarter", "n-quarter", "n-e-e"))];
const KICK_SNARE_TRADE_FILL: StoredLine[] = [
  line("kick", measure("n-quarter", null, "n-quarter", null)),
  line("snare", measure(null, "n-quarter", null, "n-e-e")),
];

// Tier 3 (~roughly Lessons 21-35): sixteenth-note-based, single-stroke-roll
// shapes — a steady run of alternating single hits.
const SIXTEENTH_TOM_CASCADE_FILL: StoredLine[] = [
  line("highTom", measure("n-s-s-s-s", null, null, null)),
  line("midTom", measure(null, "n-s-s-s-s", null, null)),
  line("lowTom", measure(null, null, "n-s-s-s-s", null)),
  line("snare", measure(null, null, null, "n-s-s-s-s")),
];
const ALTERNATING_SIXTEENTH_FILL: StoredLine[] = [
  line(
    "snare",
    measure(
      custom(N("sixteenth"), R("sixteenth"), N("sixteenth"), R("sixteenth")),
      custom(N("sixteenth"), R("sixteenth"), N("sixteenth"), R("sixteenth")),
      custom(N("sixteenth"), R("sixteenth"), N("sixteenth"), R("sixteenth")),
      custom(N("sixteenth"), R("sixteenth"), N("sixteenth"), R("sixteenth"))
    )
  ),
  line(
    "highTom",
    measure(
      custom(R("sixteenth"), N("sixteenth"), R("sixteenth"), N("sixteenth")),
      custom(R("sixteenth"), N("sixteenth"), R("sixteenth"), N("sixteenth")),
      custom(R("sixteenth"), N("sixteenth"), R("sixteenth"), N("sixteenth")),
      custom(R("sixteenth"), N("sixteenth"), R("sixteenth"), N("sixteenth"))
    )
  ),
];

// Tier 4 (~roughly Lessons 36-50): rudiment-flavored — flams, drags, and
// roll shapes (see the approximation note above).
const FLAM_ACCENT_FILL: StoredLine[] = [
  line(
    "snare",
    measure(
      custom(N("sixteenth", "ghost"), N("sixteenth", "accent"), R("sixteenth"), R("sixteenth")),
      custom(N("sixteenth", "ghost"), N("sixteenth", "accent"), R("sixteenth"), R("sixteenth")),
      null,
      null
    )
  ),
  line("highTom", measure(null, null, custom(N("sixteenth", "ghost"), N("sixteenth", "accent"), R("sixteenth"), R("sixteenth")), null)),
  line("lowTom", measure(null, null, null, custom(N("sixteenth", "ghost"), N("sixteenth", "accent"), R("sixteenth"), R("sixteenth")))),
];
const DRAG_TAP_CELL = custom(
  N("sixteenthTriplet", "ghost"),
  N("sixteenthTriplet", "ghost"),
  N("sixteenthTriplet", "accent"),
  R("sixteenthTriplet"),
  R("sixteenthTriplet"),
  R("sixteenthTriplet")
);
const DRAG_TAP_FILL: StoredLine[] = [
  line("snare", measure(DRAG_TAP_CELL, null, DRAG_TAP_CELL, null)),
  line("highTom", measure(null, DRAG_TAP_CELL, null, null)),
  line("lowTom", measure(null, null, null, DRAG_TAP_CELL)),
];
const FIVE_STROKE_ROLL_FILL: StoredLine[] = [
  line(
    "snare",
    measure("n-s-s-s-s", custom(N("sixteenth"), N("sixteenth"), N("sixteenth"), N("sixteenth", "accent")), null, null)
  ),
  line("highTom", measure(null, null, "n-s-s-s-s", null)),
  line("lowTom", measure(null, null, null, custom(N("sixteenth"), N("sixteenth"), N("sixteenth"), N("sixteenth", "accent")))),
];
const DOUBLE_STROKE_ROLL_TOM_FILL: StoredLine[] = [
  line(
    "highTom",
    measure(
      custom(N("sixteenth"), N("sixteenth", "ghost"), R("sixteenth"), R("sixteenth")),
      custom(R("sixteenth"), R("sixteenth"), N("sixteenth"), N("sixteenth", "ghost")),
      null,
      null
    )
  ),
  line(
    "midTom",
    measure(
      null,
      null,
      custom(N("sixteenth"), N("sixteenth", "ghost"), R("sixteenth"), R("sixteenth")),
      custom(R("sixteenth"), R("sixteenth"), N("sixteenth"), N("sixteenth", "ghost"))
    )
  ),
  line("snare", measure(null, null, null, custom(N("sixteenth", "accent"), R("sixteenth"), R("sixteenth"), R("sixteenth")))),
];

// Tier 5 (~roughly Lessons 51-70): triplet-based and linear fills (see
// TRIPLET_FILL/CRESCENDO_SNARE_FILL above too) — no two limbs ever land on
// the same sixteenth-note slot in the linear one.
const LINEAR_SIXTEENTH_FILL: StoredLine[] = [
  line("kick", measure(custom(N("sixteenth"), R("sixteenth"), R("sixteenth"), R("sixteenth")), null, custom(N("sixteenth"), R("sixteenth"), R("sixteenth"), R("sixteenth")), null)),
  line("snare", measure(custom(R("sixteenth"), N("sixteenth"), R("sixteenth"), R("sixteenth")), null, custom(R("sixteenth"), N("sixteenth"), R("sixteenth"), R("sixteenth")), null)),
  line("highTom", measure(null, custom(N("sixteenth"), R("sixteenth"), R("sixteenth"), R("sixteenth")), null, custom(N("sixteenth"), R("sixteenth"), R("sixteenth"), R("sixteenth")))),
  line("lowTom", measure(null, custom(R("sixteenth"), N("sixteenth"), R("sixteenth"), R("sixteenth")), null, custom(R("sixteenth"), N("sixteenth"), R("sixteenth"), R("sixteenth")))),
];
const PARADIDDLE_FILL: StoredLine[] = [
  line(
    "snare",
    measure(
      custom(N("sixteenth", "accent"), N("sixteenth"), N("sixteenth"), N("sixteenth")),
      custom(N("sixteenth"), N("sixteenth", "accent"), N("sixteenth"), N("sixteenth")),
      null,
      null
    )
  ),
  line("highTom", measure(null, null, custom(N("sixteenth", "accent"), N("sixteenth"), N("sixteenth"), N("sixteenth")), null)),
  line("lowTom", measure(null, null, null, custom(N("sixteenth"), N("sixteenth", "accent"), N("sixteenth"), N("sixteenth")))),
];

// Tier 6 (~roughly Lessons 71-90): combined techniques, dynamics shaping,
// and the full kit rather than just snare/toms.
const SIXTEENTH_TRIPLET_CELL = custom(
  N("sixteenthTriplet"),
  N("sixteenthTriplet"),
  N("sixteenthTriplet"),
  N("sixteenthTriplet"),
  N("sixteenthTriplet"),
  N("sixteenthTriplet")
);
const ROLLING_SIXTEENTH_TRIPLET_FILL: StoredLine[] = [
  line("snare", measure(SIXTEENTH_TRIPLET_CELL, null, null, null)),
  line("highTom", measure(null, SIXTEENTH_TRIPLET_CELL, null, null)),
  line("midTom", measure(null, null, SIXTEENTH_TRIPLET_CELL, null)),
  line(
    "lowTom",
    measure(
      null,
      null,
      null,
      custom(
        N("sixteenthTriplet", "accent"),
        N("sixteenthTriplet"),
        N("sixteenthTriplet"),
        N("sixteenthTriplet"),
        N("sixteenthTriplet"),
        N("sixteenthTriplet")
      )
    )
  ),
];
const FULL_KIT_GHOST_TO_ACCENT_TOM_FILL: StoredLine[] = [
  line("highTom", measure(custom(N("sixteenth", "ghost"), N("sixteenth", "ghost"), N("sixteenth", "ghost"), N("sixteenth", "ghost")), null, null, null)),
  line("midTom", measure(null, "n-s-s-s-s", null, null)),
  line("lowTom", measure(null, null, custom(N("sixteenth", "accent"), N("sixteenth"), N("sixteenth"), N("sixteenth")), null)),
  line(
    "snare",
    measure(null, null, null, custom(N("sixteenth", "accent"), N("sixteenth", "accent"), N("sixteenth", "accent"), N("sixteenth", "accent")))
  ),
];

// Tier 7 (~roughly Lessons 91-99): the most advanced fill vocabulary,
// combining triplets, dynamics, and a fast cascade in one bar.
const VIRTUOSO_COMBO_FILL: StoredLine[] = [
  line(
    "snare",
    measure(
      custom(N("eighthTriplet", "ghost"), N("eighthTriplet"), N("eighthTriplet", "accent")),
      custom(N("sixteenthTriplet"), N("sixteenthTriplet"), N("sixteenthTriplet"), N("sixteenthTriplet"), N("sixteenthTriplet"), N("sixteenthTriplet", "accent")),
      null,
      null
    )
  ),
  line("highTom", measure(null, null, custom(N("eighthTriplet", "accent"), N("eighthTriplet"), N("eighthTriplet")), null)),
  line("midTom", measure(null, null, null, custom(N("sixteenth", "accent"), N("sixteenth"), N("sixteenth"), N("sixteenth", "accent")))),
];

// Meter-matched tom-run fills for the odd-meter lessons that were falling
// back to the (4-beat) default fill and going silent past beat 4.
const TOM_RUN_FILL_5: StoredLine[] = [
  line("highTom", measure("n-quarter", null, null, null, null)),
  line("midTom", measure(null, "n-quarter", null, null, null)),
  line("lowTom", measure(null, null, "n-quarter", null, null)),
  line("snare", measure(null, null, null, "n-quarter", "n-quarter")),
];
const TOM_RUN_FILL_6: StoredLine[] = [
  line("highTom", measure("n-quarter", null, null, null, null, null)),
  line("midTom", measure(null, "n-quarter", null, null, null, null)),
  line("lowTom", measure(null, null, "n-quarter", null, null, null)),
  line("snare", measure(null, null, null, "n-quarter", null, "n-quarter")),
];
const TOM_RUN_FILL_7: StoredLine[] = [
  line("highTom", measure("n-quarter", null, null, null, null, null, null)),
  line("midTom", measure(null, "n-quarter", null, null, null, null, null)),
  line("lowTom", measure(null, null, "n-quarter", null, null, null, null)),
  line("snare", measure(null, null, null, "n-quarter", null, null, "n-quarter")),
];

// Meter-matched *second* fills for the odd-meter lessons — these lessons
// already got a meter-matched fillC (above) but were pairing it with a
// plain 4-beat fillD from the tiered vocabulary below, which (per
// computeMeasureLength in src/lib/song.ts) would make that slot loop as a
// short 4-beat pattern instead of matching the lesson's own odd meter.
const SIXTEENTH_TOM_CASCADE_FILL_5: StoredLine[] = [
  line("highTom", measure("n-s-s-s-s", null, null, null, null)),
  line("midTom", measure(null, "n-s-s-s-s", null, null, null)),
  line("lowTom", measure(null, null, "n-s-s-s-s", null, null)),
  line("snare", measure(null, null, null, "n-s-s-s-s", "n-s-s-s-s")),
];
const SIXTEENTH_TOM_CASCADE_FILL_6: StoredLine[] = [
  line("highTom", measure("n-s-s-s-s", null, null, null, null, null)),
  line("midTom", measure(null, "n-s-s-s-s", null, null, null, null)),
  line("lowTom", measure(null, null, "n-s-s-s-s", null, null, null)),
  line("snare", measure(null, null, null, "n-s-s-s-s", null, "n-s-s-s-s")),
];
const SIXTEENTH_TOM_CASCADE_FILL_7: StoredLine[] = [
  line("highTom", measure("n-s-s-s-s", null, null, null, null, null, null)),
  line("midTom", measure(null, "n-s-s-s-s", null, null, null, null, null)),
  line("lowTom", measure(null, null, "n-s-s-s-s", null, null, null, null)),
  line("snare", measure(null, null, null, "n-s-s-s-s", null, null, "n-s-s-s-s")),
];
const EIGHTH_FILL_5: StoredLine[] = [
  line("hihatClosed", measure("n-e-e", "n-e-e", "n-e-e", null, null)),
  line("kick", measure("n-quarter", null, "n-quarter", null, null)),
  line("snare", measure(null, "n-quarter", null, "n-e-e", "n-e-e")),
];
const FLAM_ACCENT_FILL_7: StoredLine[] = [
  line(
    "snare",
    measure(
      custom(N("sixteenth", "ghost"), N("sixteenth", "accent"), R("sixteenth"), R("sixteenth")),
      custom(N("sixteenth", "ghost"), N("sixteenth", "accent"), R("sixteenth"), R("sixteenth")),
      null,
      null,
      null,
      custom(N("sixteenth", "ghost"), N("sixteenth", "accent"), R("sixteenth"), R("sixteenth")),
      custom(N("sixteenth", "ghost"), N("sixteenth", "accent"), R("sixteenth"), R("sixteenth"))
    )
  ),
  line("highTom", measure(null, null, custom(N("sixteenth", "ghost"), N("sixteenth", "accent"), R("sixteenth"), R("sixteenth")), null, null, null, null)),
  line("lowTom", measure(null, null, null, custom(N("sixteenth", "ghost"), N("sixteenth", "accent"), R("sixteenth"), R("sixteenth")), null, null, null)),
  line("midTom", measure(null, null, null, null, custom(N("sixteenth", "ghost"), N("sixteenth", "accent"), R("sixteenth"), R("sixteenth")), null, null)),
];
const FULL_KIT_GHOST_TO_ACCENT_TOM_FILL_6: StoredLine[] = [
  line(
    "highTom",
    measure(
      custom(N("sixteenth", "ghost"), N("sixteenth", "ghost"), N("sixteenth", "ghost"), N("sixteenth", "ghost")),
      custom(N("sixteenth", "ghost"), N("sixteenth", "ghost"), N("sixteenth", "ghost"), N("sixteenth", "ghost")),
      null,
      null,
      null,
      null
    )
  ),
  line("midTom", measure(null, null, "n-s-s-s-s", null, null, null)),
  line("lowTom", measure(null, null, null, custom(N("sixteenth", "accent"), N("sixteenth"), N("sixteenth"), N("sixteenth")), null, null)),
  line(
    "snare",
    measure(
      null,
      null,
      null,
      null,
      custom(N("sixteenth", "accent"), N("sixteenth", "accent"), N("sixteenth", "accent"), N("sixteenth", "accent")),
      custom(N("sixteenth", "accent"), N("sixteenth", "accent"), N("sixteenth", "accent"), N("sixteenth", "accent"))
    )
  ),
];
const LINEAR_SIXTEENTH_FILL_5: StoredLine[] = [
  line(
    "kick",
    measure(
      custom(N("sixteenth"), R("sixteenth"), R("sixteenth"), R("sixteenth")),
      null,
      custom(N("sixteenth"), R("sixteenth"), R("sixteenth"), R("sixteenth")),
      null,
      custom(N("sixteenth"), R("sixteenth"), R("sixteenth"), R("sixteenth"))
    )
  ),
  line(
    "snare",
    measure(
      custom(R("sixteenth"), N("sixteenth"), R("sixteenth"), R("sixteenth")),
      null,
      custom(R("sixteenth"), N("sixteenth"), R("sixteenth"), R("sixteenth")),
      null,
      custom(R("sixteenth"), N("sixteenth"), R("sixteenth"), R("sixteenth"))
    )
  ),
  line(
    "highTom",
    measure(
      null,
      custom(N("sixteenth"), R("sixteenth"), R("sixteenth"), R("sixteenth")),
      null,
      custom(N("sixteenth"), R("sixteenth"), R("sixteenth"), R("sixteenth")),
      null
    )
  ),
  line(
    "lowTom",
    measure(
      null,
      custom(R("sixteenth"), N("sixteenth"), R("sixteenth"), R("sixteenth")),
      null,
      custom(R("sixteenth"), N("sixteenth"), R("sixteenth"), R("sixteenth")),
      null
    )
  ),
];
const CRESCENDO_SNARE_FILL_5: StoredLine[] = [
  line(
    "snare",
    measure(
      custom(N("sixteenth", "ghost"), N("sixteenth", "ghost"), N("sixteenth", "ghost"), N("sixteenth", "ghost")),
      custom(N("sixteenth", "ghost"), N("sixteenth", "ghost"), N("sixteenth"), N("sixteenth")),
      custom(N("sixteenth"), N("sixteenth"), N("sixteenth"), N("sixteenth")),
      custom(N("sixteenth"), N("sixteenth"), N("sixteenth", "accent"), N("sixteenth")),
      custom(N("sixteenth", "accent"), N("sixteenth", "accent"), N("sixteenth", "accent"), N("sixteenth", "accent"))
    )
  ),
];

// The standard shape for Lessons 11-30: a verse (A) and a busier/accented
// chorus (B) doing most of the work, with two fills (C, D) used sparingly —
// 6 of 8 steps below are groove, 2 are fill, matching Lesson 10's ~75/25 mix.
function standardSteps(n: number): { id: string; slot: SlotLetterLocal }[] {
  const seq: SlotLetterLocal[] = ["A", "A", "B", "A", "C", "A", "B", "D"];
  return seq.map((s, i) => ({ id: `step-l${n}-${i + 1}`, slot: s }));
}

type SlotLetterLocal = "A" | "B" | "C" | "D";

function bundle(
  n: number,
  bpm: number,
  verse: StoredLine[],
  chorus: StoredLine[],
  fillC: StoredLine[] = TOM_RUN_FILL,
  fillD: StoredLine[] = EIGHTH_FILL,
  steps: { id: string; slot: SlotLetterLocal }[] = standardSteps(n)
): Pick<LessonSeed, "slotA" | "slotB" | "slotC" | "slotD" | "stack"> {
  return {
    slotA: slot(bpm, verse),
    slotB: slot(bpm, chorus),
    slotC: slot(bpm, fillC),
    slotD: slot(bpm, fillD),
    stack: { bpm, steps, kitOverride: null },
  };
}

// --- Additional building blocks for Lessons 1-9 ----------------------------
// These lessons teach one idea at a time, so B/C/D stay proportionally
// simple: small dynamic (accent) or spacing variations on that lesson's own
// idea, not new instruments or concepts pulled forward from later lessons.

const HIHAT_QUARTERS_ACCENT_1 = measure(custom(N("quarter", "accent")), "n-quarter", "n-quarter", "n-quarter");
const HIHAT_QUARTERS_ACCENT_1_3 = measure(
  custom(N("quarter", "accent")),
  "n-quarter",
  custom(N("quarter", "accent")),
  "n-quarter"
);
const HIHAT_QUARTERS_DROP_4 = measure("n-quarter", "n-quarter", "n-quarter", null);

const BACKBEAT_SNARE_ACCENT = measure(null, custom(N("quarter", "accent")), null, custom(N("quarter", "accent")));
const BACKBEAT_SNARE_BEAT2_ONLY = measure(null, "n-quarter", null, null);

const KICK_1_AND_3_ACCENT = measure(custom(N("quarter", "accent")), null, custom(N("quarter", "accent")), null);
const KICK_QUARTERS_ACCENT_ALT = measure(
  custom(N("quarter", "accent")),
  "n-quarter",
  custom(N("quarter", "accent")),
  "n-quarter"
);
const KICK_SYNCOPATED_BOTH = measure("n-quarter", "r-e-e-2", "n-quarter", "r-e-e-2");

const HIHAT_EIGHTHS_GHOST_OFFBEAT = measure(
  custom(N("eighth"), N("eighth", "ghost")),
  custom(N("eighth"), N("eighth", "ghost")),
  custom(N("eighth"), N("eighth", "ghost")),
  custom(N("eighth"), N("eighth", "ghost"))
);

// Beat where the closed hat plays only the downbeat eighth and the open hat
// rings the "and" — paired cells used together in Lesson 7's variations.
const HIHAT_CLOSED_OPEN_ON_AND = custom(N("eighth"), R("eighth"));
const HIHAT_OPEN_ACCENT_AND = custom(R("eighth"), N("eighth", "accent"));

const TOM_RUN_FILL_ACCENTED: StoredLine[] = [
  line("highTom", measure("n-quarter", null, null, null)),
  line("midTom", measure(null, "n-quarter", null, null)),
  line("lowTom", measure(null, null, "n-quarter", null)),
  line("snare", measure(null, null, null, custom(N("quarter", "accent")))),
];
const TOM_RUN_FILL_EIGHTHS: StoredLine[] = [
  line("highTom", measure("n-e-e", null, null, null)),
  line("midTom", measure(null, "n-e-e", null, null)),
  line("lowTom", measure(null, null, "n-e-e", null)),
  line("snare", measure(null, null, null, "n-e-e")),
];

const EIGHTH_FILL_ACCENTED: StoredLine[] = [
  line("hihatClosed", measure("n-e-e", "n-e-e", "n-e-e", null)),
  line("kick", KICK_1_AND_3),
  line("snare", measure(null, "n-quarter", null, custom(N("eighth", "accent"), N("eighth")))),
];
const EIGHTH_FILL_TOM_TAG: StoredLine[] = [
  line("hihatClosed", measure("n-e-e", "n-e-e", "n-e-e", null)),
  line("kick", KICK_1_AND_3),
  line("snare", measure(null, "n-quarter", null, custom(N("eighth"), R("eighth")))),
  line("highTom", measure(null, null, null, custom(R("eighth"), N("eighth")))),
];

const SEEDS: LessonSeed[] = [
  {
    slug: "lesson-1-the-pulse",
    lessonNumber: 1,
    title: "Find the Pulse",
    teaches: "Steady quarter notes on the hi-hat.",
    slotA: slot(76, [line("hihatClosed", HIHAT_QUARTERS)]),
    slotB: slot(76, [line("hihatClosed", HIHAT_QUARTERS_ACCENT_1)]),
    slotC: slot(76, [line("hihatClosed", HIHAT_QUARTERS_ACCENT_1_3)]),
    slotD: slot(76, [line("hihatClosed", HIHAT_QUARTERS_DROP_4)]),
    stack: { bpm: 76, steps: standardSteps(1), kitOverride: null },
  },
  {
    slug: "lesson-2-the-backbeat",
    lessonNumber: 2,
    title: "Add the Backbeat",
    teaches: "Snare on beats 2 and 4.",
    slotA: slot(78, [line("hihatClosed", HIHAT_QUARTERS), line("snare", BACKBEAT_SNARE)]),
    slotB: slot(78, [line("hihatClosed", HIHAT_QUARTERS), line("snare", BACKBEAT_SNARE_ACCENT)]),
    slotC: slot(78, [line("hihatClosed", HIHAT_QUARTERS), line("snare", BACKBEAT_SNARE_BEAT2_ONLY)]),
    slotD: slot(78, [line("hihatClosed", HIHAT_QUARTERS_ACCENT_1), line("snare", BACKBEAT_SNARE_ACCENT)]),
    stack: { bpm: 78, steps: standardSteps(2), kitOverride: null },
  },
  {
    slug: "lesson-3-the-kick",
    lessonNumber: 3,
    title: "Add the Kick",
    teaches: "Bass drum on beats 1 and 3 — the basic rock beat.",
    slotA: slot(80, [
      line("hihatClosed", HIHAT_QUARTERS),
      line("snare", BACKBEAT_SNARE),
      line("kick", KICK_1_AND_3),
    ]),
    slotB: slot(80, [
      line("hihatClosed", HIHAT_QUARTERS),
      line("snare", BACKBEAT_SNARE),
      line("kick", KICK_1_AND_3_ACCENT),
    ]),
    slotC: slot(80, [line("hihatClosed", HIHAT_QUARTERS), line("snare", BACKBEAT_SNARE), line("kick", HIHAT_QUARTERS)]),
    slotD: slot(80, [line("hihatClosed", HIHAT_QUARTERS), line("snare", BACKBEAT_SNARE), line("kick", CRASH_BEAT1)]),
    stack: { bpm: 80, steps: standardSteps(3), kitOverride: null },
  },
  {
    slug: "lesson-4-eighth-note-hihat",
    lessonNumber: 4,
    title: "Eighth-Note Hi-Hat",
    teaches: "Doubling the hi-hat for a driving feel.",
    slotA: slot(84, [
      line("hihatClosed", HIHAT_EIGHTHS),
      line("snare", BACKBEAT_SNARE),
      line("kick", KICK_1_AND_3),
    ]),
    slotB: slot(84, [
      line("hihatClosed", measure(TRAIN_TILE, TRAIN_TILE, TRAIN_TILE, TRAIN_TILE)),
      line("snare", BACKBEAT_SNARE),
      line("kick", KICK_1_AND_3),
    ]),
    slotC: slot(84, [
      line("hihatClosed", HIHAT_EIGHTHS_GHOST_OFFBEAT),
      line("snare", BACKBEAT_SNARE),
      line("kick", KICK_1_AND_3),
    ]),
    slotD: slot(84, [line("hihatClosed", HIHAT_EIGHTHS), line("snare", BACKBEAT_SNARE), line("kick", HIHAT_QUARTERS)]),
    stack: { bpm: 84, steps: standardSteps(4), kitOverride: null },
  },
  {
    slug: "lesson-5-syncopated-kick",
    lessonNumber: 5,
    title: "Syncopate the Kick",
    teaches: "Moving a kick hit onto the off-beat.",
    slotA: slot(88, [
      line("hihatClosed", HIHAT_EIGHTHS),
      line("snare", BACKBEAT_SNARE),
      line("kick", measure("n-quarter", "r-e-e-2", "n-quarter", null)),
    ]),
    slotB: slot(88, [line("hihatClosed", HIHAT_EIGHTHS), line("snare", BACKBEAT_SNARE), line("kick", KICK_SYNCOPATED_BOTH)]),
    slotC: slot(88, [
      line("hihatClosed", HIHAT_EIGHTHS),
      line("snare", BACKBEAT_SNARE_ACCENT),
      line("kick", measure("n-quarter", "r-e-e-2", "n-quarter", null)),
    ]),
    slotD: slot(88, [
      line("hihatClosed", HIHAT_EIGHTHS_GHOST_OFFBEAT),
      line("snare", BACKBEAT_SNARE),
      line("kick", KICK_SYNCOPATED_BOTH),
    ]),
    stack: { bpm: 88, steps: standardSteps(5), kitOverride: null },
  },
  {
    slug: "lesson-6-fast-drive",
    lessonNumber: 6,
    title: "Fast Straight-Eighth Drive",
    teaches: "A driving, uptempo groove with the kick on every beat.",
    slotA: slot(150, [
      line("hihatClosed", HIHAT_EIGHTHS),
      line("snare", BACKBEAT_SNARE),
      line("kick", HIHAT_QUARTERS), // kick on all four quarters, same shape as the hi-hat
    ]),
    slotB: slot(150, [
      line("hihatClosed", HIHAT_EIGHTHS),
      line("snare", BACKBEAT_SNARE),
      line("kick", KICK_QUARTERS_ACCENT_ALT),
    ]),
    slotC: slot(150, [
      line("hihatClosed", measure(TRAIN_TILE, TRAIN_TILE, TRAIN_TILE, TRAIN_TILE)),
      line("snare", BACKBEAT_SNARE),
      line("kick", HIHAT_QUARTERS),
    ]),
    slotD: slot(150, [
      line("hihatClosed", measure(TRAIN_TILE, TRAIN_TILE, TRAIN_TILE, TRAIN_TILE)),
      line("snare", BACKBEAT_SNARE_ACCENT),
      line("kick", KICK_QUARTERS_ACCENT_ALT),
    ]),
    stack: { bpm: 150, steps: standardSteps(6), kitOverride: null },
  },
  {
    slug: "lesson-7-open-hihat",
    lessonNumber: 7,
    title: "Open Hi-Hat Accents",
    teaches: "Opening and closing the hi-hat for a splashy accent.",
    slotA: slot(92, [
      line("hihatClosed", measure("n-e-e", "n-e-e", "n-e-e", "r-e-e")),
      line("hihatOpen", measure(null, null, null, "r-e-e-2")),
      line("snare", BACKBEAT_SNARE),
      line("kick", KICK_1_AND_3),
    ]),
    slotB: slot(92, [
      line("hihatClosed", measure("n-e-e", HIHAT_CLOSED_OPEN_ON_AND, "n-e-e", HIHAT_CLOSED_OPEN_ON_AND)),
      line("hihatOpen", measure(null, HIHAT_OPEN_ACCENT_AND, null, HIHAT_OPEN_ACCENT_AND)),
      line("snare", BACKBEAT_SNARE),
      line("kick", KICK_1_AND_3),
    ]),
    slotC: slot(92, [
      line("hihatClosed", measure("n-e-e", "n-e-e", HIHAT_CLOSED_OPEN_ON_AND, "n-e-e")),
      line("hihatOpen", measure(null, null, HIHAT_OPEN_ACCENT_AND, null)),
      line("snare", BACKBEAT_SNARE),
      line("kick", KICK_1_AND_3),
    ]),
    slotD: slot(92, [
      line("hihatClosed", measure("n-e-e", HIHAT_CLOSED_OPEN_ON_AND, "n-e-e", HIHAT_CLOSED_OPEN_ON_AND)),
      line("hihatOpen", measure(null, HIHAT_OPEN_ACCENT_AND, null, HIHAT_OPEN_ACCENT_AND)),
      line("snare", BACKBEAT_SNARE_ACCENT),
      line("kick", KICK_1_AND_3),
    ]),
    stack: { bpm: 92, steps: standardSteps(7), kitOverride: null },
  },
  {
    slug: "lesson-8-tom-fill",
    lessonNumber: 8,
    title: "Your First Fill: The Tom Run",
    teaches: "A one-bar fill that walks down the toms.",
    slotA: slot(92, [
      line("highTom", measure("n-quarter", null, null, null)),
      line("midTom", measure(null, "n-quarter", null, null)),
      line("lowTom", measure(null, null, "n-quarter", null)),
      line("snare", measure(null, null, null, "n-quarter")),
    ]),
    slotB: slot(92, TOM_RUN_FILL_ACCENTED),
    slotC: slot(92, TOM_RUN_REVERSE_FILL),
    slotD: slot(92, TOM_RUN_FILL_EIGHTHS),
    stack: { bpm: 92, steps: standardSteps(8), kitOverride: null },
  },
  {
    slug: "lesson-9-eighth-fill",
    lessonNumber: 9,
    title: "Eighth-Note Fill",
    teaches: "Breaking just the last beat into a quick snare fill.",
    slotA: slot(92, [
      line("hihatClosed", measure("n-e-e", "n-e-e", "n-e-e", null)),
      line("kick", KICK_1_AND_3),
      line("snare", measure(null, "n-quarter", null, "n-e-e")),
    ]),
    slotB: slot(92, EIGHTH_FILL_ACCENTED),
    slotC: slot(92, SIXTEENTH_SNARE_FILL),
    slotD: slot(92, EIGHTH_FILL_TOM_TAG),
    stack: { bpm: 92, steps: standardSteps(9), kitOverride: null },
  },
  {
    slug: "lesson-10-put-it-together",
    lessonNumber: 10,
    title: "Put It Together",
    teaches: "Verse, chorus, and fills arranged into one song.",
    // A: verse groove (Lesson 3), B: chorus groove (Lesson 6's busier feel,
    // plus a crash for lift), C: tom-run fill (Lesson 8), D: eighth-note fill
    // (Lesson 9). Arranged mostly beats with fills used sparingly (6 of 8
    // steps below are groove, 2 are fill — about 75/25).
    slotA: slot(96, [
      line("hihatClosed", HIHAT_QUARTERS),
      line("snare", BACKBEAT_SNARE),
      line("kick", KICK_1_AND_3),
    ]),
    slotB: slot(96, [
      line("hihatClosed", HIHAT_EIGHTHS),
      line("snare", BACKBEAT_SNARE),
      line("kick", measure("n-quarter", "n-quarter", "n-quarter", "n-quarter")),
      line("crash", measure("n-quarter", null, null, null)),
    ]),
    slotC: slot(96, [
      line("highTom", measure("n-quarter", null, null, null)),
      line("midTom", measure(null, "n-quarter", null, null)),
      line("lowTom", measure(null, null, "n-quarter", null)),
      line("snare", measure(null, null, null, "n-quarter")),
    ]),
    slotD: slot(96, [
      line("hihatClosed", measure("n-e-e", "n-e-e", "n-e-e", null)),
      line("kick", KICK_1_AND_3),
      line("snare", measure(null, "n-quarter", null, "n-e-e")),
    ]),
    stack: {
      bpm: 96,
      steps: [
        { id: stackId(1), slot: "A" },
        { id: stackId(2), slot: "A" },
        { id: stackId(3), slot: "B" },
        { id: stackId(4), slot: "A" },
        { id: stackId(5), slot: "C" },
        { id: stackId(6), slot: "A" },
        { id: stackId(7), slot: "B" },
        { id: stackId(8), slot: "D" },
      ],
      kitOverride: null,
    },
  },

  // --- Lessons 11-30: from here on, every lesson uses all 4 slots (a verse
  // groove in A, a busier/accented chorus in B, and two fills in C/D) plus a
  // Stack arrangement, same shape as Lesson 10's capstone — see bundle()
  // above. ---

  {
    slug: "lesson-11-sixteenth-note-hihat",
    lessonNumber: 11,
    title: "Sixteenth-Note Hi-Hat",
    teaches: "Subdividing the hi-hat into sixteenths for a smoother, busier feel.",
    ...bundle(
      11,
      90,
      [line("hihatClosed", HIHAT_SIXTEENTHS), line("snare", BACKBEAT_SNARE), line("kick", KICK_1_AND_3)],
      [
        line("hihatClosed", HIHAT_SIXTEENTHS),
        line("snare", BACKBEAT_SNARE),
        line("kick", KICK_1_AND_3),
        line("crash", CRASH_BEAT1),
      ]
    ,
      TOM_RUN_REVERSE_FILL,
      SNARE_BUILD_FILL
    ),
  },
  {
    slug: "lesson-12-ghost-notes",
    lessonNumber: 12,
    title: "Ghost Notes",
    teaches: "Quiet snare hits between the backbeat, for texture instead of volume.",
    ...bundle(
      12,
      88,
      [line("hihatClosed", HIHAT_EIGHTHS), line("snare", GHOST_BACKBEAT_SNARE), line("kick", KICK_1_AND_3)],
      [
        line("hihatClosed", HIHAT_EIGHTHS),
        line("snare", GHOST_BACKBEAT_SNARE),
        line("kick", KICK_1_AND_3),
        line("crash", CRASH_BEAT1),
      ]
    ,
      SNARE_BUILD_FILL,
      KICK_SNARE_TRADE_FILL
    ),
  },
  {
    slug: "lesson-13-train-beat",
    lessonNumber: 13,
    title: "The Train Beat",
    teaches: "A driving eighth-note pattern voiced on the snare, with the downbeat of each pair accented for a chugging feel.",
    ...bundle(
      13,
      140,
      [line("snare", TRAIN_SNARE), line("hihatClosed", HIHAT_QUARTERS), line("kick", KICK_1_AND_3)],
      [
        line("snare", TRAIN_SNARE),
        line("hihatClosed", HIHAT_QUARTERS),
        line("kick", KICK_1_AND_3),
        line("crash", CRASH_BEAT1),
      ]
    ,
      KICK_SNARE_TRADE_FILL,
      TOM_RUN_REVERSE_FILL
    ),
  },
  {
    slug: "lesson-14-halftime-groove",
    lessonNumber: 14,
    title: "Halftime Groove",
    teaches: "Moving the snare to just beat 3 for a laid-back, spacious feel.",
    ...bundle(
      14,
      84,
      [
        line("hihatClosed", HIHAT_EIGHTHS),
        line("snare", measure(null, null, "n-quarter", null)),
        line("kick", measure("n-quarter", null, null, null)),
      ],
      [
        line("hihatClosed", HIHAT_EIGHTHS),
        line("snare", measure(null, null, "n-quarter", null)),
        line("kick", measure("n-quarter", null, null, null)),
        line("crash", CRASH_BEAT1),
      ]
    ,
      TOM_RUN_FILL,
      SNARE_BUILD_FILL
    ),
  },
  {
    slug: "lesson-15-double-time-feel",
    lessonNumber: 15,
    title: "Double-Time Feel",
    teaches: "The same basic rock beat, played fast enough to feel like a different gear.",
    ...bundle(
      15,
      160,
      [line("hihatClosed", HIHAT_EIGHTHS), line("snare", BACKBEAT_SNARE), line("kick", KICK_1_AND_3)],
      [
        line("hihatClosed", HIHAT_EIGHTHS),
        line("snare", BACKBEAT_SNARE),
        line("kick", KICK_1_AND_3),
        line("crash", CRASH_BEAT1),
      ]
    ,
      EIGHTH_FILL,
      TOM_RUN_REVERSE_FILL
    ),
  },
  {
    slug: "lesson-16-the-shuffle",
    lessonNumber: 16,
    title: "The Shuffle",
    teaches: "A swung, triplet-based hi-hat feel instead of straight time.",
    ...bundle(
      16,
      100,
      [line("hihatClosed", SHUFFLE_HIHAT), line("snare", BACKBEAT_SNARE), line("kick", KICK_1_AND_3)],
      [
        line("hihatClosed", SHUFFLE_HIHAT),
        line("snare", BACKBEAT_SNARE),
        line("kick", KICK_1_AND_3),
        line("crash", CRASH_BEAT1),
      ],
      [
        line("highTom", measure("n-quarter", null, null, null)),
        line("midTom", measure(null, "n-quarter", null, null)),
        line("lowTom", measure(null, null, "n-quarter", null)),
        line("snare", measure(null, null, null, SHUFFLE_TILE)),
      ],
      EIGHTH_FILL
    ),
  },
  {
    slug: "lesson-17-funk-sixteenth-groove",
    lessonNumber: 17,
    title: "Funk Sixteenth Groove",
    teaches: "Syncopating the kick within a sixteenth-note grid, plus ghost notes.",
    ...bundle(
      17,
      96,
      [
        line("hihatClosed", HIHAT_SIXTEENTHS),
        line(
          "kick",
          measure(
            "n-quarter",
            custom(R("sixteenth"), N("sixteenth"), R("sixteenth"), R("sixteenth")),
            custom(R("sixteenth"), R("sixteenth"), N("sixteenth"), R("sixteenth")),
            null
          )
        ),
        line("snare", GHOST_BACKBEAT_SNARE),
      ],
      [
        line("hihatClosed", HIHAT_SIXTEENTHS),
        line(
          "kick",
          measure(
            "n-quarter",
            custom(R("sixteenth"), N("sixteenth"), R("sixteenth"), R("sixteenth")),
            custom(R("sixteenth"), R("sixteenth"), N("sixteenth"), R("sixteenth")),
            null
          )
        ),
        line("snare", GHOST_BACKBEAT_SNARE),
        line("crash", CRASH_BEAT1),
      ],
      TOM_RUN_FILL,
      SIXTEENTH_SNARE_FILL
    ),
  },
  {
    slug: "lesson-18-linear-fill",
    lessonNumber: 18,
    title: "Linear Fill",
    teaches: "A fill where no two limbs ever hit at the same instant, versus one that stacks hits together.",
    ...bundle(
      18,
      92,
      [line("hihatClosed", HIHAT_EIGHTHS), line("snare", BACKBEAT_SNARE), line("kick", KICK_1_AND_3)],
      [
        line("hihatClosed", HIHAT_EIGHTHS),
        line("snare", BACKBEAT_SNARE),
        line("kick", KICK_1_AND_3),
        line("crash", CRASH_BEAT1),
      ],
      [
        line("hihatClosed", measure("n-e-e", "n-e-e", "n-e-e", null)),
        line("kick", measure("n-quarter", null, "n-quarter", custom(N("sixteenth"), R("sixteenth"), R("sixteenth"), R("sixteenth")))),
        line("snare", measure(null, "n-quarter", null, custom(R("sixteenth"), N("sixteenth"), R("sixteenth"), N("sixteenth")))),
        line("highTom", measure(null, null, null, custom(R("sixteenth"), R("sixteenth"), N("sixteenth"), R("sixteenth")))),
      ],
      [
        line("hihatClosed", measure("n-e-e", "n-e-e", "n-e-e", null)),
        line("kick", measure("n-quarter", null, "n-quarter", custom(N("sixteenth"), R("sixteenth"), R("sixteenth"), R("sixteenth")))),
        line("snare", measure(null, "n-quarter", null, custom(N("sixteenth"), R("sixteenth"), R("sixteenth"), N("sixteenth")))),
      ]
    ),
  },
  {
    slug: "lesson-19-sixteenth-note-fill",
    lessonNumber: 19,
    title: "Sixteenth-Note Fill",
    teaches: "Filling the last beat with a running sixteenth-note cascade instead of quarter notes.",
    ...bundle(
      19,
      96,
      [line("hihatClosed", HIHAT_EIGHTHS), line("snare", BACKBEAT_SNARE), line("kick", KICK_1_AND_3)],
      [
        line("hihatClosed", HIHAT_EIGHTHS),
        line("snare", BACKBEAT_SNARE),
        line("kick", KICK_1_AND_3),
        line("crash", CRASH_BEAT1),
      ],
      SIXTEENTH_SNARE_FILL,
      [
        line("hihatClosed", measure("n-e-e", "n-e-e", "n-e-e", null)),
        line("kick", measure("n-quarter", null, "n-quarter", null)),
        line("highTom", measure(null, null, null, custom(N("sixteenth"), R("sixteenth"), R("sixteenth"), R("sixteenth")))),
        line("midTom", measure(null, null, null, custom(R("sixteenth"), N("sixteenth"), R("sixteenth"), R("sixteenth")))),
        line("lowTom", measure(null, null, null, custom(R("sixteenth"), R("sixteenth"), N("sixteenth"), R("sixteenth")))),
        line("snare", measure(null, "n-quarter", null, custom(R("sixteenth"), R("sixteenth"), R("sixteenth"), N("sixteenth")))),
      ]
    ),
  },
  {
    slug: "lesson-20-crash-into-the-groove",
    lessonNumber: 20,
    title: "Crash Into the Groove",
    teaches: "Using a pickup fill and a crash-plus-kick hit together to mark a new section.",
    ...bundle(
      20,
      96,
      [line("hihatClosed", HIHAT_EIGHTHS), line("snare", BACKBEAT_SNARE), line("kick", KICK_1_AND_3)],
      [
        line("hihatClosed", HIHAT_EIGHTHS),
        line("snare", BACKBEAT_SNARE),
        line("kick", measure("n-quarter", null, "n-quarter", null)),
        line("crash", CRASH_BEAT1),
      ],
      EIGHTH_FILL,
      TOM_RUN_FILL,
      ["A", "A", "C", "B", "B", "A", "D", "B"].map((s, i) => ({ id: `step-l20-${i + 1}`, slot: s as SlotLetterLocal }))
    ),
  },
  {
    slug: "lesson-21-odd-grouping",
    lessonNumber: 21,
    title: "Odd Grouping: 3+3+2",
    teaches: "Splitting a bar of eighth notes into groups of 3+3+2 instead of four even beats.",
    ...bundle(
      21,
      100,
      [
        line("hihatClosed", HIHAT_EIGHTHS),
        line(
          "kick",
          measure(
            custom(N("eighth"), R("eighth")),
            custom(R("eighth"), N("eighth")),
            null,
            custom(N("eighth"), R("eighth"))
          )
        ),
        line("snare", BACKBEAT_SNARE),
      ],
      [
        line("hihatClosed", HIHAT_EIGHTHS),
        line(
          "kick",
          measure(
            custom(N("eighth"), R("eighth")),
            custom(R("eighth"), N("eighth")),
            null,
            custom(N("eighth"), R("eighth"))
          )
        ),
        line("snare", BACKBEAT_SNARE),
        line("crash", CRASH_BEAT1),
      ]
    ,
      SIXTEENTH_TOM_CASCADE_FILL,
      EIGHTH_FILL
    ),
  },
  {
    slug: "lesson-22-the-one-drop",
    lessonNumber: 22,
    title: "The One-Drop",
    teaches: "Landing the kick and snare together on beat 3 instead of spreading them across the bar.",
    ...bundle(
      22,
      84,
      [
        line("kick", measure(null, null, "n-quarter", null)),
        line("snare", measure(null, null, "n-quarter", null)),
        line("hihatClosed", HIHAT_EIGHTHS),
        line("rimshot", measure(null, "n-quarter", null, "n-quarter")),
      ],
      [
        line("kick", measure(null, null, "n-quarter", null)),
        line("snare", measure(null, null, "n-quarter", null)),
        line("hihatClosed", HIHAT_EIGHTHS),
        line("rimshot", measure(null, "n-quarter", null, "n-quarter")),
        line("crash", measure(null, null, "n-quarter", null)),
      ]
    ,
      ALTERNATING_SIXTEENTH_FILL,
      TOM_RUN_REVERSE_FILL
    ),
  },
  {
    slug: "lesson-23-disco-four-on-the-floor",
    lessonNumber: 23,
    title: "Disco Four-on-the-Floor",
    teaches: "Kick on every beat, with the hi-hat opening on each off-beat for color.",
    ...bundle(
      23,
      150,
      [
        line("kick", HIHAT_QUARTERS),
        line("hihatClosed", measure("r-e-e", "r-e-e", "r-e-e", "r-e-e")),
        line("hihatOpen", measure("r-e-e-2", "r-e-e-2", "r-e-e-2", "r-e-e-2")),
        line("snare", BACKBEAT_SNARE),
      ],
      [
        line("kick", HIHAT_QUARTERS),
        line("hihatClosed", measure("r-e-e", "r-e-e", "r-e-e", "r-e-e")),
        line("hihatOpen", measure("r-e-e-2", "r-e-e-2", "r-e-e-2", "r-e-e-2")),
        line("snare", BACKBEAT_SNARE),
        line("crash", CRASH_BEAT1),
      ]
    ,
      TOM_RUN_FILL,
      SIXTEENTH_TOM_CASCADE_FILL
    ),
  },
  {
    slug: "lesson-24-cross-stick-backbeat",
    lessonNumber: 24,
    title: "Cross-Stick Backbeat",
    teaches: "A quieter rimshot backbeat for a verse, opening up to full snare for the chorus.",
    ...bundle(
      24,
      70,
      [line("hihatClosed", HIHAT_QUARTERS), line("rimshot", BACKBEAT_SNARE), line("kick", KICK_1_AND_3)],
      [
        line("hihatClosed", HIHAT_EIGHTHS),
        line("snare", BACKBEAT_SNARE),
        line("kick", KICK_1_AND_3),
        line("crash", CRASH_BEAT1),
      ]
    ,
      EIGHTH_FILL,
      ALTERNATING_SIXTEENTH_FILL
    ),
  },
  {
    slug: "lesson-25-building-dynamics",
    lessonNumber: 25,
    title: "Building Dynamics: Verse to Chorus",
    teaches: "Leaving the snare out entirely in a sparse verse, so the chorus has somewhere to go.",
    ...bundle(
      25,
      92,
      [line("hihatClosed", HIHAT_QUARTERS), line("kick", KICK_1_AND_3)],
      [
        line("hihatClosed", HIHAT_EIGHTHS),
        line("kick", KICK_1_AND_3),
        line("snare", BACKBEAT_SNARE),
        line("crash", CRASH_BEAT1),
      ]
    ,
      SIXTEENTH_TOM_CASCADE_FILL,
      KICK_SNARE_TRADE_FILL
    ),
  },
  {
    slug: "lesson-26-the-big-fill",
    lessonNumber: 26,
    title: "The Big Fill",
    teaches: "A fill that takes over the entire bar, for a bigger moment than a one-beat tom run.",
    ...bundle(
      26,
      92,
      [line("hihatClosed", HIHAT_EIGHTHS), line("snare", BACKBEAT_SNARE), line("kick", KICK_1_AND_3)],
      [
        line("hihatClosed", HIHAT_EIGHTHS),
        line("snare", BACKBEAT_SNARE),
        line("kick", KICK_1_AND_3),
        line("crash", CRASH_BEAT1),
      ],
      TOM_RUN_FILL,
      [
        line("snare", measure("n-e-e", null, null, "n-e-e")),
        line("highTom", measure(null, "n-e-e", null, null)),
        line("lowTom", measure(null, null, "n-e-e", null)),
      ]
    ),
  },
  {
    slug: "lesson-27-sixteenth-note-kick",
    lessonNumber: 27,
    title: "Sixteenth-Note Kick Pattern",
    teaches: "A funk/hip-hop-style kick pattern built from sixteenth-note syncopation.",
    ...bundle(
      27,
      90,
      [
        line("hihatClosed", HIHAT_SIXTEENTHS),
        line(
          "kick",
          measure(
            custom(N("sixteenth"), R("sixteenth"), R("sixteenth"), N("sixteenth")),
            custom(R("sixteenth"), R("sixteenth"), N("sixteenth"), R("sixteenth")),
            "n-quarter",
            null
          )
        ),
        line("snare", BACKBEAT_SNARE),
      ],
      [
        line("hihatClosed", HIHAT_SIXTEENTHS),
        line(
          "kick",
          measure(
            custom(N("sixteenth"), R("sixteenth"), R("sixteenth"), N("sixteenth")),
            custom(R("sixteenth"), R("sixteenth"), N("sixteenth"), R("sixteenth")),
            "n-quarter",
            null
          )
        ),
        line("snare", BACKBEAT_SNARE),
        line("crash", CRASH_BEAT1),
      ],
      SIXTEENTH_SNARE_FILL,
      TOM_RUN_FILL
    ),
  },
  {
    slug: "lesson-28-odd-meter-groove",
    lessonNumber: 28,
    title: "7-Beat Groove",
    teaches: "An asymmetric 3+2+2 grouping across a 7-beat measure, instead of four even beats.",
    ...bundle(
      28,
      100,
      [
        line("hihatClosed", measure("n-quarter", "n-quarter", "n-quarter", "n-quarter", "n-quarter", "n-quarter", "n-quarter")),
        line("kick", measure("n-quarter", null, null, "n-quarter", null, "n-quarter", null)),
        line("snare", measure(null, null, "n-quarter", null, "n-quarter", null, "n-quarter")),
      ],
      [
        line("hihatClosed", measure("n-quarter", "n-quarter", "n-quarter", "n-quarter", "n-quarter", "n-quarter", "n-quarter")),
        line("kick", measure("n-quarter", null, null, "n-quarter", null, "n-quarter", null)),
        line("snare", measure(null, null, "n-quarter", null, "n-quarter", null, "n-quarter")),
        line("crash", measure("n-quarter", null, null, null, null, null, null)),
      ]
    ,
      TOM_RUN_FILL_7,
      SIXTEENTH_TOM_CASCADE_FILL_7
    ),
  },
  {
    slug: "lesson-29-full-arrangement",
    lessonNumber: 29,
    title: "Full Arrangement: Verse, Chorus, Fills",
    teaches: "Combining a halftime verse, a driving chorus, and two fills into one arranged song.",
    ...bundle(
      29,
      96,
      [
        line("hihatClosed", HIHAT_EIGHTHS),
        line("snare", measure(null, null, "n-quarter", null)),
        line("kick", measure("n-quarter", null, null, null)),
      ],
      [
        line("hihatClosed", HIHAT_EIGHTHS),
        line("snare", BACKBEAT_SNARE),
        line("kick", KICK_1_AND_3),
        line("crash", CRASH_BEAT1),
      ],
      TOM_RUN_FILL,
      SIXTEENTH_SNARE_FILL
    ),
  },
  {
    slug: "lesson-30-graduation",
    lessonNumber: 30,
    title: "A Song of Your Own",
    teaches: "Verse, chorus, and bridge grooves plus a fill — everything from this course, in one song.",
    slotA: slot(96, [line("hihatClosed", HIHAT_EIGHTHS), line("snare", BACKBEAT_SNARE), line("kick", KICK_1_AND_3)]),
    slotB: slot(96, [
      line("hihatClosed", HIHAT_EIGHTHS),
      line("snare", BACKBEAT_SNARE),
      line("kick", HIHAT_QUARTERS),
      line("crash", CRASH_BEAT1),
    ]),
    slotC: slot(96, [line("hihatClosed", SHUFFLE_HIHAT), line("snare", BACKBEAT_SNARE), line("kick", KICK_1_AND_3)]),
    slotD: slot(96, TOM_RUN_FILL),
    stack: {
      bpm: 96,
      steps: ["A", "A", "B", "B", "A", "C", "C", "A", "B", "D"].map((s, i) => ({
        id: `step-l30-${i + 1}`,
        slot: s as SlotLetterLocal,
      })),
      kitOverride: null,
    },
  },

  // --- Lessons 31-50: a second, more advanced pass — cross-rhythms, odd
  // meters, genre-inspired feels (samba, songo, afrobeat, second-line —
  // generic public-domain rhythmic vocabulary, not any specific recording),
  // and the accent/ghost dynamics from Lessons 12/13/17 put to more
  // deliberate use. Same shape as Lessons 11-30: all 4 slots plus a Stack. ---

  {
    slug: "lesson-31-paradiddle-groove",
    lessonNumber: 31,
    title: "Paradiddle Groove",
    teaches: "Adapting a sticking pattern (RLRR LRLL) onto hi-hat and snare instead of two hands.",
    ...bundle(
      31,
      100,
      [
        line(
          "hihatClosed",
          measure(
            custom(N("sixteenth", "accent"), R("sixteenth"), N("sixteenth"), N("sixteenth")),
            custom(R("sixteenth"), N("sixteenth"), R("sixteenth"), R("sixteenth")),
            custom(N("sixteenth", "accent"), R("sixteenth"), N("sixteenth"), N("sixteenth")),
            custom(R("sixteenth"), N("sixteenth"), R("sixteenth"), R("sixteenth"))
          )
        ),
        line(
          "snare",
          measure(
            custom(R("sixteenth"), N("sixteenth"), R("sixteenth"), R("sixteenth")),
            custom(N("sixteenth", "accent"), R("sixteenth"), N("sixteenth"), N("sixteenth")),
            custom(R("sixteenth"), N("sixteenth"), R("sixteenth"), R("sixteenth")),
            custom(N("sixteenth", "accent"), R("sixteenth"), N("sixteenth"), N("sixteenth"))
          )
        ),
        line("kick", KICK_1_AND_3),
      ],
      [
        line(
          "hihatClosed",
          measure(
            custom(N("sixteenth", "accent"), R("sixteenth"), N("sixteenth"), N("sixteenth")),
            custom(R("sixteenth"), N("sixteenth"), R("sixteenth"), R("sixteenth")),
            custom(N("sixteenth", "accent"), R("sixteenth"), N("sixteenth"), N("sixteenth")),
            custom(R("sixteenth"), N("sixteenth"), R("sixteenth"), R("sixteenth"))
          )
        ),
        line(
          "snare",
          measure(
            custom(R("sixteenth"), N("sixteenth"), R("sixteenth"), R("sixteenth")),
            custom(N("sixteenth", "accent"), R("sixteenth"), N("sixteenth"), N("sixteenth")),
            custom(R("sixteenth"), N("sixteenth"), R("sixteenth"), R("sixteenth")),
            custom(N("sixteenth", "accent"), R("sixteenth"), N("sixteenth"), N("sixteenth"))
          )
        ),
        line("kick", KICK_1_AND_3),
        line("crash", CRASH_BEAT1),
      ]
    ,
      PARADIDDLE_FILL,
      ALTERNATING_SIXTEENTH_FILL
    ),
  },
  {
    slug: "lesson-32-half-time-shuffle",
    lessonNumber: 32,
    title: "Half-Time Shuffle",
    teaches: "Combining the shuffle feel with a halftime backbeat and a ghost note, all at once.",
    ...bundle(
      32,
      80,
      [
        line("hihatClosed", SHUFFLE_HIHAT),
        line("snare", measure(GHOST_TAIL, null, custom(N("quarter", "accent")), null)),
        line("kick", measure("n-quarter", null, null, null)),
      ],
      [
        line("hihatClosed", SHUFFLE_HIHAT),
        line("snare", measure(GHOST_TAIL, null, custom(N("quarter", "accent")), null)),
        line("kick", measure("n-quarter", null, null, null)),
        line("crash", CRASH_BEAT1),
      ]
    ,
      SIXTEENTH_TOM_CASCADE_FILL,
      TOM_RUN_REVERSE_FILL
    ),
  },
  {
    slug: "lesson-33-displaced-backbeat",
    lessonNumber: 33,
    title: "Displaced Backbeat",
    teaches: "Moving the snare off the downbeat entirely, onto the 'and' of 2 and 4.",
    ...bundle(
      33,
      96,
      [
        line("hihatClosed", HIHAT_EIGHTHS),
        line("snare", measure(null, custom(R("eighth"), N("eighth")), null, custom(R("eighth"), N("eighth")))),
        line("kick", KICK_1_AND_3),
      ],
      [
        line("hihatClosed", HIHAT_EIGHTHS),
        line("snare", measure(null, custom(R("eighth"), N("eighth")), null, custom(R("eighth"), N("eighth")))),
        line("kick", KICK_1_AND_3),
        line("crash", CRASH_BEAT1),
      ]
    ,
      ALTERNATING_SIXTEENTH_FILL,
      EIGHTH_FILL
    ),
  },
  {
    slug: "lesson-34-five-four-groove",
    lessonNumber: 34,
    title: "5/4 Groove",
    teaches: "A 5-beat measure grouped 3+2, instead of the usual 4.",
    ...bundle(
      34,
      100,
      [
        line("hihatClosed", measure("n-quarter", "n-quarter", "n-quarter", "n-quarter", "n-quarter")),
        line("kick", measure("n-quarter", null, null, "n-quarter", null)),
        line("snare", measure(null, null, "n-quarter", null, "n-quarter")),
      ],
      [
        line("hihatClosed", measure("n-quarter", "n-quarter", "n-quarter", "n-quarter", "n-quarter")),
        line("kick", measure("n-quarter", null, null, "n-quarter", null)),
        line("snare", measure(null, null, "n-quarter", null, "n-quarter")),
        line("crash", measure("n-quarter", null, null, null, null)),
      ]
    ,
      TOM_RUN_FILL_5,
      SIXTEENTH_TOM_CASCADE_FILL_5
    ),
  },
  {
    slug: "lesson-35-six-eight-groove",
    lessonNumber: 35,
    title: "6/8 Compound Groove",
    teaches: "A 6-beat measure felt as two big pulses of three, not six even beats.",
    ...bundle(
      35,
      90,
      [
        line("hihatClosed", measure("n-quarter", "n-quarter", "n-quarter", "n-quarter", "n-quarter", "n-quarter")),
        line("kick", measure("n-quarter", null, null, "n-quarter", null, null)),
        line("snare", measure(null, null, null, "n-quarter", null, null)),
      ],
      [
        line("hihatClosed", measure("n-quarter", "n-quarter", "n-quarter", "n-quarter", "n-quarter", "n-quarter")),
        line("kick", measure("n-quarter", null, null, "n-quarter", null, null)),
        line("snare", measure(null, null, null, "n-quarter", null, null)),
        line("crash", measure("n-quarter", null, null, null, null, null)),
      ]
    ,
      TOM_RUN_FILL_6,
      SIXTEENTH_TOM_CASCADE_FILL_6
    ),
  },
  {
    slug: "lesson-36-sixteenth-kick-ostinato",
    lessonNumber: 36,
    title: "Sixteenth-Note Kick Ostinato",
    teaches: "A continuous running sixteenth-note kick pattern underneath the groove, for a heavy, driving feel.",
    ...bundle(
      36,
      130,
      [line("kick", HIHAT_SIXTEENTHS), line("hihatClosed", HIHAT_QUARTERS), line("snare", BACKBEAT_SNARE)],
      [
        line("kick", HIHAT_SIXTEENTHS),
        line("hihatClosed", HIHAT_EIGHTHS),
        line("snare", BACKBEAT_SNARE),
        line("crash", CRASH_BEAT1),
      ]
    ,
      FLAM_ACCENT_FILL,
      TOM_RUN_FILL
    ),
  },
  {
    slug: "lesson-37-ride-cymbal-groove",
    lessonNumber: 37,
    title: "Ride Cymbal Groove",
    teaches: "Moving timekeeping from the hi-hat to the ride cymbal for a more open, washy sound.",
    ...bundle(
      37,
      100,
      [line("ride", HIHAT_EIGHTHS), line("snare", BACKBEAT_SNARE), line("kick", KICK_1_AND_3)],
      [line("ride", HIHAT_EIGHTHS), line("snare", BACKBEAT_SNARE), line("kick", KICK_1_AND_3), line("crash", CRASH_BEAT1)]
    ,
      DOUBLE_STROKE_ROLL_TOM_FILL,
      EIGHTH_FILL
    ),
  },
  {
    slug: "lesson-38-hemiola",
    lessonNumber: 38,
    title: "Hemiola: Grouping in 3s Over a 4-Beat Bar",
    teaches: "Accenting every third eighth note, so a steady 4-beat bar briefly feels like it's in 3.",
    ...bundle(
      38,
      92,
      [
        line(
          "hihatClosed",
          measure(
            custom(N("eighth", "accent"), N("eighth")),
            custom(N("eighth"), N("eighth", "accent")),
            custom(N("eighth"), N("eighth")),
            custom(N("eighth", "accent"), N("eighth"))
          )
        ),
        line("snare", BACKBEAT_SNARE),
        line("kick", KICK_1_AND_3),
      ],
      [
        line(
          "hihatClosed",
          measure(
            custom(N("eighth", "accent"), N("eighth")),
            custom(N("eighth"), N("eighth", "accent")),
            custom(N("eighth"), N("eighth")),
            custom(N("eighth", "accent"), N("eighth"))
          )
        ),
        line("snare", BACKBEAT_SNARE),
        line("kick", KICK_1_AND_3),
        line("crash", CRASH_BEAT1),
      ]
    ,
      FIVE_STROKE_ROLL_FILL,
      FLAM_ACCENT_FILL
    ),
  },
  {
    slug: "lesson-39-groove-from-a-fill",
    lessonNumber: 39,
    title: "Building a Groove From a Fill",
    teaches: "Taking the Lesson 8 tom run's shape and turning it into a sustained groove instead of a one-bar detour.",
    ...bundle(
      39,
      88,
      [
        line("hihatClosed", HIHAT_EIGHTHS),
        line("kick", KICK_1_AND_3),
        line("highTom", measure("n-quarter", null, null, null)),
        line("midTom", measure(null, "n-quarter", null, null)),
        line("lowTom", measure(null, null, "n-quarter", null)),
        line("snare", measure(null, null, null, "n-quarter")),
      ],
      [
        line("hihatClosed", HIHAT_EIGHTHS),
        line("kick", KICK_1_AND_3),
        line("highTom", measure("n-quarter", null, null, null)),
        line("midTom", measure(null, "n-quarter", null, null)),
        line("lowTom", measure(null, null, "n-quarter", null)),
        line("snare", measure(null, null, null, "n-quarter")),
        line("crash", CRASH_BEAT1),
      ]
    ,
      DRAG_TAP_FILL,
      TOM_RUN_REVERSE_FILL
    ),
  },
  {
    slug: "lesson-40-samba-influenced-feel",
    lessonNumber: 40,
    title: "Samba-Influenced Feel",
    teaches: "A two-beat surdo-style kick pattern (downbeat plus a syncopated push) under steady eighths.",
    ...bundle(
      40,
      104,
      [
        line(
          "kick",
          measure("n-quarter", custom(R("eighth"), N("eighth")), "n-quarter", custom(R("eighth"), N("eighth")))
        ),
        line("hihatClosed", HIHAT_EIGHTHS),
        line("rimshot", measure(null, "n-quarter", null, "n-quarter")),
      ],
      [
        line(
          "kick",
          measure("n-quarter", custom(R("eighth"), N("eighth")), "n-quarter", custom(R("eighth"), N("eighth")))
        ),
        line("hihatClosed", HIHAT_EIGHTHS),
        line("rimshot", measure(null, "n-quarter", null, "n-quarter")),
        line("crash", CRASH_BEAT1),
      ]
    ,
      FLAM_ACCENT_FILL,
      SIXTEENTH_TOM_CASCADE_FILL
    ),
  },
  {
    slug: "lesson-41-songo-influenced-groove",
    lessonNumber: 41,
    title: "Songo-Influenced Groove",
    teaches: "A different kick/snare syncopation than the samba feel, both built from the same eighth-note grid.",
    ...bundle(
      41,
      100,
      [
        line("kick", measure("n-quarter", null, custom(R("eighth"), N("eighth")), null)),
        line("snare", measure(null, custom(N("eighth"), R("eighth")), null, "n-quarter")),
        line("hihatClosed", HIHAT_EIGHTHS),
      ],
      [
        line("kick", measure("n-quarter", null, custom(R("eighth"), N("eighth")), null)),
        line("snare", measure(null, custom(N("eighth"), R("eighth")), null, "n-quarter")),
        line("hihatClosed", HIHAT_EIGHTHS),
        line("crash", CRASH_BEAT1),
      ]
    ,
      DOUBLE_STROKE_ROLL_TOM_FILL,
      FIVE_STROKE_ROLL_FILL
    ),
  },
  {
    slug: "lesson-42-afrobeat-influenced-groove",
    lessonNumber: 42,
    title: "Afrobeat-Influenced Groove",
    teaches: "A steady sixteenth-note hi-hat with a syncopated kick and a cross-stick answering on the off-beats.",
    ...bundle(
      42,
      100,
      [
        line("hihatClosed", HIHAT_SIXTEENTHS),
        line(
          "kick",
          measure(
            "n-quarter",
            custom(R("sixteenth"), R("sixteenth"), N("sixteenth"), R("sixteenth")),
            null,
            custom(R("sixteenth"), N("sixteenth"), R("sixteenth"), R("sixteenth"))
          )
        ),
        line("rimshot", measure(custom(R("eighth"), N("eighth")), custom(R("eighth"), N("eighth")), custom(R("eighth"), N("eighth")), custom(R("eighth"), N("eighth")))),
      ],
      [
        line("hihatClosed", HIHAT_SIXTEENTHS),
        line(
          "kick",
          measure(
            "n-quarter",
            custom(R("sixteenth"), R("sixteenth"), N("sixteenth"), R("sixteenth")),
            null,
            custom(R("sixteenth"), N("sixteenth"), R("sixteenth"), R("sixteenth"))
          )
        ),
        line("rimshot", measure(custom(R("eighth"), N("eighth")), custom(R("eighth"), N("eighth")), custom(R("eighth"), N("eighth")), custom(R("eighth"), N("eighth")))),
        line("crash", CRASH_BEAT1),
      ]
    ,
      DRAG_TAP_FILL,
      ALTERNATING_SIXTEENTH_FILL
    ),
  },
  {
    slug: "lesson-43-second-line-groove",
    lessonNumber: 43,
    title: "Second-Line Groove",
    teaches: "A bouncy, syncopated kick-and-snare conversation instead of a fixed backbeat.",
    ...bundle(
      43,
      96,
      [
        line(
          "kick",
          measure("n-quarter", custom(R("eighth"), N("eighth")), null, custom(R("eighth"), N("eighth")))
        ),
        line("snare", measure(null, "n-quarter", custom(N("eighth"), R("eighth")), "n-quarter")),
        line("hihatClosed", HIHAT_EIGHTHS),
      ],
      [
        line(
          "kick",
          measure("n-quarter", custom(R("eighth"), N("eighth")), null, custom(R("eighth"), N("eighth")))
        ),
        line("snare", measure(null, "n-quarter", custom(N("eighth"), R("eighth")), "n-quarter")),
        line("hihatClosed", HIHAT_EIGHTHS),
        line("crash", CRASH_BEAT1),
      ]
    ,
      FIVE_STROKE_ROLL_FILL,
      FLAM_ACCENT_FILL
    ),
  },
  {
    slug: "lesson-44-blast-beat-intro",
    lessonNumber: 44,
    title: "Blast Beat Intro",
    teaches: "Kick, snare, and hi-hat all hitting together on every eighth note, as fast as you can hold it.",
    ...bundle(
      44,
      190,
      [line("kick", HIHAT_EIGHTHS), line("snare", HIHAT_EIGHTHS), line("hihatClosed", HIHAT_EIGHTHS)],
      [line("kick", HIHAT_EIGHTHS), line("snare", HIHAT_EIGHTHS), line("crash", HIHAT_EIGHTHS)]
    ,
      EIGHTH_FILL,
      TOM_RUN_FILL
    ),
  },
  {
    slug: "lesson-45-polyrhythm-4-over-3",
    lessonNumber: 45,
    title: "Polyrhythm: Grouping in 3s Over Sixteenths",
    teaches: "Accenting every third sixteenth note across a steady 4-beat bar, for a rolling cross-rhythm feel.",
    ...bundle(
      45,
      92,
      [
        line(
          "hihatClosed",
          measure(
            custom(N("sixteenth", "accent"), N("sixteenth"), N("sixteenth"), N("sixteenth", "accent")),
            custom(N("sixteenth"), N("sixteenth"), N("sixteenth", "accent"), N("sixteenth")),
            custom(N("sixteenth"), N("sixteenth", "accent"), N("sixteenth"), N("sixteenth")),
            custom(N("sixteenth", "accent"), N("sixteenth"), N("sixteenth"), N("sixteenth", "accent"))
          )
        ),
        line("snare", BACKBEAT_SNARE),
        line("kick", KICK_1_AND_3),
      ],
      [
        line(
          "hihatClosed",
          measure(
            custom(N("sixteenth", "accent"), N("sixteenth"), N("sixteenth"), N("sixteenth", "accent")),
            custom(N("sixteenth"), N("sixteenth"), N("sixteenth", "accent"), N("sixteenth")),
            custom(N("sixteenth"), N("sixteenth", "accent"), N("sixteenth"), N("sixteenth")),
            custom(N("sixteenth", "accent"), N("sixteenth"), N("sixteenth"), N("sixteenth", "accent"))
          )
        ),
        line("snare", BACKBEAT_SNARE),
        line("kick", KICK_1_AND_3),
        line("crash", CRASH_BEAT1),
      ]
    ,
      PARADIDDLE_FILL,
      DOUBLE_STROKE_ROLL_TOM_FILL
    ),
  },
  {
    slug: "lesson-46-odd-time-fill",
    lessonNumber: 46,
    title: "Odd-Time Fill",
    teaches: "A fill built to span a 5-beat measure, matching the 5/4 groove from Lesson 34.",
    ...bundle(
      46,
      100,
      [
        line("hihatClosed", measure("n-quarter", "n-quarter", "n-quarter", "n-quarter", "n-quarter")),
        line("kick", measure("n-quarter", null, null, "n-quarter", null)),
        line("snare", measure(null, null, "n-quarter", null, "n-quarter")),
      ],
      [
        line("hihatClosed", measure("n-quarter", "n-quarter", "n-quarter", "n-quarter", "n-quarter")),
        line("kick", measure("n-quarter", null, null, "n-quarter", null)),
        line("snare", measure(null, null, "n-quarter", null, "n-quarter")),
        line("crash", measure("n-quarter", null, null, null, null)),
      ],
      [
        line("highTom", measure("n-quarter", null, null, null, null)),
        line("midTom", measure(null, "n-quarter", null, null, null)),
        line("lowTom", measure(null, null, "n-quarter", null, null)),
        line("snare", measure(null, null, null, "n-quarter", "n-quarter")),
      ],
      TOM_RUN_FILL_5
    ),
  },
  {
    slug: "lesson-47-dynamics-across-the-groove",
    lessonNumber: 47,
    title: "Dynamics Across the Whole Groove",
    teaches: "Accents and ghost notes on the kick and hi-hat too, not just the snare.",
    ...bundle(
      47,
      92,
      [
        line("hihatClosed", measure(custom(N("eighth", "accent"), N("eighth", "ghost")), "n-e-e", custom(N("eighth", "accent"), N("eighth", "ghost")), "n-e-e")),
        line("snare", GHOST_BACKBEAT_SNARE),
        line("kick", measure("n-quarter", null, custom(N("eighth", "ghost"), N("eighth", "accent")), null)),
      ],
      [
        line("hihatClosed", measure(custom(N("eighth", "accent"), N("eighth", "ghost")), "n-e-e", custom(N("eighth", "accent"), N("eighth", "ghost")), "n-e-e")),
        line("snare", GHOST_BACKBEAT_SNARE),
        line("kick", measure("n-quarter", null, custom(N("eighth", "ghost"), N("eighth", "accent")), null)),
        line("crash", CRASH_BEAT1),
      ]
    ,
      FLAM_ACCENT_FILL,
      DRAG_TAP_FILL
    ),
  },
  {
    slug: "lesson-48-building-an-intro",
    lessonNumber: 48,
    title: "Building an Intro",
    teaches: "A crash-and-tom pickup that leads into the groove, the way a lot of songs actually start.",
    ...bundle(
      48,
      96,
      [line("hihatClosed", HIHAT_EIGHTHS), line("snare", BACKBEAT_SNARE), line("kick", KICK_1_AND_3)],
      [
        line("hihatClosed", HIHAT_EIGHTHS),
        line("snare", BACKBEAT_SNARE),
        line("kick", KICK_1_AND_3),
        line("crash", CRASH_BEAT1),
      ],
      [
        line("highTom", measure(null, null, null, "n-e-e")),
        line("midTom", measure(null, null, null, custom(R("eighth"), N("eighth")))),
        line("crash", measure(null, null, null, null)),
      ],
      TOM_RUN_FILL,
      ["C", "B", "A", "A", "B", "A", "D", "A"].map((s, i) => ({ id: `step-l48-${i + 1}`, slot: s as SlotLetterLocal }))
    ),
  },
  {
    slug: "lesson-49-full-arrangement-advanced",
    lessonNumber: 49,
    title: "Full Arrangement: Advanced",
    teaches: "A shuffle verse, a displaced-backbeat chorus, and two fills arranged into one song.",
    ...bundle(
      49,
      96,
      [line("hihatClosed", SHUFFLE_HIHAT), line("snare", BACKBEAT_SNARE), line("kick", KICK_1_AND_3)],
      [
        line("hihatClosed", HIHAT_EIGHTHS),
        line("snare", measure(null, custom(R("eighth"), N("eighth")), null, custom(R("eighth"), N("eighth")))),
        line("kick", KICK_1_AND_3),
        line("crash", CRASH_BEAT1),
      ],
      TOM_RUN_FILL,
      SIXTEENTH_SNARE_FILL
    ),
  },
  {
    slug: "lesson-50-graduation-two",
    lessonNumber: 50,
    title: "Fifty Lessons In",
    teaches: "A paradiddle-based verse, a samba-influenced bridge, a driving chorus, and a fill — the advanced half, in one song.",
    slotA: slot(100, [
      line(
        "hihatClosed",
        measure(
          custom(N("sixteenth", "accent"), R("sixteenth"), N("sixteenth"), N("sixteenth")),
          custom(R("sixteenth"), N("sixteenth"), R("sixteenth"), R("sixteenth")),
          custom(N("sixteenth", "accent"), R("sixteenth"), N("sixteenth"), N("sixteenth")),
          custom(R("sixteenth"), N("sixteenth"), R("sixteenth"), R("sixteenth"))
        )
      ),
      line("kick", KICK_1_AND_3),
      line("snare", BACKBEAT_SNARE),
    ]),
    slotB: slot(100, [
      line(
        "kick",
        measure("n-quarter", custom(R("eighth"), N("eighth")), "n-quarter", custom(R("eighth"), N("eighth")))
      ),
      line("hihatClosed", HIHAT_EIGHTHS),
      line("rimshot", measure(null, "n-quarter", null, "n-quarter")),
    ]),
    slotC: slot(100, [
      line("hihatClosed", HIHAT_SIXTEENTHS),
      line("kick", HIHAT_QUARTERS),
      line("snare", BACKBEAT_SNARE),
      line("crash", CRASH_BEAT1),
    ]),
    slotD: slot(100, TOM_RUN_FILL),
    stack: {
      bpm: 100,
      steps: ["A", "A", "B", "A", "C", "C", "A", "B", "D", "A"].map((s, i) => ({
        id: `step-l50-${i + 1}`,
        slot: s as SlotLetterLocal,
      })),
      kitOverride: null,
    },
  },

  // --- Lessons 51-100: the advanced back half — exotic-feeling meters within
  // the 7-cell measure limit, more genre vocabulary (reggae, jazz, gospel,
  // metal, breakbeat, clave, bossa — again generic public-domain rhythmic
  // vocabulary, not any specific recording), a wider fill vocabulary
  // (triplet, linear, call-and-response, crescendo), and lessons that
  // deliberately combine two or more earlier ideas at once. Same bundle()
  // shape as Lessons 11-49, with capstone full-arrangement lessons roughly
  // every ten (60, 70, 80, 90, 99) and Lesson 100 as the true finale. ---

  {
    slug: "lesson-51-offbeat-skank-groove",
    lessonNumber: 51,
    title: "Offbeat Skank Groove",
    teaches: "A hi-hat pattern voiced entirely on the off-beat 'and' of each beat, with the kick landing alone on beat 3.",
    ...bundle(
      51,
      78,
      [line("hihatClosed", OFFBEAT_SKANK), line("kick", measure(null, null, "n-quarter", null))],
      [
        line("hihatClosed", OFFBEAT_SKANK),
        line("kick", measure(null, null, "n-quarter", null)),
        line("snare", BACKBEAT_SNARE),
        line("crash", CRASH_BEAT1),
      ]
    ,
      LINEAR_SIXTEENTH_FILL,
      EIGHTH_FILL
    ),
  },
  {
    slug: "lesson-52-jazz-ride-pattern",
    lessonNumber: 52,
    title: "Jazz Ride Pattern",
    teaches: "A swung ride-cymbal ostinato (the 'spang-a-lang' shape) with soft snare comping underneath instead of a fixed backbeat.",
    ...bundle(
      52,
      120,
      [line("ride", SHUFFLE_HIHAT), line("snare", measure(GHOST_TAIL, GHOST_TAIL, GHOST_TAIL, GHOST_TAIL)), line("kick", measure("n-quarter", null, null, null))],
      [
        line("ride", SHUFFLE_HIHAT),
        line("snare", measure(GHOST_TAIL, GHOST_TAIL, GHOST_TAIL, GHOST_TAIL)),
        line("kick", KICK_1_AND_3),
        line("crash", CRASH_BEAT1),
      ]
    ,
      TRIPLET_FILL,
      LINEAR_SIXTEENTH_FILL
    ),
  },
  {
    slug: "lesson-53-waltz-time",
    lessonNumber: 53,
    title: "Waltz Time: Three-Beat Feel",
    teaches: "A 3-beat measure with the bass drum on beat 1 and the hi-hat keeping a gentle three-count, instead of grouping in four.",
    ...bundle(
      53,
      138,
      [line("hihatClosed", measure("n-quarter", "n-quarter", "n-quarter")), line("kick", measure("n-quarter", null, null))],
      [
        line("hihatClosed", measure("n-quarter", "n-quarter", "n-quarter")),
        line("kick", measure("n-quarter", null, null)),
        line("snare", measure(null, null, "n-quarter")),
        line("crash", measure("n-quarter", null, null)),
      ],
      [
        line("highTom", measure("n-quarter", null, null)),
        line("midTom", measure(null, "n-quarter", null)),
        line("snare", measure(null, null, "n-quarter")),
      ],
      [
        line("hihatClosed", measure("n-e-e", "n-e-e", null)),
        line("kick", measure("n-quarter", null, null)),
        line("snare", measure(null, "n-quarter", "n-e-e")),
      ]
    ),
  },
  {
    slug: "lesson-54-gospel-chop-groove",
    lessonNumber: 54,
    title: "Gospel Chop Groove",
    teaches: "A busy, syncopated sixteenth-note kick-and-snare conversation with the hi-hat holding steady eighths on top.",
    ...bundle(
      54,
      100,
      [
        line("hihatClosed", HIHAT_EIGHTHS),
        line("kick", measure("n-quarter", null, custom(N("sixteenth"), R("sixteenth"), N("sixteenth"), R("sixteenth")), null)),
        line("snare", measure(custom(R("sixteenth"), N("sixteenth", "ghost"), R("sixteenth"), N("sixteenth")), "n-quarter", custom(R("sixteenth"), N("sixteenth", "ghost"), R("sixteenth"), N("sixteenth")), "n-quarter")),
      ],
      [
        line("hihatClosed", HIHAT_SIXTEENTHS),
        line("kick", measure("n-quarter", null, custom(N("sixteenth"), R("sixteenth"), N("sixteenth"), R("sixteenth")), null)),
        line("snare", measure(custom(R("sixteenth"), N("sixteenth", "ghost"), R("sixteenth"), N("sixteenth")), "n-quarter", custom(R("sixteenth"), N("sixteenth", "ghost"), R("sixteenth"), N("sixteenth")), "n-quarter")),
        line("crash", CRASH_BEAT1),
      ]
    ,
      PARADIDDLE_FILL,
      TRIPLET_FILL
    ),
  },
  {
    slug: "lesson-55-alternating-double-kick",
    lessonNumber: 55,
    title: "Alternating Double-Kick Feel",
    teaches: "A continuous sixteenth-note kick pattern with alternating accents, the way a double-bass-pedal player alternates emphasis between feet.",
    ...bundle(
      55,
      150,
      [line("kick", DOUBLE_KICK_ALT), line("hihatClosed", HIHAT_QUARTERS), line("snare", BACKBEAT_SNARE)],
      [line("kick", DOUBLE_KICK_ALT), line("hihatClosed", HIHAT_EIGHTHS), line("snare", BACKBEAT_SNARE), line("crash", CRASH_BEAT1)]
    ,
      LINEAR_SIXTEENTH_FILL,
      DOUBLE_STROKE_ROLL_TOM_FILL
    ),
  },
  {
    slug: "lesson-56-breakbeat-groove",
    lessonNumber: 56,
    title: "Breakbeat Groove",
    teaches: "A fast, syncopated kick-and-snare breakbeat pattern lifted off the sixteenth-note grid instead of landing on the obvious beats.",
    ...bundle(
      56,
      165,
      [
        line("hihatClosed", HIHAT_SIXTEENTHS),
        line("kick", measure("n-quarter", null, custom(R("sixteenth"), R("sixteenth"), N("sixteenth"), R("sixteenth")), null)),
        line("snare", measure(null, custom(N("sixteenth"), R("sixteenth"), R("sixteenth"), R("sixteenth")), null, "n-quarter")),
      ],
      [
        line("hihatClosed", HIHAT_SIXTEENTHS),
        line("kick", measure("n-quarter", custom(R("sixteenth"), R("sixteenth"), N("sixteenth"), R("sixteenth")), custom(R("sixteenth"), R("sixteenth"), N("sixteenth"), R("sixteenth")), null)),
        line("snare", measure(null, custom(N("sixteenth"), R("sixteenth"), R("sixteenth"), R("sixteenth")), null, "n-quarter")),
        line("crash", CRASH_BEAT1),
      ]
    ,
      TRIPLET_FILL,
      LINEAR_SIXTEENTH_FILL
    ),
  },
  {
    slug: "lesson-57-clave-influenced-groove",
    lessonNumber: 57,
    title: "Clave-Influenced Groove",
    teaches: "A kick-and-rimshot pattern echoing a generic three-against-two clave shape, spread across the bar instead of a straight backbeat.",
    ...bundle(
      57,
      104,
      [
        line("kick", measure("n-quarter", null, OFFBEAT_EIGHTH, null)),
        line("rimshot", measure(null, custom(N("eighth"), R("eighth")), null, "n-quarter")),
        line("hihatClosed", HIHAT_EIGHTHS),
      ],
      [
        line("kick", measure("n-quarter", null, OFFBEAT_EIGHTH, null)),
        line("rimshot", measure(null, custom(N("eighth"), R("eighth")), null, "n-quarter")),
        line("hihatClosed", HIHAT_EIGHTHS),
        line("crash", CRASH_BEAT1),
      ]
    ,
      PARADIDDLE_FILL,
      FLAM_ACCENT_FILL
    ),
  },
  {
    slug: "lesson-58-funk-ghost-cascade",
    lessonNumber: 58,
    title: "Funk Ghost Cascade",
    teaches: "Multiple ghost notes packed into a single beat on the snare, filling space between sparse kick hits.",
    ...bundle(
      58,
      92,
      [line("snare", GHOST_CASCADE_SNARE), line("hihatClosed", HIHAT_SIXTEENTHS), line("kick", KICK_1_AND_3)],
      [line("snare", GHOST_CASCADE_SNARE), line("hihatClosed", HIHAT_SIXTEENTHS), line("kick", KICK_1_AND_3), line("crash", CRASH_BEAT1)]
    ,
      DRAG_TAP_FILL,
      FIVE_STROKE_ROLL_FILL
    ),
  },
  {
    slug: "lesson-59-dynamic-crescendo-fill",
    lessonNumber: 59,
    title: "Dynamic Crescendo Fill",
    teaches: "A one-bar snare fill that builds from ghost notes to full accents across the bar instead of staying one volume.",
    ...bundle(
      59,
      94,
      [line("hihatClosed", HIHAT_EIGHTHS), line("snare", BACKBEAT_SNARE), line("kick", KICK_1_AND_3)],
      [line("hihatClosed", HIHAT_EIGHTHS), line("snare", BACKBEAT_SNARE), line("kick", KICK_1_AND_3), line("crash", CRASH_BEAT1)],
      CRESCENDO_SNARE_FILL,
      TOM_RUN_FILL
    ),
  },
  {
    slug: "lesson-60-full-arrangement-groove-toolkit",
    lessonNumber: 60,
    title: "Full Arrangement: Groove Toolkit",
    teaches: "Combining a reggae-influenced verse, a gospel-chop chorus, and two contrasting fills into one arranged song.",
    ...bundle(
      60,
      100,
      [line("hihatClosed", OFFBEAT_SKANK), line("kick", measure(null, null, "n-quarter", null))],
      [
        line("hihatClosed", HIHAT_SIXTEENTHS),
        line("kick", KICK_1_AND_3),
        line("snare", GHOST_BACKBEAT_SNARE),
        line("crash", CRASH_BEAT1),
      ],
      TOM_RUN_FILL,
      CRESCENDO_SNARE_FILL
    ),
  },
  {
    slug: "lesson-61-triplet-fill",
    lessonNumber: 61,
    title: "Triplet Fill",
    teaches: "A one-bar fill built entirely from triplet subdivisions instead of straight sixteenths.",
    ...bundle(
      61,
      96,
      [line("hihatClosed", HIHAT_EIGHTHS), line("snare", BACKBEAT_SNARE), line("kick", KICK_1_AND_3)],
      [line("hihatClosed", HIHAT_EIGHTHS), line("snare", BACKBEAT_SNARE), line("kick", KICK_1_AND_3), line("crash", CRASH_BEAT1)],
      TRIPLET_FILL,
      EIGHTH_FILL
    ),
  },
  {
    slug: "lesson-62-cross-rhythm-fill",
    lessonNumber: 62,
    title: "Cross-Rhythm Fill",
    teaches: "A fill that accents every third eighth note across a 4-beat bar, carrying the hemiola idea from Lesson 38 into a fill instead of a groove.",
    ...bundle(
      62,
      96,
      [line("hihatClosed", HIHAT_EIGHTHS), line("snare", BACKBEAT_SNARE), line("kick", KICK_1_AND_3)],
      [line("hihatClosed", HIHAT_EIGHTHS), line("snare", BACKBEAT_SNARE), line("kick", KICK_1_AND_3), line("crash", CRASH_BEAT1)],
      [
        line(
          "snare",
          measure(
            custom(N("eighth", "accent"), N("eighth")),
            custom(N("eighth"), N("eighth", "accent")),
            "n-e-e",
            custom(N("eighth", "accent"), N("eighth"))
          )
        ),
      ],
      TOM_RUN_FILL
    ),
  },
  {
    slug: "lesson-63-five-four-groove-two-three",
    lessonNumber: 63,
    title: "5/4 Groove: 2+3",
    teaches: "The same 5-beat measure as Lesson 34, regrouped 2+3 instead of 3+2 — a different feel from the same meter.",
    ...bundle(
      63,
      100,
      [
        line("hihatClosed", measure("n-quarter", "n-quarter", "n-quarter", "n-quarter", "n-quarter")),
        line("kick", measure("n-quarter", null, "n-quarter", null, null)),
        line("snare", measure(null, "n-quarter", null, null, "n-quarter")),
      ],
      [
        line("hihatClosed", measure("n-quarter", "n-quarter", "n-quarter", "n-quarter", "n-quarter")),
        line("kick", measure("n-quarter", null, "n-quarter", null, null)),
        line("snare", measure(null, "n-quarter", null, null, "n-quarter")),
        line("crash", measure("n-quarter", null, null, null, null)),
      ],
      [
        line("highTom", measure("n-quarter", null, null, null, null)),
        line("midTom", measure(null, "n-quarter", null, null, null)),
        line("lowTom", measure(null, null, "n-quarter", null, null)),
        line("snare", measure(null, null, null, "n-quarter", "n-quarter")),
      ],
      EIGHTH_FILL_5
    ),
  },
  {
    slug: "lesson-64-odd-meter-ghost-notes",
    lessonNumber: 64,
    title: "Odd-Meter Ghost Notes",
    teaches: "A 7-beat measure (grouped 2+2+3) with ghost notes woven between the backbeat hits, combining odd meter and dynamics.",
    ...bundle(
      64,
      108,
      [
        line("hihatClosed", measure("n-quarter", "n-quarter", "n-quarter", "n-quarter", "n-quarter", "n-quarter", "n-quarter")),
        line("kick", measure("n-quarter", null, "n-quarter", null, "n-quarter", null, null)),
        line("snare", measure(GHOST_TAIL, null, GHOST_TAIL, null, null, null, "n-quarter")),
      ],
      [
        line("hihatClosed", measure("n-quarter", "n-quarter", "n-quarter", "n-quarter", "n-quarter", "n-quarter", "n-quarter")),
        line("kick", measure("n-quarter", null, "n-quarter", null, "n-quarter", null, null)),
        line("snare", measure(GHOST_TAIL, null, GHOST_TAIL, null, null, null, "n-quarter")),
        line("crash", measure("n-quarter", null, null, null, null, null, null)),
      ]
    ,
      TOM_RUN_FILL_7,
      FLAM_ACCENT_FILL_7
    ),
  },
  {
    slug: "lesson-65-rudiment-style-march",
    lessonNumber: 65,
    title: "Rudiment-Style March",
    teaches: "A snare pattern using a ghost sixteenth right before each accent to approximate a flam, over a steady quarter-note bass drum march.",
    ...bundle(
      65,
      112,
      [
        line(
          "snare",
          measure(
            custom(N("sixteenth", "ghost"), N("sixteenth", "accent"), R("sixteenth"), R("sixteenth")),
            custom(R("sixteenth"), R("sixteenth"), N("sixteenth", "ghost"), N("sixteenth", "accent")),
            custom(N("sixteenth", "ghost"), N("sixteenth", "accent"), R("sixteenth"), R("sixteenth")),
            custom(R("sixteenth"), R("sixteenth"), N("sixteenth", "ghost"), N("sixteenth", "accent"))
          )
        ),
        line("kick", HIHAT_QUARTERS),
      ],
      [
        line(
          "snare",
          measure(
            custom(N("sixteenth", "ghost"), N("sixteenth", "accent"), R("sixteenth"), R("sixteenth")),
            custom(R("sixteenth"), R("sixteenth"), N("sixteenth", "ghost"), N("sixteenth", "accent")),
            custom(N("sixteenth", "ghost"), N("sixteenth", "accent"), R("sixteenth"), R("sixteenth")),
            custom(R("sixteenth"), R("sixteenth"), N("sixteenth", "ghost"), N("sixteenth", "accent"))
          )
        ),
        line("kick", HIHAT_QUARTERS),
        line("crash", CRASH_BEAT1),
      ]
    ,
      DRAG_TAP_FILL,
      FIVE_STROKE_ROLL_FILL
    ),
  },
  {
    slug: "lesson-66-cut-time-punk-drive",
    lessonNumber: 66,
    title: "Cut-Time Punk Drive",
    teaches: "A very fast, stripped-down groove with the kick landing on every quarter note and a pushed snare accent into beat 4 — punk and hardcore's forward drive.",
    ...bundle(
      66,
      190,
      [
        line("hihatClosed", HIHAT_EIGHTHS),
        line("kick", HIHAT_QUARTERS),
        line("snare", measure(null, "n-quarter", null, custom(N("eighth", "accent"), N("eighth")))),
      ],
      [
        line("hihatClosed", HIHAT_EIGHTHS),
        line("kick", HIHAT_QUARTERS),
        line("snare", measure(null, "n-quarter", null, custom(N("eighth", "accent"), N("eighth")))),
        line("crash", CRASH_BEAT1),
      ]
    ,
      EIGHTH_FILL,
      KICK_SNARE_TRADE_FILL
    ),
  },
  {
    slug: "lesson-67-displaced-hihat-accents",
    lessonNumber: 67,
    title: "Displaced Hi-Hat Accents",
    teaches: "Accenting the hi-hat on the off-beats instead of the downbeats, while the kick and snare stay put — shifting where the ear locks in without moving the backbeat.",
    ...bundle(
      67,
      100,
      [
        line("hihatClosed", measure(custom(N("eighth"), N("eighth", "accent")), custom(N("eighth"), N("eighth", "accent")), custom(N("eighth"), N("eighth", "accent")), custom(N("eighth"), N("eighth", "accent")))),
        line("kick", KICK_1_AND_3),
        line("snare", BACKBEAT_SNARE),
      ],
      [
        line("hihatClosed", measure(custom(N("eighth"), N("eighth", "accent")), custom(N("eighth"), N("eighth", "accent")), custom(N("eighth"), N("eighth", "accent")), custom(N("eighth"), N("eighth", "accent")))),
        line("kick", KICK_1_AND_3),
        line("snare", BACKBEAT_SNARE),
        line("crash", CRASH_BEAT1),
      ]
    ,
      LINEAR_SIXTEENTH_FILL,
      PARADIDDLE_FILL
    ),
  },
  {
    slug: "lesson-68-tom-voiced-groove",
    lessonNumber: 68,
    title: "Tom-Voiced Groove",
    teaches: "A groove where the toms carry the main rhythm instead of hi-hat and snare, for a tribal, low-end-heavy feel.",
    ...bundle(
      68,
      92,
      [
        line("highTom", measure("n-quarter", null, "n-quarter", null)),
        line("lowTom", measure(null, "n-quarter", null, "n-quarter")),
        line("hihatClosed", HIHAT_EIGHTHS),
        line("kick", KICK_1_AND_3),
      ],
      [
        line("highTom", measure("n-quarter", null, "n-quarter", null)),
        line("lowTom", measure(null, "n-quarter", null, "n-quarter")),
        line("midTom", measure(null, null, null, "n-e-e")),
        line("hihatClosed", HIHAT_EIGHTHS),
        line("kick", KICK_1_AND_3),
        line("crash", CRASH_BEAT1),
      ]
    ,
      SIXTEENTH_TOM_CASCADE_FILL,
      TRIPLET_FILL
    ),
  },
  {
    slug: "lesson-69-sixteenth-note-hihat-opens",
    lessonNumber: 69,
    title: "Sixteenth-Note Hi-Hat Opens",
    teaches: "Opening the hi-hat on select sixteenth-note partials instead of just the eighth-note off-beats, for a busier splash pattern.",
    ...bundle(
      69,
      100,
      [
        line("hihatClosed", measure(custom(N("sixteenth"), N("sixteenth"), R("sixteenth"), N("sixteenth")), custom(N("sixteenth"), N("sixteenth"), R("sixteenth"), N("sixteenth")), custom(N("sixteenth"), N("sixteenth"), R("sixteenth"), N("sixteenth")), custom(N("sixteenth"), N("sixteenth"), R("sixteenth"), N("sixteenth")))),
        line("hihatOpen", measure(custom(R("sixteenth"), R("sixteenth"), N("sixteenth"), R("sixteenth")), custom(R("sixteenth"), R("sixteenth"), N("sixteenth"), R("sixteenth")), custom(R("sixteenth"), R("sixteenth"), N("sixteenth"), R("sixteenth")), custom(R("sixteenth"), R("sixteenth"), N("sixteenth"), R("sixteenth")))),
        line("kick", KICK_1_AND_3),
        line("snare", BACKBEAT_SNARE),
      ],
      [
        line("hihatClosed", measure(custom(N("sixteenth"), N("sixteenth"), R("sixteenth"), N("sixteenth")), custom(N("sixteenth"), N("sixteenth"), R("sixteenth"), N("sixteenth")), custom(N("sixteenth"), N("sixteenth"), R("sixteenth"), N("sixteenth")), custom(N("sixteenth"), N("sixteenth"), R("sixteenth"), N("sixteenth")))),
        line("hihatOpen", measure(custom(R("sixteenth"), R("sixteenth"), N("sixteenth"), R("sixteenth")), custom(R("sixteenth"), R("sixteenth"), N("sixteenth"), R("sixteenth")), custom(R("sixteenth"), R("sixteenth"), N("sixteenth"), R("sixteenth")), custom(R("sixteenth"), R("sixteenth"), N("sixteenth"), R("sixteenth")))),
        line("kick", KICK_1_AND_3),
        line("snare", BACKBEAT_SNARE),
        line("crash", CRASH_BEAT1),
      ]
    ,
      TRIPLET_FILL,
      LINEAR_SIXTEENTH_FILL
    ),
  },
  {
    slug: "lesson-70-full-arrangement-advanced-textures",
    lessonNumber: 70,
    title: "Full Arrangement: Advanced Textures",
    teaches: "Combining a displaced-hi-hat verse, a gospel-chop chorus, and a triplet fill into one arranged song.",
    ...bundle(
      70,
      100,
      [
        line("hihatClosed", measure(custom(N("eighth"), N("eighth", "accent")), custom(N("eighth"), N("eighth", "accent")), custom(N("eighth"), N("eighth", "accent")), custom(N("eighth"), N("eighth", "accent")))),
        line("kick", KICK_1_AND_3),
        line("snare", BACKBEAT_SNARE),
      ],
      [
        line("hihatClosed", HIHAT_SIXTEENTHS),
        line("kick", measure("n-quarter", null, custom(N("sixteenth"), R("sixteenth"), N("sixteenth"), R("sixteenth")), null)),
        line("snare", GHOST_BACKBEAT_SNARE),
        line("crash", CRASH_BEAT1),
      ],
      TRIPLET_FILL,
      SIXTEENTH_SNARE_FILL
    ),
  },
  {
    slug: "lesson-71-half-time-power-ballad",
    lessonNumber: 71,
    title: "Half-Time Power Ballad",
    teaches: "A slow half-time groove with a heavily accented backbeat and a sustained crash, the arena-ballad feel.",
    ...bundle(
      71,
      76,
      [line("hihatClosed", HIHAT_EIGHTHS), line("snare", measure(null, null, "n-quarter", null)), line("kick", measure("n-quarter", null, null, null))],
      [
        line("hihatClosed", HIHAT_EIGHTHS),
        line("snare", measure(null, null, custom(N("quarter", "accent")), null)),
        line("kick", measure("n-quarter", null, null, null)),
        line("crash", CRASH_BEAT1),
      ]
    ,
      CRESCENDO_SNARE_FILL,
      FULL_KIT_GHOST_TO_ACCENT_TOM_FILL
    ),
  },
  {
    slug: "lesson-72-funk-groove-hihat-splashes",
    lessonNumber: 72,
    title: "Funk Groove with Hi-Hat Splashes",
    teaches: "Layering open hi-hat splashes onto a syncopated sixteenth-note funk kick pattern.",
    ...bundle(
      72,
      98,
      [
        line("hihatClosed", HIHAT_SIXTEENTHS),
        line("kick", measure("n-quarter", custom(R("sixteenth"), R("sixteenth"), N("sixteenth"), R("sixteenth")), null, custom(N("sixteenth"), R("sixteenth"), R("sixteenth"), R("sixteenth")))),
        line("snare", GHOST_BACKBEAT_SNARE),
        line("hihatOpen", measure(null, null, OFFBEAT_EIGHTH, null)),
      ],
      [
        line("hihatClosed", HIHAT_SIXTEENTHS),
        line("kick", measure("n-quarter", custom(R("sixteenth"), R("sixteenth"), N("sixteenth"), R("sixteenth")), null, custom(N("sixteenth"), R("sixteenth"), R("sixteenth"), R("sixteenth")))),
        line("snare", GHOST_BACKBEAT_SNARE),
        line("hihatOpen", measure(null, null, OFFBEAT_EIGHTH, OFFBEAT_EIGHTH)),
        line("crash", CRASH_BEAT1),
      ]
    ,
      ROLLING_SIXTEENTH_TRIPLET_FILL,
      FULL_KIT_GHOST_TO_ACCENT_TOM_FILL
    ),
  },
  {
    slug: "lesson-73-alternating-blast-beat",
    lessonNumber: 73,
    title: "Alternating Blast Beat",
    teaches: "A blast beat where kick and snare alternate every eighth note instead of hitting together, for a different kind of relentless drive.",
    ...bundle(
      73,
      190,
      [
        line("kick", measure(custom(N("eighth"), R("eighth")), custom(N("eighth"), R("eighth")), custom(N("eighth"), R("eighth")), custom(N("eighth"), R("eighth")))),
        line("snare", measure(OFFBEAT_EIGHTH, OFFBEAT_EIGHTH, OFFBEAT_EIGHTH, OFFBEAT_EIGHTH)),
        line("hihatClosed", HIHAT_EIGHTHS),
      ],
      [
        line("kick", measure(custom(N("eighth"), R("eighth")), custom(N("eighth"), R("eighth")), custom(N("eighth"), R("eighth")), custom(N("eighth"), R("eighth")))),
        line("snare", measure(OFFBEAT_EIGHTH, OFFBEAT_EIGHTH, OFFBEAT_EIGHTH, OFFBEAT_EIGHTH)),
        line("crash", CRASH_BEAT1),
      ]
    ,
      EIGHTH_FILL,
      LINEAR_SIXTEENTH_FILL
    ),
  },
  {
    slug: "lesson-74-bossa-influenced-feel",
    lessonNumber: 74,
    title: "Bossa-Influenced Feel",
    teaches: "A relaxed Latin-adjacent feel with a steady eighth-note hi-hat and a syncopated rimshot pattern, quieter than the samba and songo feels.",
    ...bundle(
      74,
      112,
      [
        line("hihatClosed", HIHAT_EIGHTHS),
        line("rimshot", measure("n-quarter", OFFBEAT_EIGHTH, null, custom(N("eighth"), R("eighth")))),
        line("kick", measure("n-quarter", null, null, null)),
      ],
      [
        line("hihatClosed", HIHAT_EIGHTHS),
        line("rimshot", measure("n-quarter", OFFBEAT_EIGHTH, null, custom(N("eighth"), R("eighth")))),
        line("kick", KICK_1_AND_3),
        line("crash", CRASH_BEAT1),
      ]
    ,
      TRIPLET_FILL,
      CRESCENDO_SNARE_FILL
    ),
  },
  {
    slug: "lesson-75-ride-cymbal-dynamics",
    lessonNumber: 75,
    title: "Ride Cymbal Dynamics",
    teaches: "Accenting select ride-cymbal hits while keeping the rest at normal volume, the way a bell accent cuts through a ride pattern.",
    ...bundle(
      75,
      108,
      [line("ride", measure(custom(N("eighth", "accent"), N("eighth")), "n-e-e", custom(N("eighth", "accent"), N("eighth")), "n-e-e")), line("snare", BACKBEAT_SNARE), line("kick", KICK_1_AND_3)],
      [
        line("ride", measure(custom(N("eighth", "accent"), N("eighth")), "n-e-e", custom(N("eighth", "accent"), N("eighth")), "n-e-e")),
        line("snare", BACKBEAT_SNARE),
        line("kick", KICK_1_AND_3),
        line("crash", CRASH_BEAT1),
      ]
    ,
      FULL_KIT_GHOST_TO_ACCENT_TOM_FILL,
      PARADIDDLE_FILL
    ),
  },
  {
    slug: "lesson-76-full-bar-linear-fill",
    lessonNumber: 76,
    title: "Full-Bar Linear Fill",
    teaches: "A fill spanning the entire bar where kick, snare, and toms trade sixteenth notes without ever overlapping.",
    ...bundle(
      76,
      100,
      [line("hihatClosed", HIHAT_EIGHTHS), line("snare", BACKBEAT_SNARE), line("kick", KICK_1_AND_3)],
      [line("hihatClosed", HIHAT_EIGHTHS), line("snare", BACKBEAT_SNARE), line("kick", KICK_1_AND_3), line("crash", CRASH_BEAT1)],
      [
        line("kick", measure(custom(N("sixteenth"), R("sixteenth"), R("sixteenth"), R("sixteenth")), null, custom(N("sixteenth"), R("sixteenth"), R("sixteenth"), R("sixteenth")), null)),
        line("snare", measure(custom(R("sixteenth"), N("sixteenth"), R("sixteenth"), R("sixteenth")), null, custom(R("sixteenth"), N("sixteenth"), R("sixteenth"), R("sixteenth")), null)),
        line("highTom", measure(null, custom(N("sixteenth"), R("sixteenth"), R("sixteenth"), R("sixteenth")), null, custom(N("sixteenth"), R("sixteenth"), R("sixteenth"), R("sixteenth")))),
        line("lowTom", measure(null, custom(R("sixteenth"), N("sixteenth"), R("sixteenth"), R("sixteenth")), null, custom(R("sixteenth"), N("sixteenth"), R("sixteenth"), R("sixteenth")))),
      ],
      EIGHTH_FILL
    ),
  },
  {
    slug: "lesson-77-syncopated-ride-groove",
    lessonNumber: 77,
    title: "Syncopated Ride Groove",
    teaches: "A ride-cymbal pattern with the off-beat 'and' dropped out here and there, instead of playing every eighth note evenly.",
    ...bundle(
      77,
      106,
      [line("ride", measure(custom(N("eighth"), R("eighth")), "n-e-e", custom(N("eighth"), R("eighth")), "n-e-e")), line("kick", KICK_1_AND_3), line("snare", BACKBEAT_SNARE)],
      [
        line("ride", measure(custom(N("eighth"), R("eighth")), "n-e-e", custom(N("eighth"), R("eighth")), "n-e-e")),
        line("kick", KICK_1_AND_3),
        line("snare", BACKBEAT_SNARE),
        line("crash", CRASH_BEAT1),
      ]
    ,
      ROLLING_SIXTEENTH_TRIPLET_FILL,
      TRIPLET_FILL
    ),
  },
  {
    slug: "lesson-78-shuffle-in-five",
    lessonNumber: 78,
    title: "Shuffle in Five",
    teaches: "The shuffle's swung triplet hi-hat feel, now stretched across a 5-beat measure instead of 4.",
    ...bundle(
      78,
      96,
      [
        line("hihatClosed", measure(SHUFFLE_TILE, SHUFFLE_TILE, SHUFFLE_TILE, SHUFFLE_TILE, SHUFFLE_TILE)),
        line("kick", measure("n-quarter", null, null, "n-quarter", null)),
        line("snare", measure(null, null, "n-quarter", null, "n-quarter")),
      ],
      [
        line("hihatClosed", measure(SHUFFLE_TILE, SHUFFLE_TILE, SHUFFLE_TILE, SHUFFLE_TILE, SHUFFLE_TILE)),
        line("kick", measure("n-quarter", null, null, "n-quarter", null)),
        line("snare", measure(null, null, "n-quarter", null, "n-quarter")),
        line("crash", measure("n-quarter", null, null, null, null)),
      ]
    ,
      TOM_RUN_FILL_5,
      CRESCENDO_SNARE_FILL_5
    ),
  },
  {
    slug: "lesson-79-groove-that-builds",
    lessonNumber: 79,
    title: "Groove That Builds Within the Bar",
    teaches: "A single groove where the hi-hat itself ramps from ghost to accent across the bar, so the intensity builds without the pattern changing.",
    ...bundle(
      79,
      90,
      [
        line(
          "hihatClosed",
          measure(
            custom(N("sixteenth", "ghost"), N("sixteenth", "ghost"), N("sixteenth", "ghost"), N("sixteenth", "ghost")),
            "n-s-s-s-s",
            custom(N("sixteenth"), N("sixteenth"), N("sixteenth", "accent"), N("sixteenth")),
            custom(N("sixteenth", "accent"), N("sixteenth", "accent"), N("sixteenth", "accent"), N("sixteenth", "accent"))
          )
        ),
        line("snare", BACKBEAT_SNARE),
        line("kick", KICK_1_AND_3),
      ],
      [
        line(
          "hihatClosed",
          measure(
            custom(N("sixteenth", "ghost"), N("sixteenth", "ghost"), N("sixteenth", "ghost"), N("sixteenth", "ghost")),
            "n-s-s-s-s",
            custom(N("sixteenth"), N("sixteenth"), N("sixteenth", "accent"), N("sixteenth")),
            custom(N("sixteenth", "accent"), N("sixteenth", "accent"), N("sixteenth", "accent"), N("sixteenth", "accent"))
          )
        ),
        line("snare", BACKBEAT_SNARE),
        line("kick", KICK_1_AND_3),
        line("crash", measure(null, null, null, "n-quarter")),
      ]
    ,
      FULL_KIT_GHOST_TO_ACCENT_TOM_FILL,
      ROLLING_SIXTEENTH_TRIPLET_FILL
    ),
  },
  {
    slug: "lesson-80-full-arrangement-grooves-in-motion",
    lessonNumber: 80,
    title: "Full Arrangement: Grooves in Motion",
    teaches: "A half-time-ballad verse, a funk chorus with hi-hat splashes, and two fills — the busiest arrangement yet.",
    ...bundle(
      80,
      98,
      [line("hihatClosed", HIHAT_EIGHTHS), line("snare", measure(null, null, "n-quarter", null)), line("kick", measure("n-quarter", null, null, null))],
      [
        line("hihatClosed", HIHAT_SIXTEENTHS),
        line("kick", measure("n-quarter", custom(R("sixteenth"), R("sixteenth"), N("sixteenth"), R("sixteenth")), null, custom(N("sixteenth"), R("sixteenth"), R("sixteenth"), R("sixteenth")))),
        line("snare", GHOST_BACKBEAT_SNARE),
        line("crash", CRASH_BEAT1),
      ]
    ,
      CRESCENDO_SNARE_FILL,
      FULL_KIT_GHOST_TO_ACCENT_TOM_FILL
    ),
  },
  {
    slug: "lesson-81-three-over-two-kick",
    lessonNumber: 81,
    title: "Three-Over-Two Kick Pattern",
    teaches: "A kick pattern that lands every dotted quarter note against a steady straight pulse, a simple polyrhythm you can feel in the feet.",
    ...bundle(
      81,
      100,
      [line("hihatClosed", HIHAT_EIGHTHS), line("kick", measure("n-quarter", OFFBEAT_EIGHTH, null, "n-quarter")), line("snare", BACKBEAT_SNARE)],
      [
        line("hihatClosed", HIHAT_EIGHTHS),
        line("kick", measure("n-quarter", OFFBEAT_EIGHTH, null, "n-quarter")),
        line("snare", BACKBEAT_SNARE),
        line("crash", CRASH_BEAT1),
      ]
    ,
      PARADIDDLE_FILL,
      ROLLING_SIXTEENTH_TRIPLET_FILL
    ),
  },
  {
    slug: "lesson-82-six-eight-bell-pattern",
    lessonNumber: 82,
    title: "6/8 Bell Pattern Feel",
    teaches: "A 6-beat groove with a rimshot outlining a bell-pattern rhythm underneath a steady pulse.",
    ...bundle(
      82,
      92,
      [
        line("hihatClosed", measure("n-quarter", "n-quarter", "n-quarter", "n-quarter", "n-quarter", "n-quarter")),
        line("kick", measure("n-quarter", null, null, "n-quarter", null, null)),
        line("rimshot", measure("n-quarter", null, "n-quarter", null, null, "n-quarter")),
      ],
      [
        line("hihatClosed", measure("n-quarter", "n-quarter", "n-quarter", "n-quarter", "n-quarter", "n-quarter")),
        line("kick", measure("n-quarter", null, null, "n-quarter", null, null)),
        line("rimshot", measure("n-quarter", null, "n-quarter", null, null, "n-quarter")),
        line("crash", measure("n-quarter", null, null, null, null, null)),
      ]
    ,
      TOM_RUN_FILL_6,
      FULL_KIT_GHOST_TO_ACCENT_TOM_FILL_6
    ),
  },
  {
    slug: "lesson-83-snare-led-sixteenth-groove",
    lessonNumber: 83,
    title: "Snare-Led Sixteenth Groove",
    teaches: "A continuous sixteenth-note snare ostinato with the kick only accenting select hits underneath, flipping which instrument leads the groove.",
    ...bundle(
      83,
      100,
      [line("snare", HIHAT_SIXTEENTHS), line("kick", measure("n-quarter", null, custom(R("sixteenth"), R("sixteenth"), N("sixteenth"), R("sixteenth")), null)), line("hihatClosed", HIHAT_QUARTERS)],
      [
        line("snare", HIHAT_SIXTEENTHS),
        line("kick", measure("n-quarter", custom(R("sixteenth"), R("sixteenth"), N("sixteenth"), R("sixteenth")), null, custom(N("sixteenth"), R("sixteenth"), R("sixteenth"), R("sixteenth")))),
        line("hihatClosed", HIHAT_QUARTERS),
        line("crash", CRASH_BEAT1),
      ]
    ,
      DOUBLE_STROKE_ROLL_TOM_FILL,
      ROLLING_SIXTEENTH_TRIPLET_FILL
    ),
  },
  {
    slug: "lesson-84-inverted-accent-groove",
    lessonNumber: 84,
    title: "Inverted Accent Groove",
    teaches: "Accenting the off-beats and ghosting the downbeats on the hi-hat — the reverse of where accents usually land.",
    ...bundle(
      84,
      100,
      [
        line("hihatClosed", measure(custom(N("eighth", "ghost"), N("eighth", "accent")), custom(N("eighth", "ghost"), N("eighth", "accent")), custom(N("eighth", "ghost"), N("eighth", "accent")), custom(N("eighth", "ghost"), N("eighth", "accent")))),
        line("kick", KICK_1_AND_3),
        line("snare", BACKBEAT_SNARE),
      ],
      [
        line("hihatClosed", measure(custom(N("eighth", "ghost"), N("eighth", "accent")), custom(N("eighth", "ghost"), N("eighth", "accent")), custom(N("eighth", "ghost"), N("eighth", "accent")), custom(N("eighth", "ghost"), N("eighth", "accent")))),
        line("kick", KICK_1_AND_3),
        line("snare", BACKBEAT_SNARE),
        line("crash", CRASH_BEAT1),
      ]
    ,
      FLAM_ACCENT_FILL,
      FULL_KIT_GHOST_TO_ACCENT_TOM_FILL
    ),
  },
  {
    slug: "lesson-85-shuffle-feel-fill",
    lessonNumber: 85,
    title: "Shuffle-Feel Fill",
    teaches: "A tom fill built from the shuffle's triplet skip shape instead of straight sixteenths.",
    ...bundle(
      85,
      100,
      [line("hihatClosed", SHUFFLE_HIHAT), line("snare", BACKBEAT_SNARE), line("kick", KICK_1_AND_3)],
      [line("hihatClosed", SHUFFLE_HIHAT), line("snare", BACKBEAT_SNARE), line("kick", KICK_1_AND_3), line("crash", CRASH_BEAT1)],
      [
        line("highTom", measure(SHUFFLE_TILE, null, null, null)),
        line("midTom", measure(null, SHUFFLE_TILE, null, null)),
        line("lowTom", measure(null, null, SHUFFLE_TILE, null)),
        line("snare", measure(null, null, null, SHUFFLE_TILE)),
      ],
      EIGHTH_FILL
    ),
  },
  {
    slug: "lesson-86-kick-ostinato-meets-ghost-snare",
    lessonNumber: 86,
    title: "Kick Ostinato Meets Ghost Snare",
    teaches: "Combining the continuous sixteenth-note kick ostinato from Lesson 36 with a dense ghost-note snare pattern underneath a steady hi-hat.",
    ...bundle(
      86,
      128,
      [line("kick", HIHAT_SIXTEENTHS), line("snare", GHOST_CASCADE_SNARE), line("hihatClosed", HIHAT_QUARTERS)],
      [line("kick", HIHAT_SIXTEENTHS), line("snare", GHOST_CASCADE_SNARE), line("hihatClosed", HIHAT_QUARTERS), line("crash", CRASH_BEAT1)]
    ,
      DRAG_TAP_FILL,
      ROLLING_SIXTEENTH_TRIPLET_FILL
    ),
  },
  {
    slug: "lesson-87-dotted-eighth-loping-feel",
    lessonNumber: 87,
    title: "Dotted-Eighth Loping Feel",
    teaches: "A hi-hat pattern built from dotted-eighth-plus-sixteenth cells instead of straight or swung eighths, for a loping, uneven pulse.",
    ...bundle(
      87,
      96,
      [line("hihatClosed", measure("n-de-s", "n-de-s", "n-de-s", "n-de-s")), line("kick", KICK_1_AND_3), line("snare", BACKBEAT_SNARE)],
      [line("hihatClosed", measure("n-de-s", "n-de-s", "n-de-s", "n-de-s")), line("kick", KICK_1_AND_3), line("snare", BACKBEAT_SNARE), line("crash", CRASH_BEAT1)]
    ,
      TRIPLET_FILL,
      CRESCENDO_SNARE_FILL
    ),
  },
  {
    slug: "lesson-88-sixteenth-cross-stick-groove",
    lessonNumber: 88,
    title: "Sixteenth-Note Cross-Stick Groove",
    teaches: "Moving the quiet cross-stick backbeat from Lesson 24 onto a syncopated sixteenth-note grid instead of a plain quarter-note backbeat.",
    ...bundle(
      88,
      88,
      [
        line("rimshot", measure(custom(R("sixteenth"), N("sixteenth"), R("sixteenth"), R("sixteenth")), custom(R("sixteenth"), R("sixteenth"), N("sixteenth"), R("sixteenth")), custom(N("sixteenth"), R("sixteenth"), R("sixteenth"), R("sixteenth")), custom(R("sixteenth"), R("sixteenth"), R("sixteenth"), N("sixteenth")))),
        line("hihatClosed", HIHAT_EIGHTHS),
        line("kick", KICK_1_AND_3),
      ],
      [
        line("snare", measure(custom(R("sixteenth"), N("sixteenth"), R("sixteenth"), R("sixteenth")), custom(R("sixteenth"), R("sixteenth"), N("sixteenth"), R("sixteenth")), custom(N("sixteenth"), R("sixteenth"), R("sixteenth"), R("sixteenth")), custom(R("sixteenth"), R("sixteenth"), R("sixteenth"), N("sixteenth")))),
        line("hihatClosed", HIHAT_EIGHTHS),
        line("kick", KICK_1_AND_3),
        line("crash", CRASH_BEAT1),
      ]
    ,
      PARADIDDLE_FILL,
      DOUBLE_STROKE_ROLL_TOM_FILL
    ),
  },
  {
    slug: "lesson-89-call-and-response-fill",
    lessonNumber: 89,
    title: "Call-and-Response Fill",
    teaches: "A fill built as a short snare phrase answered by tom phrases, trading back and forth within the bar.",
    ...bundle(
      89,
      96,
      [line("hihatClosed", HIHAT_EIGHTHS), line("snare", BACKBEAT_SNARE), line("kick", KICK_1_AND_3)],
      [line("hihatClosed", HIHAT_EIGHTHS), line("snare", BACKBEAT_SNARE), line("kick", KICK_1_AND_3), line("crash", CRASH_BEAT1)],
      [
        line("snare", measure("n-e-e", null, "n-e-e", null)),
        line("highTom", measure(null, "n-e-e", null, null)),
        line("lowTom", measure(null, null, null, "n-e-e")),
      ],
      EIGHTH_FILL
    ),
  },
  {
    slug: "lesson-90-full-arrangement-polyrhythms-and-ghosts",
    lessonNumber: 90,
    title: "Full Arrangement: Polyrhythms and Ghosts",
    teaches: "A polyrhythmic-kick verse, an inverted-accent chorus, and two fills arranged into one song.",
    ...bundle(
      90,
      100,
      [line("hihatClosed", HIHAT_EIGHTHS), line("kick", measure("n-quarter", OFFBEAT_EIGHTH, null, "n-quarter")), line("snare", BACKBEAT_SNARE)],
      [
        line("hihatClosed", measure(custom(N("eighth", "ghost"), N("eighth", "accent")), custom(N("eighth", "ghost"), N("eighth", "accent")), custom(N("eighth", "ghost"), N("eighth", "accent")), custom(N("eighth", "ghost"), N("eighth", "accent")))),
        line("kick", KICK_1_AND_3),
        line("snare", BACKBEAT_SNARE),
        line("crash", CRASH_BEAT1),
      ]
    ,
      FULL_KIT_GHOST_TO_ACCENT_TOM_FILL,
      ROLLING_SIXTEENTH_TRIPLET_FILL
    ),
  },
  {
    slug: "lesson-91-half-time-double-kick-groove",
    lessonNumber: 91,
    title: "Half-Time Double-Kick Groove",
    teaches: "A half-time backbeat with a continuous sixteenth-note double-kick pattern underneath, instead of a sparse kick.",
    ...bundle(
      91,
      140,
      [line("kick", DOUBLE_KICK_ALT), line("snare", measure(null, null, "n-quarter", null)), line("hihatClosed", HIHAT_EIGHTHS)],
      [
        line("kick", DOUBLE_KICK_ALT),
        line("snare", measure(null, null, custom(N("quarter", "accent")), null)),
        line("hihatClosed", HIHAT_EIGHTHS),
        line("crash", CRASH_BEAT1),
      ]
    ,
      VIRTUOSO_COMBO_FILL,
      ROLLING_SIXTEENTH_TRIPLET_FILL
    ),
  },
  {
    slug: "lesson-92-breakbeat-in-five",
    lessonNumber: 92,
    title: "Breakbeat in Five",
    teaches: "The syncopated breakbeat feel from Lesson 56, now fit into a 5-beat measure instead of straight 4/4.",
    ...bundle(
      92,
      140,
      [
        line("hihatClosed", measure("n-quarter", "n-quarter", "n-quarter", "n-quarter", "n-quarter")),
        line("kick", measure("n-quarter", null, custom(R("sixteenth"), R("sixteenth"), N("sixteenth"), R("sixteenth")), null, "n-quarter")),
        line("snare", measure(null, custom(N("sixteenth"), R("sixteenth"), R("sixteenth"), R("sixteenth")), null, "n-quarter", null)),
      ],
      [
        line("hihatClosed", measure("n-quarter", "n-quarter", "n-quarter", "n-quarter", "n-quarter")),
        line("kick", measure("n-quarter", null, custom(R("sixteenth"), R("sixteenth"), N("sixteenth"), R("sixteenth")), null, "n-quarter")),
        line("snare", measure(null, custom(N("sixteenth"), R("sixteenth"), R("sixteenth"), R("sixteenth")), null, "n-quarter", null)),
        line("crash", measure("n-quarter", null, null, null, null)),
      ]
    ,
      TOM_RUN_FILL_5,
      LINEAR_SIXTEENTH_FILL_5
    ),
  },
  {
    slug: "lesson-93-inverted-paradiddle-groove",
    lessonNumber: 93,
    title: "Inverted Paradiddle Groove",
    teaches: "The paradiddle sticking pattern from Lesson 31, with the two voices swapped — landing the accents in different spots than before.",
    ...bundle(
      93,
      100,
      [
        line(
          "hihatClosed",
          measure(
            custom(R("sixteenth"), N("sixteenth"), R("sixteenth"), R("sixteenth")),
            custom(N("sixteenth", "accent"), R("sixteenth"), N("sixteenth"), N("sixteenth")),
            custom(R("sixteenth"), N("sixteenth"), R("sixteenth"), R("sixteenth")),
            custom(N("sixteenth", "accent"), R("sixteenth"), N("sixteenth"), N("sixteenth"))
          )
        ),
        line(
          "snare",
          measure(
            custom(N("sixteenth", "accent"), R("sixteenth"), N("sixteenth"), N("sixteenth")),
            custom(R("sixteenth"), N("sixteenth"), R("sixteenth"), R("sixteenth")),
            custom(N("sixteenth", "accent"), R("sixteenth"), N("sixteenth"), N("sixteenth")),
            custom(R("sixteenth"), N("sixteenth"), R("sixteenth"), R("sixteenth"))
          )
        ),
        line("kick", KICK_1_AND_3),
      ],
      [
        line(
          "hihatClosed",
          measure(
            custom(R("sixteenth"), N("sixteenth"), R("sixteenth"), R("sixteenth")),
            custom(N("sixteenth", "accent"), R("sixteenth"), N("sixteenth"), N("sixteenth")),
            custom(R("sixteenth"), N("sixteenth"), R("sixteenth"), R("sixteenth")),
            custom(N("sixteenth", "accent"), R("sixteenth"), N("sixteenth"), N("sixteenth"))
          )
        ),
        line(
          "snare",
          measure(
            custom(N("sixteenth", "accent"), R("sixteenth"), N("sixteenth"), N("sixteenth")),
            custom(R("sixteenth"), N("sixteenth"), R("sixteenth"), R("sixteenth")),
            custom(N("sixteenth", "accent"), R("sixteenth"), N("sixteenth"), N("sixteenth")),
            custom(R("sixteenth"), N("sixteenth"), R("sixteenth"), R("sixteenth"))
          )
        ),
        line("kick", KICK_1_AND_3),
        line("crash", CRASH_BEAT1),
      ]
    ,
      VIRTUOSO_COMBO_FILL,
      PARADIDDLE_FILL
    ),
  },
  {
    slug: "lesson-94-independent-limb-dynamics",
    lessonNumber: 94,
    title: "Independent Limb Dynamics",
    teaches: "Accenting the kick at the same instant the snare plays a ghost note, so each limb carries its own dynamic level independently.",
    ...bundle(
      94,
      94,
      [
        line("kick", measure(custom(N("eighth", "accent"), R("eighth")), null, custom(N("eighth", "accent"), R("eighth")), null)),
        line("snare", measure(custom(N("eighth", "ghost"), R("eighth")), "n-quarter", custom(N("eighth", "ghost"), R("eighth")), "n-quarter")),
        line("hihatClosed", HIHAT_EIGHTHS),
      ],
      [
        line("kick", measure(custom(N("eighth", "accent"), R("eighth")), null, custom(N("eighth", "accent"), R("eighth")), null)),
        line("snare", measure(custom(N("eighth", "ghost"), R("eighth")), "n-quarter", custom(N("eighth", "ghost"), R("eighth")), "n-quarter")),
        line("hihatClosed", HIHAT_EIGHTHS),
        line("crash", CRASH_BEAT1),
      ]
    ,
      FULL_KIT_GHOST_TO_ACCENT_TOM_FILL,
      VIRTUOSO_COMBO_FILL
    ),
  },
  {
    slug: "lesson-95-full-triplet-groove",
    lessonNumber: 95,
    title: "Full Triplet Groove",
    teaches: "A groove where kick, snare, and hi-hat all sit on the triplet grid together, not just the hi-hat like the shuffle.",
    ...bundle(
      95,
      118,
      [
        line("hihatClosed", measure(custom(N("eighthTriplet"), N("eighthTriplet"), N("eighthTriplet")), custom(N("eighthTriplet"), N("eighthTriplet"), N("eighthTriplet")), custom(N("eighthTriplet"), N("eighthTriplet"), N("eighthTriplet")), custom(N("eighthTriplet"), N("eighthTriplet"), N("eighthTriplet")))),
        line("kick", measure(custom(N("eighthTriplet"), R("eighthTriplet"), R("eighthTriplet")), null, custom(N("eighthTriplet"), R("eighthTriplet"), R("eighthTriplet")), null)),
        line("snare", measure(null, custom(N("eighthTriplet"), R("eighthTriplet"), R("eighthTriplet")), null, custom(N("eighthTriplet"), R("eighthTriplet"), R("eighthTriplet")))),
      ],
      [
        line("hihatClosed", measure(custom(N("eighthTriplet"), N("eighthTriplet"), N("eighthTriplet")), custom(N("eighthTriplet"), N("eighthTriplet"), N("eighthTriplet")), custom(N("eighthTriplet"), N("eighthTriplet"), N("eighthTriplet")), custom(N("eighthTriplet"), N("eighthTriplet"), N("eighthTriplet")))),
        line("kick", measure(custom(N("eighthTriplet"), R("eighthTriplet"), R("eighthTriplet")), null, custom(N("eighthTriplet"), R("eighthTriplet"), R("eighthTriplet")), null)),
        line("snare", measure(null, custom(N("eighthTriplet"), R("eighthTriplet"), R("eighthTriplet")), null, custom(N("eighthTriplet"), R("eighthTriplet"), R("eighthTriplet")))),
        line("crash", CRASH_BEAT1),
      ]
    ,
      VIRTUOSO_COMBO_FILL,
      TRIPLET_FILL
    ),
  },
  {
    slug: "lesson-96-full-kit-crescendo-fill",
    lessonNumber: 96,
    title: "Full-Kit Crescendo Fill",
    teaches: "A fill where the hi-hat, kick, and snare all ramp from ghost to accent together, for a big buildup into the next section.",
    ...bundle(
      96,
      96,
      [line("hihatClosed", HIHAT_EIGHTHS), line("snare", BACKBEAT_SNARE), line("kick", KICK_1_AND_3)],
      [line("hihatClosed", HIHAT_EIGHTHS), line("snare", BACKBEAT_SNARE), line("kick", KICK_1_AND_3), line("crash", CRASH_BEAT1)],
      [
        line(
          "hihatClosed",
          measure(
            custom(N("sixteenth", "ghost"), N("sixteenth", "ghost"), N("sixteenth", "ghost"), N("sixteenth", "ghost")),
            "n-s-s-s-s",
            custom(N("sixteenth", "accent"), N("sixteenth"), N("sixteenth", "accent"), N("sixteenth")),
            custom(N("sixteenth", "accent"), N("sixteenth", "accent"), N("sixteenth", "accent"), N("sixteenth", "accent"))
          )
        ),
        line("kick", measure(custom(N("sixteenth", "ghost"), R("sixteenth"), R("sixteenth"), R("sixteenth")), null, custom(N("sixteenth", "accent"), R("sixteenth"), R("sixteenth"), R("sixteenth")), "n-quarter")),
        line("snare", measure(null, custom(N("sixteenth", "ghost"), R("sixteenth"), R("sixteenth"), R("sixteenth")), null, custom(N("sixteenth", "accent"), N("sixteenth", "accent"), N("sixteenth", "accent"), N("sixteenth", "accent")))),
        line("crash", measure(null, null, null, "n-quarter")),
      ],
      TOM_RUN_FILL
    ),
  },
  {
    slug: "lesson-97-latin-influenced-ghost-groove",
    lessonNumber: 97,
    title: "Latin-Influenced Ghost Groove",
    teaches: "Layering ghost notes onto the clave-influenced kick-and-rimshot pattern from Lesson 57.",
    ...bundle(
      97,
      104,
      [
        line("kick", measure("n-quarter", null, OFFBEAT_EIGHTH, null)),
        line("rimshot", measure(null, custom(N("eighth"), R("eighth")), null, "n-quarter")),
        line("snare", measure(GHOST_TAIL, null, GHOST_TAIL, null)),
        line("hihatClosed", HIHAT_EIGHTHS),
      ],
      [
        line("kick", measure("n-quarter", null, OFFBEAT_EIGHTH, null)),
        line("rimshot", measure(null, custom(N("eighth"), R("eighth")), null, "n-quarter")),
        line("snare", measure(GHOST_TAIL, null, GHOST_TAIL, null)),
        line("hihatClosed", HIHAT_EIGHTHS),
        line("crash", CRASH_BEAT1),
      ]
    ,
      FLAM_ACCENT_FILL,
      VIRTUOSO_COMBO_FILL
    ),
  },
  {
    slug: "lesson-98-odd-meter-triplet-fill",
    lessonNumber: 98,
    title: "Odd-Meter Triplet Fill",
    teaches: "A fill spanning a 7-beat measure built from triplet subdivisions, combining odd meter and triplet phrasing.",
    ...bundle(
      98,
      104,
      [
        line("hihatClosed", measure("n-quarter", "n-quarter", "n-quarter", "n-quarter", "n-quarter", "n-quarter", "n-quarter")),
        line("kick", measure("n-quarter", null, null, "n-quarter", null, null, null)),
        line("snare", measure(null, null, "n-quarter", null, null, null, "n-quarter")),
      ],
      [
        line("hihatClosed", measure("n-quarter", "n-quarter", "n-quarter", "n-quarter", "n-quarter", "n-quarter", "n-quarter")),
        line("kick", measure("n-quarter", null, null, "n-quarter", null, null, null)),
        line("snare", measure(null, null, "n-quarter", null, null, null, "n-quarter")),
        line("crash", measure("n-quarter", null, null, null, null, null, null)),
      ],
      [
        line("highTom", measure(custom(N("eighthTriplet"), N("eighthTriplet"), N("eighthTriplet")), null, null, null, null, null, null)),
        line("midTom", measure(null, custom(N("eighthTriplet"), N("eighthTriplet"), N("eighthTriplet")), null, null, null, null, null)),
        line("lowTom", measure(null, null, custom(N("eighthTriplet"), N("eighthTriplet"), N("eighthTriplet")), null, null, null, null)),
        line(
          "snare",
          measure(
            null,
            null,
            null,
            custom(N("eighthTriplet"), N("eighthTriplet"), N("eighthTriplet")),
            custom(N("eighthTriplet"), N("eighthTriplet"), N("eighthTriplet")),
            custom(N("eighthTriplet"), N("eighthTriplet"), N("eighthTriplet")),
            custom(N("eighthTriplet"), N("eighthTriplet"), N("eighthTriplet"))
          )
        ),
      ],
      TOM_RUN_FILL_7
    ),
  },
  {
    slug: "lesson-99-full-arrangement-the-home-stretch",
    lessonNumber: 99,
    title: "Full Arrangement: The Home Stretch",
    teaches: "A polyrhythmic-kick verse, a half-time double-kick chorus, and two fills — one last full arrangement before the final song.",
    ...bundle(
      99,
      110,
      [line("hihatClosed", HIHAT_EIGHTHS), line("kick", measure("n-quarter", OFFBEAT_EIGHTH, null, "n-quarter")), line("snare", BACKBEAT_SNARE)],
      [
        line("kick", DOUBLE_KICK_ALT),
        line("snare", measure(null, null, "n-quarter", null)),
        line("hihatClosed", HIHAT_EIGHTHS),
        line("crash", CRASH_BEAT1),
      ]
    ,
      VIRTUOSO_COMBO_FILL,
      FULL_KIT_GHOST_TO_ACCENT_TOM_FILL
    ),
  },
  {
    slug: "lesson-100-graduation",
    lessonNumber: 100,
    title: "Graduation: Everything You've Learned",
    teaches: "A full song combining sixteenth-note ghost/accent dynamics, a driving double-kick chorus, a 7-beat odd-meter bridge, and a full-kit crescendo fill — the whole hundred-lesson course, in one song.",
    slotA: slot(104, [
      line("hihatClosed", measure(custom(N("eighth", "accent"), N("eighth", "ghost")), "n-e-e", custom(N("eighth", "accent"), N("eighth", "ghost")), "n-e-e")),
      line("snare", GHOST_BACKBEAT_SNARE),
      line("kick", measure("n-quarter", null, custom(N("eighth", "ghost"), N("eighth", "accent")), null)),
    ]),
    slotB: slot(104, [
      line("kick", DOUBLE_KICK_ALT),
      line("hihatClosed", HIHAT_EIGHTHS),
      line("snare", BACKBEAT_SNARE),
      line("crash", CRASH_BEAT1),
    ]),
    slotC: slot(104, [
      line("hihatClosed", measure("n-quarter", "n-quarter", "n-quarter", "n-quarter", "n-quarter", "n-quarter", "n-quarter")),
      line("kick", measure("n-quarter", null, "n-quarter", null, "n-quarter", null, null)),
      line("snare", measure(GHOST_TAIL, null, GHOST_TAIL, null, null, null, "n-quarter")),
    ]),
    slotD: slot(104, [
      line(
        "hihatClosed",
        measure(
          custom(N("sixteenth", "ghost"), N("sixteenth", "ghost"), N("sixteenth", "ghost"), N("sixteenth", "ghost")),
          "n-s-s-s-s",
          custom(N("sixteenth", "accent"), N("sixteenth"), N("sixteenth", "accent"), N("sixteenth")),
          custom(N("sixteenth", "accent"), N("sixteenth", "accent"), N("sixteenth", "accent"), N("sixteenth", "accent"))
        )
      ),
      line("kick", measure(custom(N("sixteenth", "ghost"), R("sixteenth"), R("sixteenth"), R("sixteenth")), null, custom(N("sixteenth", "accent"), R("sixteenth"), R("sixteenth"), R("sixteenth")), "n-quarter")),
      line("snare", measure(null, custom(N("sixteenth", "ghost"), R("sixteenth"), R("sixteenth"), R("sixteenth")), null, custom(N("sixteenth", "accent"), N("sixteenth", "accent"), N("sixteenth", "accent"), N("sixteenth", "accent")))),
      line("crash", measure(null, null, null, "n-quarter")),
    ]),
    stack: {
      bpm: 104,
      steps: ["A", "A", "B", "A", "C", "C", "B", "B", "D", "A"].map((s, i) => ({
        id: `step-l100-${i + 1}`,
        slot: s as SlotLetterLocal,
      })),
      kitOverride: null,
    },
  },
];

const db = getDb();

for (const seed of SEEDS) {
  const row = {
    slug: seed.slug,
    lessonNumber: seed.lessonNumber,
    title: seed.title,
    teaches: seed.teaches,
    slotA: seed.slotA ?? null,
    slotB: seed.slotB ?? null,
    slotC: seed.slotC ?? null,
    slotD: seed.slotD ?? null,
    stack: seed.stack ?? null,
  };

  await db
    .insert(lessons)
    .values(row)
    .onConflictDoUpdate({ target: lessons.slug, set: row });

  console.log(`Seeded /school/${seed.slug} (Lesson ${seed.lessonNumber}: "${seed.title}")`);
}
