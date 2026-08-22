import { NonRetriableError } from "inngest";
import { eq } from "drizzle-orm";
import { get } from "@vercel/blob";
import { getDb } from "@/db";
import { fullSongImports, songImports } from "@/db/schema";
import { separateDrumStem, separateStems } from "@/lib/stemSeparate";
import { transcribeDrums, transcribeFullSong } from "@/lib/transcribeDrums";
import { FullSongImportRequestedData, SongImportRequestedData, inngest } from "./client";

// One durable job: fetch the uploaded song, split it into stems (Replicate/
// Demucs), transcribe up to three main grooves plus a fill from the drums,
// layer in whichever non-drum stem is most rhythmically distinct as an extra
// Rimshot line, and save the result — each step retried independently by
// Inngest rather than the whole pipeline re-running on a transient blip. See
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

        const stems = await separateStems(audioBuffer);
        return transcribeDrums(stems.drums, { vocals: stems.vocals, bass: stems.bass, other: stems.other });
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

// The /test-only counterpart to importSong above: drums-only (no stem
// separation beyond isolating the drum stem itself — deliberately no
// vocals/bass/"other" layering while that side is still being tuned), and
// finds every distinct groove/fill the whole song has rather than capping
// at three main beats + a fill. See transcribeFullSong in
// lib/transcribeDrums.ts.
export const importFullSong = inngest.createFunction(
  { id: "full-song-import", retries: 1, triggers: [{ event: "song/full-import.requested" }] },
  async ({ event, step }) => {
    const { importId } = event.data as FullSongImportRequestedData;

    const row = await step.run("load-import", async () => {
      const db = getDb();
      const [r] = await db.select().from(fullSongImports).where(eq(fullSongImports.id, importId)).limit(1);
      if (!r) throw new NonRetriableError(`Full song import ${importId} not found`);
      return r;
    });

    await step.run("mark-processing", async () => {
      const db = getDb();
      await db
        .update(fullSongImports)
        .set({ status: "processing", updatedAt: new Date() })
        .where(eq(fullSongImports.id, importId));
    });

    try {
      const result = await step.run("separate-and-transcribe", async () => {
        const blob = await get(row.blobUrl, { access: "private" });
        if (!blob) throw new Error("Uploaded file is missing from storage");
        const audioBuffer = Buffer.from(await new Response(blob.stream).arrayBuffer());

        const drumsWav = await separateDrumStem(audioBuffer);
        return transcribeFullSong(drumsWav);
      });

      await step.run("log-diagnostics", async () => {
        console.log(
          `[full-song-import] "${row.originalFilename}" -> bpm=${result.bpm} slots=${result.slots.length} arrangementSteps=${result.arrangement.length} durationSeconds=${result.durationSeconds}`
        );
      });

      await step.run("save-result", async () => {
        const db = getDb();
        await db
          .update(fullSongImports)
          .set({
            status: "done",
            bpm: result.bpm,
            measureLength: result.measureLength,
            durationSeconds: Math.round(result.durationSeconds),
            slots: result.slots,
            arrangement: result.arrangement,
            updatedAt: new Date(),
          })
          .where(eq(fullSongImports.id, importId));
      });

      return { ok: true as const };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong transcribing this song.";
      await step.run("save-error", async () => {
        const db = getDb();
        await db
          .update(fullSongImports)
          .set({ status: "error", errorMessage: message, updatedAt: new Date() })
          .where(eq(fullSongImports.id, importId));
      });
      return { ok: false as const, error: message };
    }
  }
);
