import { Mp3Encoder } from "@breezystack/lamejs";

function floatTo16BitPCM(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return output;
}

const CHUNK_SIZE = 1152;

export function encodeAudioBufferToMp3(buffer: AudioBuffer, kbps = 128): Blob {
  const channels = Math.min(buffer.numberOfChannels, 2);
  const encoder = new Mp3Encoder(channels, buffer.sampleRate, kbps);

  const left = floatTo16BitPCM(buffer.getChannelData(0));
  const right = channels > 1 ? floatTo16BitPCM(buffer.getChannelData(1)) : undefined;

  const chunks: Uint8Array[] = [];
  for (let i = 0; i < left.length; i += CHUNK_SIZE) {
    const leftChunk = left.subarray(i, i + CHUNK_SIZE);
    const mp3buf = right
      ? encoder.encodeBuffer(leftChunk, right.subarray(i, i + CHUNK_SIZE))
      : encoder.encodeBuffer(leftChunk);
    if (mp3buf.length > 0) chunks.push(mp3buf);
  }

  const finalBuf = encoder.flush();
  if (finalBuf.length > 0) chunks.push(finalBuf);

  return new Blob(
    chunks.map((c) => new Uint8Array(c)),
    { type: "audio/mpeg" }
  );
}
