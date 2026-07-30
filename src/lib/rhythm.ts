// Rhythm data model: every tile fills exactly one beat.
// Durations are expressed as a fraction of one beat (quarter note = 1).

export type NoteName =
  | "sixteenth"
  | "eighth"
  | "dottedEighth"
  | "quarter"
  | "eighthTriplet"
  | "sixteenthTriplet";

export const NOTE_FRACTION: Record<NoteName, number> = {
  sixteenth: 1 / 4,
  eighth: 1 / 2,
  dottedEighth: 3 / 4,
  quarter: 1,
  eighthTriplet: 1 / 3,
  sixteenthTriplet: 1 / 6,
};

export const NOTE_SHORT_LABEL: Record<NoteName, string> = {
  sixteenth: "16th",
  eighth: "8th",
  dottedEighth: "Dot 8th",
  quarter: "Quarter",
  eighthTriplet: "8th Trip",
  sixteenthTriplet: "16th Trip",
};

export interface RhythmHit {
  type: "note" | "rest";
  note: NoteName;
}

export interface RhythmTile {
  id: string;
  label: string;
  category: "note" | "rest";
  hits: RhythmHit[];
}

function hit(type: "note" | "rest", note: NoteName): RhythmHit {
  return { type, note };
}

function label(hits: RhythmHit[]): string {
  return hits
    .map((h) => (h.type === "rest" ? `${NOTE_SHORT_LABEL[h.note]} rest` : NOTE_SHORT_LABEL[h.note]))
    .join(" + ");
}

function tile(id: string, category: "note" | "rest", hits: RhythmHit[]): RhythmTile {
  return { id, label: label(hits), category, hits };
}

// --- 8 pure-note combinations (every composition of 4 sixteenth-units) ---
export const NOTE_TILES: RhythmTile[] = [
  tile("n-quarter", "note", [hit("note", "quarter")]),
  tile("n-de-s", "note", [hit("note", "dottedEighth"), hit("note", "sixteenth")]),
  tile("n-s-de", "note", [hit("note", "sixteenth"), hit("note", "dottedEighth")]),
  tile("n-e-e", "note", [hit("note", "eighth"), hit("note", "eighth")]),
  tile("n-e-s-s", "note", [hit("note", "eighth"), hit("note", "sixteenth"), hit("note", "sixteenth")]),
  tile("n-s-e-s", "note", [hit("note", "sixteenth"), hit("note", "eighth"), hit("note", "sixteenth")]),
  tile("n-s-s-e", "note", [hit("note", "sixteenth"), hit("note", "sixteenth"), hit("note", "eighth")]),
  tile("n-s-s-s-s", "note", [
    hit("note", "sixteenth"),
    hit("note", "sixteenth"),
    hit("note", "sixteenth"),
    hit("note", "sixteenth"),
  ]),
];

