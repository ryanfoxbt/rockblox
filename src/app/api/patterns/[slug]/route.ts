import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { patterns } from "@/db/schema";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const db = getDb();

  const [pattern] = await db.select().from(patterns).where(eq(patterns.slug, slug)).limit(1);

  if (!pattern) {
    return NextResponse.json({ error: "Pattern not found" }, { status: 404 });
  }

  return NextResponse.json({ bpm: pattern.bpm, lines: pattern.lines });
}
