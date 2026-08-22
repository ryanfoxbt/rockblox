import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { songAnalyses } from "@/db/schema";
import { streamPrivateBlobAudio } from "@/lib/blobAudioProxy";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  const [row] = await db.select({ blobUrl: songAnalyses.blobUrl }).from(songAnalyses).where(eq(songAnalyses.id, id)).limit(1);
  if (!row?.blobUrl) {
    return NextResponse.json({ error: "Analysis not found" }, { status: 404 });
  }

  return streamPrivateBlobAudio(row.blobUrl, request);
}
