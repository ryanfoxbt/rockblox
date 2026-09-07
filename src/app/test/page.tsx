import { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { SongCropTool } from "@/components/SongCropTool";

// Private test harness for the manual song-cropping workflow (see
// SongCropTool + lib/quantizeClip.ts, lib/transcribeDrums.ts's
// analyzeSongForCropping) — deliberately not linked from anywhere in the
// app, just reachable directly at /test for trying the in-progress feature
// against real songs in production. noindex so it never shows up in search
// regardless, and sign-in gated: anonymous visitors are bounced to
// /auth/sign-in (this will get a payment gate on top later). The
// /api/song-analyses and /api/imports/upload-token routes it calls enforce
// the same check server-side.
export const metadata: Metadata = {
  title: "Song Crop Test",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function TestPage() {
  await requireUser();
  return <SongCropTool />;
}
