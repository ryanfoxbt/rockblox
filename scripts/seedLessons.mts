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

const SEEDS: LessonSeed[] = [
  {
    slug: "lesson-1-the-pulse",
    lessonNumber: 1,
    title: "Find the Pulse",
    teaches: "Steady quarter notes on the hi-hat.",
    slotA: slot(76, [line("hihatClosed", HIHAT_QUARTERS)]),
  },
  {
    slug: "lesson-2-the-backbeat",
    lessonNumber: 2,
    title: "Add the Backbeat",
    teaches: "Snare on beats 2 and 4.",
    slotA: slot(78, [line("hihatClosed", HIHAT_QUARTERS), line("snare", BACKBEAT_SNARE)]),
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
    title: "Graduation: A Song of Your Own",
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
