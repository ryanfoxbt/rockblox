import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { get } from "@vercel/blob";
import { getDb } from "@/db";
import { songImports } from "@/db/schema";

// Streams the original uploaded song back to the browser so /test can play
// the exact clip a detected pattern came from (see TestTranscribeTool) —
// the upload is a private blob, so a plain <audio src="..."> pointed at it
// directly would 403; this proxies it through a route that can actually
// authenticate the read. Range requests are honored (by slicing the
// buffered file server-side, since the installed @vercel/blob version has
// no passthrough-range option of its own) so the <audio> element can seek
// within the clip instead of only ever starting from byte 0.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  const [row] = await db.select({ blobUrl: songImports.blobUrl }).from(songImports).where(eq(songImports.id, id)).limit(1);
  if (!row?.blobUrl) {
    return NextResponse.json({ error: "Import not found" }, { status: 404 });
  }

  const result = await get(row.blobUrl, { access: "private" });
  if (!result || result.statusCode !== 200) {
    return NextResponse.json({ error: "Audio not found" }, { status: 404 });
  }

  const buffer = Buffer.from(await new Response(result.stream).arrayBuffer());
  const contentType = result.blob.contentType || "audio/mpeg";
  const total = buffer.length;

  const range = request.headers.get("range");
  const match = range ? /bytes=(\d+)-(\d*)/.exec(range) : null;
  if (match) {
    const start = Number(match[1]);
    const end = match[2] ? Math.min(Number(match[2]), total - 1) : total - 1;
    const chunk = buffer.subarray(start, end + 1);
    return new NextResponse(new Uint8Array(chunk), {
      status: 206,
      headers: {
        "Content-Type": contentType,
        "Content-Range": `bytes ${start}-${end}/${total}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(chunk.length),
        "Cache-Control": "private, max-age=3600",
      },
    });
  }

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Accept-Ranges": "bytes",
      "Content-Length": String(total),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
