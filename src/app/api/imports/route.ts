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

  const boardSlug = typeof body?.boardSlug === "string" ? normalizeBoardSlug(body.boardSlug) : "";
  const blobUrl = typeof body?.blobUrl === "string" ? body.blobUrl : "";
  const originalFilename = typeof body?.originalFilename === "string" ? body.originalFilename : "upload";

  if (!boardSlug || !blobUrl) {
    return NextResponse.json({ error: "Missing boardSlug or blobUrl" }, { status: 400 });
  }

  const db = getDb();
  const [board] = await db.select({ id: boards.id }).from(boards).where(eq(boards.slug, boardSlug)).limit(1);
  if (!board) {
    return NextResponse.json({ error: "Page not found" }, { status: 404 });
  }

  const id = createImportId();
  await db.insert(songImports).values({ id, boardSlug, blobUrl, originalFilename, status: "uploaded" });

  const eventData: SongImportRequestedData = { importId: id };
  await inngest.send({ name: "song/import.requested", data: eventData });

  return NextResponse.json({ id }, { status: 201 });
}
