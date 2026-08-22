import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { songAnalyses } from "@/db/schema";
import { SongCropAnalysisRequestedData, inngest } from "@/inngest/client";

function createAnalysisId(): string {
  return `sa-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

// /test-only: kicks off a whole-song analysis for the manual-crop workflow
// (see analyzeSongForCropping) — never tied to a board.
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { blobUrl?: unknown; originalFilename?: unknown } | null;

  const blobUrl = typeof body?.blobUrl === "string" ? body.blobUrl : "";
  const originalFilename = typeof body?.originalFilename === "string" ? body.originalFilename : "upload";

  if (!blobUrl) {
    return NextResponse.json({ error: "Missing blobUrl" }, { status: 400 });
  }

  const db = getDb();
  const id = createAnalysisId();
  await db.insert(songAnalyses).values({ id, blobUrl, originalFilename, status: "uploaded" });

  const eventData: SongCropAnalysisRequestedData = { analysisId: id };
  await inngest.send({ name: "song/crop-analysis.requested", data: eventData });

  return NextResponse.json({ id }, { status: 201 });
}
