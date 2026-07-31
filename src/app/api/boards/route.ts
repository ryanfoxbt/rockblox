import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { boards } from "@/db/schema";
import { BoardSlotData, isReservedBoardName, isValidBoardName, normalizeBoardSlug } from "@/lib/board";
import { StoredLine } from "@/lib/song";

function isValidStoredLines(lines: unknown): lines is StoredLine[] {
  return (
    Array.isArray(lines) &&
    lines.every(
      (l) =>
        l &&
        typeof l === "object" &&
        typeof (l as { instrument?: unknown }).instrument === "string" &&
        Array.isArray((l as { blocks?: unknown }).blocks)
    )
  );
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as
    | { name?: unknown; bpm?: unknown; lines?: unknown }
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

  // A user can claim a page while they already have a beat going (e.g. from
  // the homepage) — carry that pattern over into slot A instead of losing it.
  let slotA: BoardSlotData | undefined;
  if (
    body &&
    typeof body.bpm === "number" &&
    Number.isFinite(body.bpm) &&
    isValidStoredLines(body.lines) &&
    body.lines.length > 0
  ) {
    slotA = { bpm: body.bpm, lines: body.lines };
  }

  const db = getDb();
  const slug = normalizeBoardSlug(name);

  try {
    await db.insert(boards).values({ slug, displayName: name, ...(slotA ? { slotA } : {}) });
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
