import { NextRequest, NextResponse } from "next/server";
import { get } from "@vercel/blob";

// Streams a private blob back to the browser, honoring Range requests (by
// slicing the buffered file server-side — the installed @vercel/blob
// version has no range-passthrough option of its own) so an <audio>
// element can seek within it. Shared by both /api/imports/[id]/audio and
// /api/full-imports/[id]/audio, which otherwise just differ in which table
// they look the blobUrl up from.
export async function streamPrivateBlobAudio(blobUrl: string, request: NextRequest): Promise<NextResponse> {
  const result = await get(blobUrl, { access: "private" });
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
