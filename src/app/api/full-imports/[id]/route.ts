import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { fullSongImports } from "@/db/schema";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  const [row] = await db.select().from(fullSongImports).where(eq(fullSongImports.id, id)).limit(1);
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
    durationSeconds: row.durationSeconds,
    slots: row.slots,
    arrangement: row.arrangement,
  });
}
