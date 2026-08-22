import { Metadata } from "next";
import { SongCropTool } from "@/components/SongCropTool";

// Private test harness for the manual song-cropping workflow (see
// SongCropTool + lib/quantizeClip.ts, lib/transcribeDrums.ts's
// analyzeSongForCropping) — deliberately not linked from anywhere in the
// app, just reachable directly at /test for trying the in-progress feature
// against real songs in production. noindex so it never shows up in search
// regardless.
export const metadata: Metadata = {
  title: "Song Crop Test",
  robots: { index: false, follow: false },
};

export default function TestPage() {
  return <SongCropTool />;
}
