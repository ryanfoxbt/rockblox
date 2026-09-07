import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getCurrentUser } from "@/lib/auth/session";

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50MB — generous for a full song at typical MP3 bitrates

// Client-upload token minter for song audio. Today the only caller is the
// sign-in-gated /test crop tool (SongImportButton, the other historical
// caller, is currently unlinked from the UI), so minting a token requires a
// logged-in user; revisit if the in-app importer comes back with its own
// access policy. The `blob.upload-completed` callback Vercel Blob posts back
// here is server-to-server (no user cookie) and is left to handleUpload's
// own token verification.
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  if (body.type === "blob.generate-client-token") {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Sign in to upload a song" }, { status: 401 });
  }

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/mp4", "audio/x-m4a"],
        maximumSizeInBytes: MAX_UPLOAD_BYTES,
        addRandomSuffix: true,
      }),
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
