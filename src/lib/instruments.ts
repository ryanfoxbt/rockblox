export type InstrumentId =
  | "kick"
  | "snare"
  | "hihatClosed"
  | "hihatOpen"
  | "crash"
  | "ride"
  | "lowTom"
  | "midTom"
  | "highTom"
  | "rimshot";

export interface InstrumentDef {
  id: InstrumentId;
  name: string;
  color: string; // tailwind bg class
}

export const INSTRUMENTS: InstrumentDef[] = [
  { id: "kick", name: "Bass Drum", color: "bg-red-600" },
  { id: "snare", name: "Snare Drum", color: "bg-amber-500" },
  { id: "hihatClosed", name: "Hi-Hat (Closed)", color: "bg-emerald-500" },
  { id: "hihatOpen", name: "Hi-Hat (Open)", color: "bg-emerald-700" },
  { id: "crash", name: "Crash Cymbal", color: "bg-sky-500" },
  { id: "ride", name: "Ride Cymbal", color: "bg-indigo-500" },
  { id: "lowTom", name: "Low Tom", color: "bg-fuchsia-600" },
  { id: "midTom", name: "Mid Tom", color: "bg-purple-600" },
  { id: "highTom", name: "High Tom", color: "bg-pink-600" },
  { id: "rimshot", name: "Rimshot", color: "bg-orange-500" },
];

export function getInstrument(id: InstrumentId): InstrumentDef {
  return INSTRUMENTS.find((i) => i.id === id) ?? INSTRUMENTS[1];
}

export function defaultInstrumentFor(lineIndex: number): InstrumentId {
  // Line 0 defaults to snare per spec; subsequent lines cycle through the kit.
  if (lineIndex === 0) return "snare";
  const order: InstrumentId[] = [
    "kick",
    "hihatClosed",
    "crash",
    "lowTom",
    "midTom",
    "highTom",
    "ride",
    "hihatOpen",
    "rimshot",
  ];
  return order[(lineIndex - 1) % order.length];
}
