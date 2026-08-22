import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { fullSongImports } from "@/db/schema";
import { streamPrivateBlobAudio } from "@/lib/blobAudioProxy";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  const [row] = await db
    .select({ blobUrl: fullSongImports.blobUrl })
    .from(fullSongImports)
    .where(eq(fullSongImports.id, id))
    .limit(1);
  if (!row?.blobUrl) {
    return NextResponse.json({ error: "Import not found" }, { status: 404 });
  }

  return streamPrivateBlobAudio(row.blobUrl, request);
}
