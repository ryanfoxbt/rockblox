import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { songImports } from "@/db/schema";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  const [row] = await db.select().from(songImports).where(eq(songImports.id, id)).limit(1);
  if (!row) {
    return NextResponse.json({ error: "Import not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: row.id,
    status: row.status,
    originalFilename: row.originalFilename,
    errorMessage: row.errorMessage,
    bpm: row.bpm,
    measureLength: row.measureLength,
    mainBeatCount: row.mainBeatCount,
    patternA: row.patternA,
    patternB: row.patternB,
    patternC: row.patternC,
    patternD: row.patternD,
  });
}
