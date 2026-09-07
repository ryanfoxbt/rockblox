import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { boards } from "@/db/schema";
import { BoardSlotData, isReservedBoardName, isValidBoardName, normalizeBoardSlug, SLOT_LETTERS, SlotLetter } from "@/lib/board";
import { RawSlotPayload, toSlotData } from "@/lib/slotPayload";
import { listBoardsForExplore } from "@/lib/boardList";

// The Explore starfield's board list. Board pages are already public; the
// /explore route that shows this is signed-in only.
export async function GET() {
  return NextResponse.json({ boards: await listBoardsForExplore() });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as
    | {
        name?: unknown;
        bpm?: unknown;
        lines?: unknown;
        kit?: unknown;
        customSamples?: unknown;
        // Multi-slot creation (e.g. Text to Beat claiming straight from the
        // homepage) — one payload per slot, in place of the single
        // bpm/lines/kit/customSamples fields above.
        slots?: Partial<Record<SlotLetter, RawSlotPayload | null>>;
      }
    | null;
  const rawName = body && typeof body.name === "string" ? body.name : "";
  const name = rawName.trim();

  if (!isValidBoardName(name)) {
    return NextResponse.json(
      { error: "Use 2-24 letters, numbers, - or _, starting with a letter." },
      { status: 400 }
    );
  }
  if (isReservedBoardName(name)) {
    return NextResponse.json({ error: "That name is reserved." }, { status: 400 });
  }

  const slotData: Partial<Record<SlotLetter, BoardSlotData>> = {};
  if (body?.slots && typeof body.slots === "object") {
    for (const letter of SLOT_LETTERS) {
      const raw = body.slots[letter];
      if (!raw || typeof raw !== "object") continue;
      const data = toSlotData(raw);
      if (data) slotData[letter] = data;
    }
  } else if (body) {
    // A user can claim a page while they already have a beat going (e.g.
    // from the homepage) — carry that pattern over into slot A instead of
    // losing it.
    const data = toSlotData(body);
    if (data) slotData.A = data;
  }

  const db = getDb();
  const slug = normalizeBoardSlug(name);

  try {
    await db.insert(boards).values({
      slug,
      displayName: name,
      ...(slotData.A ? { slotA: slotData.A } : {}),
      ...(slotData.B ? { slotB: slotData.B } : {}),
      ...(slotData.C ? { slotC: slotData.C } : {}),
      ...(slotData.D ? { slotD: slotData.D } : {}),
    });
  } catch (err) {
    const cause = err instanceof Error && err.cause instanceof Error ? err.cause.message : "";
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("duplicate key") || cause.includes("duplicate key")) {
      return NextResponse.json({ error: "That name is already taken." }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create page" }, { status: 500 });
  }

  return NextResponse.json({ slug, displayName: name }, { status: 201 });
}