// --- 26 note+rest combinations (same compositions, with rest substitutions that
// don't collapse into a duplicate of a simpler tile — i.e. never two adjacent rests) ---
export const REST_TILES: RhythmTile[] = [
  // quarter-level
  tile("r-quarter", "rest", [hit("rest", "quarter")]),

  // dotted-8th + 16th
  tile("r-de-s", "rest", [hit("note", "dottedEighth"), hit("rest", "sixteenth")]),
  tile("r-de-s-2", "rest", [hit("rest", "dottedEighth"), hit("note", "sixteenth")]),

  // 16th + dotted-8th
  tile("r-s-de", "rest", [hit("note", "sixteenth"), hit("rest", "dottedEighth")]),
  tile("r-s-de-2", "rest", [hit("rest", "sixteenth"), hit("note", "dottedEighth")]),

  // 8th + 8th
  tile("r-e-e", "rest", [hit("note", "eighth"), hit("rest", "eighth")]),
  tile("r-e-e-2", "rest", [hit("rest", "eighth"), hit("note", "eighth")]),

  // 8th + 16th + 16th
  tile("r-e-s-s-1", "rest", [hit("note", "eighth"), hit("note", "sixteenth"), hit("rest", "sixteenth")]),
  tile("r-e-s-s-2", "rest", [hit("note", "eighth"), hit("rest", "sixteenth"), hit("note", "sixteenth")]),
  tile("r-e-s-s-3", "rest", [hit("rest", "eighth"), hit("note", "sixteenth"), hit("note", "sixteenth")]),
  tile("r-e-s-s-4", "rest", [hit("rest", "eighth"), hit("note", "sixteenth"), hit("rest", "sixteenth")]),

  // 16th + 8th + 16th
  tile("r-s-e-s-1", "rest", [hit("note", "sixteenth"), hit("note", "eighth"), hit("rest", "sixteenth")]),
  tile("r-s-e-s-2", "rest", [hit("note", "sixteenth"), hit("rest", "eighth"), hit("note", "sixteenth")]),
  tile("r-s-e-s-3", "rest", [hit("rest", "sixteenth"), hit("note", "eighth"), hit("note", "sixteenth")]),
  tile("r-s-e-s-4", "rest", [hit("rest", "sixteenth"), hit("note", "eighth"), hit("rest", "sixteenth")]),

  // 16th + 16th + 8th
  tile("r-s-s-e-1", "rest", [hit("note", "sixteenth"), hit("note", "sixteenth"), hit("rest", "eighth")]),
  tile("r-s-s-e-2", "rest", [hit("note", "sixteenth"), hit("rest", "sixteenth"), hit("note", "eighth")]),
  tile("r-s-s-e-3", "rest", [hit("rest", "sixteenth"), hit("note", "sixteenth"), hit("note", "eighth")]),
  tile("r-s-s-e-4", "rest", [hit("rest", "sixteenth"), hit("note", "sixteenth"), hit("rest", "eighth")]),

  // four 16ths, with rests (no two adjacent)
  tile("r-4s-1", "rest", [
    hit("note", "sixteenth"),
    hit("note", "sixteenth"),
    hit("note", "sixteenth"),
    hit("rest", "sixteenth"),
  ]),
  tile("r-4s-2", "rest", [
    hit("note", "sixteenth"),
    hit("note", "sixteenth"),
    hit("rest", "sixteenth"),
    hit("note", "sixteenth"),
  ]),
  tile("r-4s-3", "rest", [
    hit("note", "sixteenth"),
    hit("rest", "sixteenth"),
    hit("note", "sixteenth"),
    hit("note", "sixteenth"),
  ]),
  tile("r-4s-4", "rest", [
    hit("rest", "sixteenth"),
    hit("note", "sixteenth"),
    hit("note", "sixteenth"),
    hit("note", "sixteenth"),
  ]),
  tile("r-4s-5", "rest", [
    hit("note", "sixteenth"),
    hit("rest", "sixteenth"),
    hit("note", "sixteenth"),
    hit("rest", "sixteenth"),
  ]),
  tile("r-4s-6", "rest", [
    hit("rest", "sixteenth"),
    hit("note", "sixteenth"),
    hit("rest", "sixteenth"),
    hit("note", "sixteenth"),
  ]),
  tile("r-4s-7", "rest", [
    hit("rest", "sixteenth"),
    hit("note", "sixteenth"),
    hit("note", "sixteenth"),
    hit("rest", "sixteenth"),
  ]),
];

// --- 13 pure triplet-note combinations (every composition of 6 sixteenth-triplet
// units, using eighth-triplet=2 units and sixteenth-triplet=1 unit) ---
export const TRIPLET_TILES: RhythmTile[] = [
  tile("t-e3", "note", [
    hit("note", "eighthTriplet"),
    hit("note", "eighthTriplet"),
    hit("note", "eighthTriplet"),
  ]),
  tile("t-e2-s2", "note", [
    hit("note", "eighthTriplet"),
    hit("note", "eighthTriplet"),
    hit("note", "sixteenthTriplet"),
    hit("note", "sixteenthTriplet"),
  ]),
  tile("t-e-s2-e", "note", [
    hit("note", "eighthTriplet"),
    hit("note", "sixteenthTriplet"),
    hit("note", "sixteenthTriplet"),
    hit("note", "eighthTriplet"),
  ]),
  tile("t-s2-e2", "note", [
    hit("note", "sixteenthTriplet"),
    hit("note", "sixteenthTriplet"),
    hit("note", "eighthTriplet"),
    hit("note", "eighthTriplet"),
  ]),
  tile("t-e-s-e-s", "note", [
    hit("note", "eighthTriplet"),
    hit("note", "sixteenthTriplet"),
    hit("note", "eighthTriplet"),
    hit("note", "sixteenthTriplet"),
  ]),
  tile("t-s-e-s-e", "note", [
    hit("note", "sixteenthTriplet"),
    hit("note", "eighthTriplet"),
    hit("note", "sixteenthTriplet"),
    hit("note", "eighthTriplet"),
  ]),
  tile("t-e-s4", "note", [
    hit("note", "eighthTriplet"),
    hit("note", "sixteenthTriplet"),
    hit("note", "sixteenthTriplet"),
    hit("note", "sixteenthTriplet"),
    hit("note", "sixteenthTriplet"),
  ]),
  tile("t-s-e-s3", "note", [
    hit("note", "sixteenthTriplet"),
    hit("note", "eighthTriplet"),
    hit("note", "sixteenthTriplet"),
    hit("note", "sixteenthTriplet"),
    hit("note", "sixteenthTriplet"),
  ]),
  tile("t-s2-e-s2", "note", [
    hit("note", "sixteenthTriplet"),
    hit("note", "sixteenthTriplet"),
    hit("note", "eighthTriplet"),
    hit("note", "sixteenthTriplet"),
    hit("note", "sixteenthTriplet"),
  ]),
  tile("t-s3-e-s", "note", [
    hit("note", "sixteenthTriplet"),
    hit("note", "sixteenthTriplet"),
    hit("note", "sixteenthTriplet"),
    hit("note", "eighthTriplet"),
    hit("note", "sixteenthTriplet"),
  ]),
  tile("t-s4-e", "note", [
    hit("note", "sixteenthTriplet"),
    hit("note", "sixteenthTriplet"),
    hit("note", "sixteenthTriplet"),
    hit("note", "sixteenthTriplet"),
    hit("note", "eighthTriplet"),
  ]),
  tile("t-s6", "note", [
    hit("note", "sixteenthTriplet"),
    hit("note", "sixteenthTriplet"),
    hit("note", "sixteenthTriplet"),
    hit("note", "sixteenthTriplet"),
    hit("note", "sixteenthTriplet"),
    hit("note", "sixteenthTriplet"),
  ]),
  tile("t-s-e2-s", "note", [
    hit("note", "sixteenthTriplet"),
    hit("note", "eighthTriplet"),
    hit("note", "eighthTriplet"),
    hit("note", "sixteenthTriplet"),
  ]),
];

