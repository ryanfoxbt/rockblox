import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { songAnalyses } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { streamPrivateBlobAudio } from "@/lib/blobAudioProxy";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to use song analysis" }, { status: 401 });

  const { id } = await params;
  const db = getDb();

  const [row] = await db.select({ blobUrl: songAnalyses.blobUrl }).from(songAnalyses).where(eq(songAnalyses.id, id)).limit(1);
  if (!row?.blobUrl) {
    return NextResponse.json({ error: "Analysis not found" }, { status: 404 });
  }

  return streamPrivateBlobAudio(row.blobUrl, request);
}
