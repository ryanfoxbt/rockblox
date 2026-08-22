import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { songAnalyses } from "@/db/schema";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  const [row] = await db.select().from(songAnalyses).where(eq(songAnalyses.id, id)).limit(1);
  if (!row) {
    return NextResponse.json({ error: "Analysis not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: row.id,
    status: row.status,
    originalFilename: row.originalFilename,
    errorMessage: row.errorMessage,
    bpm: row.bpm,
    beatSeconds: row.beatSeconds,
    gridOrigin: row.gridOrigin,
    durationSeconds: row.durationSeconds,
    onsets: row.onsets,
  });
}
