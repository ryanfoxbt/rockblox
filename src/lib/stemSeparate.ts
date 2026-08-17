import Replicate from "replicate";

// Pinned model version so a future Demucs update on Replicate can't silently
// change our output format (we depend on wav/int16 specifically — see
// transcribeDrums.ts's WAV parser).
const DEMUCS_MODEL = "ryan5453/demucs:5a7041cc9b82e5a558fea6b3d7b12dea89625e89da33f0447bd727c2d0ab9e77" as const;

/** Runs the uploaded song through Demucs on Replicate and returns just the isolated drums stem, as 16-bit PCM WAV bytes. */
export async function separateDrumStem(audio: Buffer): Promise<Buffer> {
  const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

  const output = await replicate.run(DEMUCS_MODEL, {
    input: {
      audio,
      stem: "drums",
      model: "htdemucs",
      output_format: "wav",
      wav_format: "int16",
    },
  });

  // Even with `stem: "drums"` set, the model returns a `{ drums, no_drums }`
  // object (not a bare file) — the isolated stem we want is `drums`.
  const file = (output as { drums?: unknown } | null)?.drums;
  if (!file || typeof (file as { blob?: unknown }).blob !== "function") {
    throw new Error("Unexpected Demucs output shape from Replicate");
  }
  const blob = await (file as { blob: () => Promise<Blob> }).blob();
  return Buffer.from(await blob.arrayBuffer());
}
