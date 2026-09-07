import { NonRetriableError } from "inngest";
import { eq } from "drizzle-orm";
import { get } from "@vercel/blob";
import { getDb } from "@/db";
import { songAnalyses, songImports } from "@/db/schema";
import { separateDrumStem } from "@/lib/stemSeparate";
import { analyzeSongForCropping, transcribeDrums } from "@/lib/transcribeDrums";
import { SongCropAnalysisRequestedData, SongImportRequestedData, inngest } from "./client";

// One durable job: fetch the uploaded song, isolate its drum stem (Replicate/
// Demucs), transcribe up to three main grooves plus fills from the drums,
// and save the result — each step retried independently by Inngest rather
// than the whole pipeline re-running on a transient blip. See
// lib/transcribeDrums.ts for why this is a best-effort heuristic pipeline
// rather than a trained model.
export const importSong = inngest.createFunction(
  { id: "song-import", retries: 1, triggers: [{ event: "song/import.requested" }] },
  async ({ event, step }) => {
    const { importId } = event.data as SongImportRequestedData;

    const row = await step.run("load-import", async () => {
      const db = getDb();
      const [r] = await db.select().from(songImports).where(eq(songImports.id, importId)).limit(1);
      if (!r) throw new NonRetriableError(`Import ${importId} not found`);
      return r;
    });

    await step.run("mark-processing", async () => {
      const db = getDb();
      await db
        .update(songImports)
        .set({ status: "processing", updatedAt: new Date() })
        .where(eq(songImports.id, importId));
    });

    try {
      const result = await step.run("separate-and-transcribe", async () => {
        const blob = await get(row.blobUrl, { access: "private" });
        if (!blob) throw new Error("Uploaded file is missing from storage");
        const audioBuffer = Buffer.from(await new Response(blob.stream).arrayBuffer());

        const drumsWav = await separateDrumStem(audioBuffer);
        return transcribeDrums(drumsWav);
      });

      // While the transcription pipeline is still being tuned: log what each
      // real upload actually produced, including where in the song (seconds)
      // each detected pattern came from, so it can be checked against the
      // original song by ear without re-running anything locally. Wrapped in
      // its own step so it logs exactly once rather than on every replay.
      await step.run("log-diagnostics", async () => {
        console.log(
          `[song-import] "${row.originalFilename}" -> ${JSON.stringify({ bpm: result.bpm, ...result.diagnostics })}`
        );
      });

      await step.run("save-result", async () => {
        const db = getDb();
        await db
          .update(songImports)
          .set({
            status: "done",
            bpm: result.bpm,
            measureLength: result.measureLength,
            mainBeatCount: result.mainBeatCount,
            patternA: result.patternA,
            patternB: result.patternB,
            patternC: result.patternC,
            patternD: result.patternD,
            diagnostics: result.diagnostics,
            updatedAt: new Date(),
          })
          .where(eq(songImports.id, importId));
      });

      return { ok: true as const };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong transcribing this song.";
      await step.run("save-error", async () => {
        const db = getDb();
        await db
          .update(songImports)
          .set({ status: "error", errorMessage: message, updatedAt: new Date() })
          .where(eq(songImports.id, importId));
      });
      // Swallowed rather than rethrown: the failure is already recorded for
      // the review UI to show, and letting Inngest auto-retry from here
      // would just burn another paid Replicate run against input that's
      // likely to fail the same way again.
      return { ok: false as const, error: message };
    }
  }
);

// Backs /test's manual-crop workflow: isolate the drums and classify every
// hit in the whole song (the one slow, Replicate-backed step), then hand the
// result to the browser — cropping and quantizing individual clips happens
// entirely client-side from there (see lib/quantizeClip.ts), so it only has
// to wait on this once, not once per slot.
export const analyzeSongCrop = inngest.createFunction(
  { id: "song-crop-analysis", retries: 1, triggers: [{ event: "song/crop-analysis.requested" }] },
  async ({ event, step }) => {
    const { analysisId } = event.data as SongCropAnalysisRequestedData;

    const row = await step.run("load-analysis", async () => {
      const db = getDb();
      const [r] = await db.select().from(songAnalyses).where(eq(songAnalyses.id, analysisId)).limit(1);
      if (!r) throw new NonRetriableError(`Song analysis ${analysisId} not found`);
      return r;
    });

    await step.run("mark-processing", async () => {
      const db = getDb();
      await db
        .update(songAnalyses)
        .set({ status: "processing", updatedAt: new Date() })
        .where(eq(songAnalyses.id, analysisId));
    });

    try {
      const result = await step.run("separate-and-analyze", async () => {
        const blob = await get(row.blobUrl, { access: "private" });
        if (!blob) throw new Error("Uploaded file is missing from storage");
        const audioBuffer = Buffer.from(await new Response(blob.stream).arrayBuffer());

        const drumsWav = await separateDrumStem(audioBuffer);

        // Plain status ping, not its own step — the audio buffer above can't
        // safely cross a step boundary (Inngest persists step output for
        // replay, and a multi-MB Buffer either bloats that badly or
        // round-trips through JSON as a plain {type,data} object, not a real
        // Buffer). This just lets /test's status bar distinguish "still
        // separating drums" (usually the long part) from "computing the
        // pattern" (seconds) instead of one opaque "processing".
        const db = getDb();
        await db
          .update(songAnalyses)
          .set({ status: "transcribing", updatedAt: new Date() })
          .where(eq(songAnalyses.id, analysisId));

        return analyzeSongForCropping(drumsWav);
      });

      await step.run("save-result", async () => {
        const db = getDb();
        await db
          .update(songAnalyses)
          .set({
            status: "done",
            bpm: result.bpm,
            beatSeconds: result.beatSeconds,
            gridOrigin: result.gridOrigin,
            durationSeconds: result.durationSeconds,
            onsets: result.onsets,
            updatedAt: new Date(),
          })
          .where(eq(songAnalyses.id, analysisId));
      });

      return { ok: true as const };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong analyzing this song.";
      await step.run("save-error", async () => {
        const db = getDb();
        await db
          .update(songAnalyses)
          .set({ status: "error", errorMessage: message, updatedAt: new Date() })
          .where(eq(songAnalyses.id, analysisId));
      });
      return { ok: false as const, error: message };
    }
  }
);
