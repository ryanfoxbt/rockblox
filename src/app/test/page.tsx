import { Metadata } from "next";
import { TestTranscribeTool } from "@/components/TestTranscribeTool";

// Private test harness for the AI rhythm-detection pipeline (see
// TestTranscribeTool + lib/transcribeDrums.ts) — deliberately not linked
// from anywhere in the app, just reachable directly at /test for trying the
// in-progress feature against real songs in production. noindex so it never
// shows up in search regardless.
export const metadata: Metadata = {
  title: "Rhythm Detection Test",
  robots: { index: false, follow: false },
};

export default function TestPage() {
  return <TestTranscribeTool />;
}
