import { InstrumentId } from "./instruments";

// Base64-encoded recordings (from the "record your own fart" mic capture),
// keyed by which kit slot they replace. Stored alongside a pattern/board slot
// so a personalized fart sound travels with the beat it's saved on.
export type CustomSamples = Partial<Record<InstrumentId, string>>;

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export function isValidCustomSamples(value: unknown): value is CustomSamples {
  if (value === undefined) return true;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value).every((v) => typeof v === "string");
}
