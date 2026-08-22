import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { boards, songImports } from "@/db/schema";
import { normalizeBoardSlug } from "@/lib/board";
import { SongImportRequestedData, inngest } from "@/inngest/client";

function createImportId(): string {
  return `imp-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as
    | { boardSlug?: unknown; blobUrl?: unknown; originalFilename?: unknown }
    | null;

  // Optional: a /test scratch import (see app/test) has no board to check
  // against yet, just a transcription to preview.
  const boardSlug = typeof body?.boardSlug === "string" && body.boardSlug ? normalizeBoardSlug(body.boardSlug) : null;
  const blobUrl = typeof body?.blobUrl === "string" ? body.blobUrl : "";
  const originalFilename = typeof body?.originalFilename === "string" ? body.originalFilename : "upload";

  if (!blobUrl) {
    return NextResponse.json({ error: "Missing blobUrl" }, { status: 400 });
  }

  const db = getDb();
  if (boardSlug) {
    const [board] = await db.select({ id: boards.id }).from(boards).where(eq(boards.slug, boardSlug)).limit(1);
    if (!board) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }
  }

  const id = createImportId();
  await db.insert(songImports).values({ id, boardSlug, blobUrl, originalFilename, status: "uploaded" });

  const eventData: SongImportRequestedData = { importId: id };
  await inngest.send({ name: "song/import.requested", data: eventData });

  return NextResponse.json({ id }, { status: 201 });
}
