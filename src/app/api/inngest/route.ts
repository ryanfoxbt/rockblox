import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { analyzeSongCrop, importFullSong, importSong } from "@/inngest/functions";

// Demucs stem separation + FFT transcription in the "separate-and-transcribe"
// step can run well past Vercel's default function timeout for a full song.
export const maxDuration = 300;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [importSong, importFullSong, analyzeSongCrop],
});
