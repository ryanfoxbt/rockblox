import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { boards } from "@/db/schema";
import { normalizeBoardSlug, SLOT_LETTERS } from "@/lib/board";
import { isValidSingleSlotBody } from "@/lib/slotPayload";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = getDb();

  const [board] = await db
    .select()
    .from(boards)
    .where(eq(boards.slug, normalizeBoardSlug(slug)))
    .limit(1);

  if (!board) {
    return NextResponse.json({ error: "Page not found" }, { status: 404 });
  }

  return NextResponse.json({
    slug: board.slug,
    displayName: board.displayName,
    slots: { A: board.slotA, B: board.slotB, C: board.slotC, D: board.slotD },
    stack: board.stack ?? null,
    textToBeatShowRules: board.textToBeatShowRules,
  });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const body = await request.json().catch(() => null);

  if (!isValidSingleSlotBody(body, SLOT_LETTERS)) {
    return NextResponse.json({ error: "Invalid slot payload" }, { status: 400 });
  }

  const data = { bpm: body.bpm, lines: body.lines, kit: body.kit, customSamples: body.customSamples };
  const patch: { updatedAt: Date; slotA?: typeof data; slotB?: typeof data; slotC?: typeof data; slotD?: typeof data } = {
    updatedAt: new Date(),
  };
  if (body.slot === "A") patch.slotA = data;
  else if (body.slot === "B") patch.slotB = data;
  else if (body.slot === "C") patch.slotC = data;
  else patch.slotD = data;

  const db = getDb();
  const result = await db
    .update(boards)
    .set(patch)
    .where(eq(boards.slug, normalizeBoardSlug(slug)))
    .returning({ id: boards.id });

  if (result.length === 0) {
    return NextResponse.json({ error: "Page not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
