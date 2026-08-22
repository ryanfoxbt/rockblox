import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { fullSongImports } from "@/db/schema";
import { FullSongImportRequestedData, inngest } from "@/inngest/client";

function createImportId(): string {
  return `fimp-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

// /test-only: kicks off a whole-song transcription (see transcribeFullSong)
// — never tied to a board, so unlike /api/imports there's no boardSlug to
// validate here at all.
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { blobUrl?: unknown; originalFilename?: unknown } | null;

  const blobUrl = typeof body?.blobUrl === "string" ? body.blobUrl : "";
  const originalFilename = typeof body?.originalFilename === "string" ? body.originalFilename : "upload";

  if (!blobUrl) {
    return NextResponse.json({ error: "Missing blobUrl" }, { status: 400 });
  }

  const db = getDb();
  const id = createImportId();
  await db.insert(fullSongImports).values({ id, blobUrl, originalFilename, status: "uploaded" });

  const eventData: FullSongImportRequestedData = { importId: id };
  await inngest.send({ name: "song/full-import.requested", data: eventData });

  return NextResponse.json({ id }, { status: 201 });
}
