// Rhythm data model: every tile fills exactly one beat (4 sixteenth-note units).
// Durations are expressed in sixteenth-note units: 16th=1, 8th=2, dotted-8th=3, quarter=4.

export type NoteName = "sixteenth" | "eighth" | "dottedEighth" | "quarter";

export const UNITS_PER_BEAT = 4;

export const NOTE_UNITS: Record<NoteName, number> = {
  sixteenth: 1,
  eighth: 2,
  dottedEighth: 3,
  quarter: 4,
};

export const NOTE_SHORT_LABEL: Record<NoteName, string> = {
  sixteenth: "16th",
  eighth: "8th",
  dottedEighth: "Dot 8th",
  quarter: "Quarter",
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

export const ALL_TILES: RhythmTile[] = [...NOTE_TILES, ...REST_TILES];

export function getTileById(id: string): RhythmTile | undefined {
  return ALL_TILES.find((t) => t.id === id);
}

export function tileUnits(t: RhythmTile): number {
  return t.hits.reduce((sum, h) => sum + NOTE_UNITS[h.note], 0);
}
