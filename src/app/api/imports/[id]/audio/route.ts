import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { songImports } from "@/db/schema";
import { streamPrivateBlobAudio } from "@/lib/blobAudioProxy";

// Streams the original uploaded song back to the browser — the upload is a
// private blob, so a plain <audio src="..."> pointed at it directly would
// 403; this proxies it through a route that can actually authenticate the
// read. Part of the dormant songImports/SongImportButton per-board import
// flow (see that table's own comment in db/schema.ts) — no active UI calls
// this right now.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  const [row] = await db.select({ blobUrl: songImports.blobUrl }).from(songImports).where(eq(songImports.id, id)).limit(1);
  if (!row?.blobUrl) {
    return NextResponse.json({ error: "Import not found" }, { status: 404 });
  }

  return streamPrivateBlobAudio(row.blobUrl, request);
}
