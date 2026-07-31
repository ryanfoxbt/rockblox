import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { patterns } from "@/db/schema";
import { generateSlug } from "@/lib/slug";
import { StoredLine } from "@/lib/song";

interface SavePatternBody {
  bpm: number;
  lines: StoredLine[];
}

function isValidBody(body: unknown): body is SavePatternBody {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  if (typeof b.bpm !== "number" || !Number.isFinite(b.bpm)) return false;
  if (!Array.isArray(b.lines)) return false;
  return b.lines.every(
    (l) =>
      l &&
      typeof l === "object" &&
      typeof (l as { instrument?: unknown }).instrument === "string" &&
      Array.isArray((l as { blocks?: unknown }).blocks)
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!isValidBody(body)) {
    return NextResponse.json({ error: "Invalid pattern payload" }, { status: 400 });
  }

  const db = getDb();

  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = generateSlug();
    try {
      await db.insert(patterns).values({ slug, bpm: body.bpm, lines: body.lines });
      return NextResponse.json({ slug }, { status: 201 });
    } catch (err) {
      const cause = err instanceof Error && err.cause instanceof Error ? err.cause.message : "";
      const message = err instanceof Error ? err.message : String(err);
      if (!message.includes("duplicate key") && !cause.includes("duplicate key")) {
        return NextResponse.json({ error: "Failed to save pattern" }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ error: "Could not generate a unique slug" }, { status: 500 });
}