// REST_TILES is no longer offered in the palette — rests are now created by
// toggling individual hits on a placed note tile (see toggleHitRest below).
// The catalog is kept so older saved/shared patterns referencing these ids
// keep loading correctly.
export const ALL_TILES: RhythmTile[] = [...NOTE_TILES, ...REST_TILES, ...TRIPLET_TILES];

// --- Dynamic rest toggling --------------------------------------------------
// Toggling a hit produces an arbitrary note/rest pattern that isn't necessarily
// in the static catalog above, so its id encodes the pattern directly. This
// lets any hit combination round-trip through save/share without having to
// pre-enumerate every combination.

const NOTE_CODE: Record<NoteName, string> = {
  sixteenth: "s",
  eighth: "e",
  dottedEighth: "d",
  quarter: "q",
  eighthTriplet: "te",
  sixteenthTriplet: "ts",
};

const CODE_TO_NOTE: Record<string, NoteName> = Object.fromEntries(
  Object.entries(NOTE_CODE).map(([note, code]) => [code, note as NoteName])
);

function encodeHits(hits: RhythmHit[]): string {
  return "c:" + hits.map((h) => `${h.type === "rest" ? "r" : "n"}${NOTE_CODE[h.note]}`).join("-");
}

function decodeHits(id: string): RhythmHit[] | undefined {
  if (!id.startsWith("c:")) return undefined;
  const hits: RhythmHit[] = [];
  for (const part of id.slice(2).split("-")) {
    const type = part[0] === "r" ? "rest" : part[0] === "n" ? "note" : undefined;
    const note = CODE_TO_NOTE[part.slice(1)];
    if (!type || !note) return undefined;
    hits.push({ type, note });
  }
  return hits.length > 0 ? hits : undefined;
}

function tileFromHits(hits: RhythmHit[]): RhythmTile {
  // Prefer the stable catalog id when the pattern matches a known pure-note shape.
  const match = [...NOTE_TILES, ...TRIPLET_TILES].find(
    (t) =>
      t.hits.length === hits.length &&
      t.hits.every((h, i) => h.note === hits[i].note && h.type === hits[i].type)
  );
  if (match) return match;
  return {
    id: encodeHits(hits),
    label: label(hits),
    category: hits.some((h) => h.type === "rest") ? "rest" : "note",
    hits,
  };
}

export function toggleHitRest(t: RhythmTile, index: number): RhythmTile {
  const hits = t.hits.map((h, i) => (i === index ? hit(h.type === "rest" ? "note" : "rest", h.note) : h));
  return tileFromHits(hits);
}

export function getTileById(id: string): RhythmTile | undefined {
  const direct = ALL_TILES.find((t) => t.id === id);
  if (direct) return direct;
  const hits = decodeHits(id);
  return hits ? tileFromHits(hits) : undefined;
}

export function tileBeatFraction(t: RhythmTile): number {
  return t.hits.reduce((sum, h) => sum + NOTE_FRACTION[h.note], 0);
}
