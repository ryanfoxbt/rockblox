import Replicate from "replicate";

// Pinned model version so a future Demucs update on Replicate can't silently
// change our output format (we depend on wav/int16 specifically — see
// transcribeDrums.ts's WAV parser).
const DEMUCS_MODEL = "ryan5453/demucs:5a7041cc9b82e5a558fea6b3d7b12dea89625e89da33f0447bd727c2d0ab9e77" as const;

// htdemucs_ft — the fine-tuned four-source model. Noticeably cleaner drum
// isolation than plain htdemucs (less bleed from bass and vocal transients,
// which is exactly what was making the onset detector fire on non-drum
// hits), at the cost of a slower separation pass. Worth it: separation runs
// once per song and the result is what everything downstream transcribes
// from.
const DEMUCS_MODEL_VARIANT = "htdemucs_ft" as const;

/** Runs the uploaded song through Demucs on Replicate and returns just the isolated drums stem, as 16-bit PCM WAV bytes. */
export async function separateDrumStem(audio: Buffer): Promise<Buffer> {
  const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

  const output = await replicate.run(DEMUCS_MODEL, {
    input: {
      audio,
      stem: "drums",
      model: DEMUCS_MODEL_VARIANT,
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
