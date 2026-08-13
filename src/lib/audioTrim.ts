// Trims a recorded take (see FartRecorder) down to the transient "spike"
// that drum-like sounds start with, so the saved one-shot begins right on
// the hit instead of after a leading gap of mic-room-noise silence — the
// take then lands exactly on the beat when triggered like any other sample.

const WINDOW_MS = 10;
const NOISE_FLOOR_WINDOW_MS = 150;
const ONSET_LEVEL_FACTOR = 4;
const ONSET_ABSOLUTE_FLOOR = 0.02;

/** Windowed RMS scan for the first point that clearly exceeds the take's own noise floor. */
export function findOnsetSample(channelData: Float32Array, sampleRate: number): number | null {
  const windowSize = Math.max(1, Math.round((WINDOW_MS / 1000) * sampleRate));
  const windowCount = Math.ceil(channelData.length / windowSize);
  const levels = new Array<number>(windowCount);
  for (let w = 0; w < windowCount; w++) {
    const start = w * windowSize;
    const end = Math.min(channelData.length, start + windowSize);
    let sumSquares = 0;
    for (let i = start; i < end; i++) sumSquares += channelData[i] * channelData[i];
    levels[w] = Math.sqrt(sumSquares / Math.max(1, end - start));
  }

  const noiseWindows = Math.max(1, Math.round(NOISE_FLOOR_WINDOW_MS / WINDOW_MS));
  let noiseFloor = 0;
  for (let w = 0; w < Math.min(noiseWindows, levels.length); w++) noiseFloor = Math.max(noiseFloor, levels[w]);
  const threshold = Math.max(noiseFloor * ONSET_LEVEL_FACTOR, ONSET_ABSOLUTE_FLOOR);

  for (let w = 0; w < levels.length; w++) {
    if (levels[w] < threshold) continue;
    // Found the onset window — walk forward within it to the exact sample
    // that first crosses a slightly lower bar, so we don't lose the attack.
    const start = w * windowSize;
    const end = Math.min(channelData.length, start + windowSize);
    const fineThreshold = threshold / 2;
    for (let i = start; i < end; i++) {
      if (Math.abs(channelData[i]) >= fineThreshold) return i;
    }
    return start;
  }
  return null;
}

/**
 * Returns a new AudioBuffer starting just before the detected onset (or the
 * original start if nothing clears the noise floor — e.g. a near-silent
 * take) and capped to `maxDurationSeconds`, so every saved take is short
 * and starts on its transient regardless of how long the mic actually ran.
 */
export function trimToOnset(
  buffer: AudioBuffer,
  { preRollMs = 25, maxDurationSeconds = 1.2 }: { preRollMs?: number; maxDurationSeconds?: number } = {}
): AudioBuffer {
  const sampleRate = buffer.sampleRate;
  const onset = findOnsetSample(buffer.getChannelData(0), sampleRate);
  const preRollSamples = Math.round((preRollMs / 1000) * sampleRate);
  const start = onset === null ? 0 : Math.max(0, onset - preRollSamples);
  const maxDurationSamples = Math.round(maxDurationSeconds * sampleRate);
  const end = Math.min(buffer.length, start + maxDurationSamples);
  const length = Math.max(1, end - start);

  if (start === 0 && length === buffer.length) return buffer;

  const trimmed = new AudioBuffer({ length, numberOfChannels: buffer.numberOfChannels, sampleRate });
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    trimmed.copyToChannel(buffer.getChannelData(ch).subarray(start, start + length), ch);
  }
  return trimmed;
}

/** Encodes to PCM16 WAV — decodes anywhere ctx.decodeAudioData already does, same as the webm take it replaces. */
export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const numFrames = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = numFrames * blockAlign;
  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  function writeString(offset: number, s: string) {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  }

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  const channelData: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) channelData.push(buffer.getChannelData(ch));

  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const s = Math.max(-1, Math.min(1, channelData[ch][i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}
