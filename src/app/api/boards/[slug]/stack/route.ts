import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { boards } from "@/db/schema";
import { normalizeBoardSlug, SLOT_LETTERS, SlotLetter } from "@/lib/board";
import { measureLengthFromStoredLines } from "@/lib/song";
import { isValidStackArrangement, MAX_STACK_SECONDS, StackArrangement, totalStackSeconds } from "@/lib/stack";

const SLOT_COLUMN: Record<SlotLetter, "slotA" | "slotB" | "slotC" | "slotD"> = {
  A: "slotA",
  B: "slotB",
  C: "slotC",
  D: "slotD",
};

export async function PUT(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const body = (await request.json().catch(() => null)) as StackArrangement | null;

  if (!isValidStackArrangement(body) || !body) {
    return NextResponse.json({ error: "Invalid arrangement payload" }, { status: 400 });
  }

  const db = getDb();
  const [board] = await db
    .select()
    .from(boards)
    .where(eq(boards.slug, normalizeBoardSlug(slug)))
    .limit(1);

  if (!board) {
    return NextResponse.json({ error: "Page not found" }, { status: 404 });
  }

  // Recompute against this board's *current* saved patterns — never trust
  // the client's own duration math, and reject steps pointing at a slot
  // that's empty (or has since been emptied).
  const measureLengths = {} as Record<SlotLetter, number>;
  for (const letter of SLOT_LETTERS) {
    const slot = board[SLOT_COLUMN[letter]];
    measureLengths[letter] = slot ? measureLengthFromStoredLines(slot.lines) : 0;
  }

  if (body.steps.some((step) => measureLengths[step.slot] < 1)) {
    return NextResponse.json({ error: "Can't add an empty beat to the song" }, { status: 400 });
  }

  const total = totalStackSeconds(body.steps, measureLengths, body.bpm);
  if (total > MAX_STACK_SECONDS) {
    return NextResponse.json({ error: "Song is over the 3:00 limit" }, { status: 400 });
  }

  await db
    .update(boards)
    .set({ stack: body, updatedAt: new Date() })
    .where(eq(boards.slug, normalizeBoardSlug(slug)));

  return NextResponse.json({ ok: true });
}
