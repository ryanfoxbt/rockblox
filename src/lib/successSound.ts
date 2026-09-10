import { loadDrumBuffers, triggerInstrument } from "./audioEngine";
import { DEFAULT_KIT } from "./drumKits";

// A one-shot celebratory hit for a correct RockBlocks Math answer. Reuses
// the exact sample-loading/triggering primitives the real sequencer plays
// through (see audioEngine.ts) — just fired once outside the loop instead
// of on a schedule, so it sounds like the kit itself, not a generic chime.
let sharedCtx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedCtx) sharedCtx = new Ctor();
  return sharedCtx;
}

// Never lets a sound failure (autoplay policy, missing Web Audio support,
// a slow sample fetch) break the grading flow — this is pure delight, never
// a requirement for the check-answer flow to work.
export async function playSuccessSound(kit: string = DEFAULT_KIT): Promise<void> {
  try {
    const ctx = getContext();
    if (!ctx) return;
    if (ctx.state === "suspended") await ctx.resume().catch(() => {});
    const buffers = await loadDrumBuffers(ctx, kit);
    triggerInstrument(ctx, ctx.destination, buffers, "crash", ctx.currentTime, 90);
  } catch {
    // See above — silently do nothing.
  }
}
