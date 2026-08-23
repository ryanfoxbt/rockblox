"use client";

import { Ref, RefObject, useEffect, useMemo, useRef, useState } from "react";
import { InstrumentId } from "@/lib/instruments";
import { LineState, RockBloxPlayer } from "@/lib/audioEngine";
import { CustomSamples } from "@/lib/customSamples";
import { computeHitEvents, DrumHitEvent, Limb } from "@/lib/drumRig";
import { LineData } from "@/lib/song";

// Teaching-first default: slow enough to actually watch each hit land,
// with the tempo slider (below) always one drag away from real speed.
const DEFAULT_TEACHER_BPM = 80;

type VisualPiece = "hihat" | "crash" | "ride" | "highTom" | "midTom" | "lowTom" | "snare" | "kick";

const VISUAL_PIECE: Record<InstrumentId, VisualPiece> = {
  kick: "kick",
  snare: "snare",
  rimshot: "snare",
  hihatClosed: "hihat",
  hihatOpen: "hihat",
  ride: "ride",
  crash: "crash",
  highTom: "highTom",
  midTom: "midTom",
  lowTom: "lowTom",
};

interface DrumShape {
  id: VisualPiece;
  label: string;
  kind: "drum" | "cymbal";
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  labelDy: number;
  standTopY?: number; // where a cymbal's stand pole should stop (its underside)
}

// A seated three-quarter view: the kit spread out around a stick-figure
// drummer on a throne, instead of the previous first-person/no-body
// layout — the whole point this time is to actually see a body playing it.
const HEAD = { x: 320, y: 72, r: 22 };
const TORSO = { x: 320, y: 150, w: 84, h: 106 };
const SHOULDER: Record<"leftHand" | "rightHand", { x: number; y: number }> = {
  leftHand: { x: 280, y: 118 },
  rightHand: { x: 360, y: 118 },
};
const HIP = { left: { x: 300, y: 196 }, right: { x: 338, y: 196 } };
const LEFT_FOOT = { x: 190, y: 500 }; // resting on the hi-hat pedal — decorative, not animated
// The pedal/beater sit below the kick shell (which bottoms out around
// y=520) so they're drawn in front of the drum, not swallowed behind it.
const KICK_PEDAL_HINGE = { x: 322, y: 536 };
const KICK_PEDAL_FOOT_REST = { x: 322, y: 528 };
const KICK_STRIKE_POINT = { x: 322, y: 494 }; // where the beater actually touches the head
const KICK_BEATER_REST = { x: 322, y: 558 };

const DRUM_SHAPES: DrumShape[] = [
  { id: "crash", label: "Crash", kind: "cymbal", cx: 132, cy: 96, rx: 54, ry: 15, labelDy: -25, standTopY: 96 },
  { id: "ride", label: "Ride", kind: "cymbal", cx: 528, cy: 108, rx: 58, ry: 17, labelDy: -27, standTopY: 108 },
  { id: "hihat", label: "Hi-Hat", kind: "cymbal", cx: 168, cy: 252, rx: 42, ry: 13, labelDy: -23, standTopY: 252 },
  { id: "highTom", label: "High Tom", kind: "drum", cx: 232, cy: 168, rx: 34, ry: 25, labelDy: -35 },
  { id: "midTom", label: "Mid Tom", kind: "drum", cx: 408, cy: 172, rx: 38, ry: 28, labelDy: -38 },
  { id: "lowTom", label: "Floor Tom", kind: "drum", cx: 486, cy: 352, rx: 52, ry: 40, labelDy: -50 },
  { id: "snare", label: "Snare", kind: "drum", cx: 320, cy: 330, rx: 46, ry: 32, labelDy: -42 },
  { id: "kick", label: "Kick", kind: "drum", cx: 322, cy: 460, rx: 96, ry: 46, labelDy: -55 },
];

const PIECE_POS: Record<VisualPiece, { x: number; y: number }> = Object.fromEntries(
  DRUM_SHAPES.map((p) => [p.id, { x: p.cx, y: p.cy }])
) as Record<VisualPiece, { x: number; y: number }>;

const REST_POS: Record<"leftHand" | "rightHand", { x: number; y: number }> = {
  leftHand: PIECE_POS.snare,
  rightHand: PIECE_POS.hihat,
};

// Peak brightness/impact size a hit reaches, and how quickly it decays —
// recomputed fresh every animation frame from "how long ago (in real
// seconds) was the most recent hit," never accumulated frame-to-frame, so a
// dropped frame or a long loop can't drift the rig out of sync with the
// audio the way tracking deltas between frames could.
const IMPACT_DECAY_S = 0.14;
const FLASH_FADE_S = 0.32;

// How far ahead of a hit the stick starts its backswing, and how far (as a
// fraction of the way toward pointing straight up) the wrist lifts it at
// the peak of that backswing — a real player's wrist cocks the stick back
// before every hit, arm trailing a step behind, rather than the tip just
// teleporting straight to the next drum.
const WINDUP_S = 0.22;
const LIFT_PEAK = 0.42;

function velocityPeak(accent?: "accent" | "ghost"): number {
  return accent === "accent" ? 1 : accent === "ghost" ? 0.55 : 0.8;
}

// The most recent event at-or-before `abs` in a beat-sorted list, wrapping
// to the tail of the previous lap if `abs` precedes everything in this one —
// i.e. "what should be true right now," not "what changed since last frame."
function mostRecentEvent(
  events: DrumHitEvent[],
  abs: number,
  measureLength: number
): { event: DrumHitEvent; sinceBeats: number } | null {
  if (events.length === 0) return null;
  let best: DrumHitEvent | null = null;
  for (const ev of events) {
    if (ev.beat <= abs) best = ev;
    else break;
  }
  if (best) return { event: best, sinceBeats: abs - best.beat };
  const last = events[events.length - 1];
  return { event: last, sinceBeats: measureLength - last.beat + abs };
}

// The soonest event strictly after `abs`, wrapping to the head of the next
// lap if nothing's left in this one — the mirror of mostRecentEvent, used
// to anticipate and wind up for a hit rather than only reacting to it.
function nextEvent(
  events: DrumHitEvent[],
  abs: number,
  measureLength: number
): { event: DrumHitEvent; untilBeats: number } | null {
  if (events.length === 0) return null;
  for (const ev of events) {
    if (ev.beat > abs) return { event: ev, untilBeats: ev.beat - abs };
  }
  const first = events[0];
  return { event: first, untilBeats: measureLength - abs + first.beat };
}

// Degrees, interpolated the short way around the circle (e.g. 170deg ->
// -170deg sweeps through 180, not back through 0) so a swing near due-left
// never visibly whips the long way around.
function lerpAngle(a: number, b: number, t: number): number {
  const diff = ((((b - a) % 360) + 540) % 360) - 180;
  return a + diff * t;
}

function StickLimb({ elRef, thickness = 9 }: { elRef: Ref<SVGGElement>; thickness?: number }) {
  return (
    <g ref={elRef}>
      <rect className="forearm" x={0} y={-thickness / 2} width={0} height={thickness} rx={thickness / 2} fill="#e2b48b" stroke="#b3855f" strokeWidth={1.5} />
      <rect className="stick" x={0} y={-3} width={0} height={6} rx={3} fill="#d2a066" stroke="#8a6238" strokeWidth={1} />
      <circle className="tip" cx={0} cy={0} r={7} fill="#fde68a" />
    </g>
  );
}

export function DrumTeacherView({
  lines,
  kit,
  customSamples,
  measureLength,
  onClose,
}: {
  lines: LineData[];
  kit: string;
  customSamples?: CustomSamples;
  measureLength: number;
  onClose: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const leftArmRef = useRef<SVGGElement>(null);
  const rightArmRef = useRef<SVGGElement>(null);
  const beaterRef = useRef<SVGGElement>(null);
  const kickFootRef = useRef<SVGGElement>(null);
  const overlayRefs = useRef<Partial<Record<VisualPiece, SVGElement>>>({});

  const [bpm, setBpm] = useState(DEFAULT_TEACHER_BPM);
  const [isPlaying, setIsPlaying] = useState(false);
  const [samplesLoading, setSamplesLoading] = useState(true);
  const playerRef = useRef<RockBloxPlayer | null>(null);

  // This view owns its own player entirely separate from the main editor's —
  // so its tempo (defaulted slow, for actually following along) never
  // touches the real pattern's tempo, and closing/reopening it can't leave
  // the main page's transport in a surprising state.
  useEffect(() => {
    const player = new RockBloxPlayer(kit);
    playerRef.current = player;
    player.ready.then(() => {
      setSamplesLoading(false);
      if (customSamples && Object.keys(customSamples).length > 0) player.loadCustomSamples(customSamples);
    });
    return () => {
      player.destroy();
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!playerRef.current) return;
    const lineStates: LineState[] = lines.map((l) => ({ instrument: l.instrument, blocks: l.blocks, volume: l.volume }));
    playerRef.current.updateSong(lineStates, bpm, measureLength);
  }, [lines, bpm, measureLength]);

  useEffect(() => {
    const el = containerRef.current;
    el?.requestFullscreen?.().catch(() => {});
    function onFullscreenChange() {
      if (document.fullscreenElement !== el) onClose();
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      if (document.fullscreenElement === el) document.exitFullscreen().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function togglePlay() {
    const player = playerRef.current;
    if (!player) return;
    if (player.isPlaying()) {
      player.stop();
      setIsPlaying(false);
    } else {
      await player.play();
      setIsPlaying(true);
    }
  }

  const allEvents = useMemo<DrumHitEvent[]>(
    () => (measureLength > 0 ? computeHitEvents(lines, measureLength) : []),
    [lines, measureLength]
  );
  const eventsByLimb = useMemo(() => {
    const byLimb: Record<Limb, DrumHitEvent[]> = { leftHand: [], rightHand: [], rightFoot: [] };
    for (const ev of allEvents) byLimb[ev.limb].push(ev);
    return byLimb;
  }, [allEvents]);
  const eventsByPiece = useMemo(() => {
    const byPiece = {} as Record<VisualPiece, DrumHitEvent[]>;
    for (const shape of DRUM_SHAPES) byPiece[shape.id] = [];
    for (const ev of allEvents) byPiece[VISUAL_PIECE[ev.instrument]].push(ev);
    return byPiece;
  }, [allEvents]);

  function poseArm(ref: RefObject<SVGGElement | null>, pivot: { x: number; y: number }, angleDeg: number, dist: number, impact: number) {
    const g = ref.current;
    if (!g) return;
    const d = Math.max(1, dist);
    g.setAttribute("transform", `translate(${pivot.x} ${pivot.y}) rotate(${angleDeg})`);
    const forearm = g.querySelector<SVGRectElement>(".forearm");
    const stick = g.querySelector<SVGRectElement>(".stick");
    const tip = g.querySelector<SVGCircleElement>(".tip");
    const handDist = d * 0.62;
    forearm?.setAttribute("width", String(handDist));
    stick?.setAttribute("x", String(handDist));
    stick?.setAttribute("width", String(d - handDist));
    tip?.setAttribute("cx", String(d));
    tip?.setAttribute("r", String(6 + impact * 6));
    tip?.setAttribute("fill", impact > 0.05 ? "#fde047" : "#fcd9a8");
  }

  function angleTo(pivot: { x: number; y: number }, target: { x: number; y: number }): number {
    return (Math.atan2(target.y - pivot.y, target.x - pivot.x) * 180) / Math.PI;
  }

  function distTo(pivot: { x: number; y: number }, target: { x: number; y: number }): number {
    return Math.max(1, Math.hypot(target.x - pivot.x, target.y - pivot.y));
  }

  function applyPose(abs: number | null) {
    const secondsPerBeat = 60 / bpm;

    for (const limb of ["leftHand", "rightHand"] as const) {
      const pivot = SHOULDER[limb];
      const rest = REST_POS[limb];
      const armRef = limb === "leftHand" ? leftArmRef : rightArmRef;

      const events = abs === null ? [] : eventsByLimb[limb];
      const prev = abs === null ? null : mostRecentEvent(events, abs, measureLength);
      const next = abs === null ? null : nextEvent(events, abs, measureLength);
      if (abs === null || !prev || !next) {
        poseArm(armRef, pivot, angleTo(pivot, rest), distTo(pivot, rest), 0);
        continue;
      }

      const sinceS = prev.sinceBeats * secondsPerBeat;
      const untilS = next.untilBeats * secondsPerBeat;
      const impact = Math.max(0, 1 - sinceS / IMPACT_DECAY_S) * velocityPeak(prev.event.accent);

      const prevTarget = PIECE_POS[VISUAL_PIECE[prev.event.instrument]];
      const nextTarget = PIECE_POS[VISUAL_PIECE[next.event.instrument]];

      // Anticipate the upcoming hit: the wrist cocks the stick back (toward
      // pointing straight up) starting WINDUP_S before it lands, peaking
      // mid-swing and fully released by the moment of impact, while the
      // forearm itself only really commits to the new direction in the
      // last stretch — the wrist leads, the arm follows a beat behind.
      const liftT = untilS < WINDUP_S ? 1 - untilS / WINDUP_S : 0;
      const armT = liftT * liftT * liftT;
      const baseAngle = lerpAngle(angleTo(pivot, prevTarget), angleTo(pivot, nextTarget), armT);
      const baseDist = distTo(pivot, prevTarget) + (distTo(pivot, nextTarget) - distTo(pivot, prevTarget)) * armT;

      const liftFactor = Math.sin(liftT * Math.PI) * LIFT_PEAK;
      const angleDeg = lerpAngle(baseAngle, -90, liftFactor);
      const dist = baseDist * (1 - liftFactor * 0.25);

      poseArm(armRef, pivot, angleDeg, dist, impact);
    }

    // Kick pedal + beater: the foot presses down and the beater swings up
    // to strike the head, both driven by the same kick hits.
    const kickFound = abs === null ? null : mostRecentEvent(eventsByLimb.rightFoot, abs, measureLength);
    const kickImpact = kickFound ? Math.max(0, 1 - (kickFound.sinceBeats * secondsPerBeat) / IMPACT_DECAY_S) : 0;
    kickFootRef.current?.setAttribute(
      "transform",
      `translate(${KICK_PEDAL_FOOT_REST.x} ${KICK_PEDAL_FOOT_REST.y + kickImpact * 8}) scale(${1 - kickImpact * 0.12})`
    );
    const beaterTarget = kickImpact > 0.02 ? KICK_STRIKE_POINT : KICK_BEATER_REST;
    const bdx = beaterTarget.x - KICK_PEDAL_HINGE.x;
    const bdy = beaterTarget.y - KICK_PEDAL_HINGE.y;
    const bdist = Math.max(1, Math.hypot(bdx, bdy));
    const bAngle = (Math.atan2(bdy, bdx) * 180) / Math.PI;
    const beater = beaterRef.current;
    if (beater) {
      beater.setAttribute("transform", `translate(${KICK_PEDAL_HINGE.x} ${KICK_PEDAL_HINGE.y}) rotate(${bAngle})`);
      beater.querySelector("rect")?.setAttribute("width", String(bdist));
      beater.querySelector("circle")?.setAttribute("cx", String(bdist));
    }

    for (const shape of DRUM_SHAPES) {
      const el = overlayRefs.current[shape.id];
      if (!el) continue;
      if (abs === null) {
        el.style.opacity = "0";
        continue;
      }
      const found = mostRecentEvent(eventsByPiece[shape.id], abs, measureLength);
      if (!found) {
        el.style.opacity = "0";
        continue;
      }
      const sinceS = found.sinceBeats * secondsPerBeat;
      const fade = Math.max(0, 1 - sinceS / FLASH_FADE_S) * velocityPeak(found.event.accent);
      el.style.opacity = String(fade);
    }
  }

  // Recomputes the whole rig's pose fresh every frame from the player's
  // live playhead — deliberately stateless (no "since last frame" delta
  // tracking) so a slow/backgrounded frame just means one frame reads a
  // slightly later `abs`, never a compounding drift between the animation
  // and the audio the way accumulating deltas across frames could.
  useEffect(() => {
    if (!isPlaying || allEvents.length === 0 || measureLength <= 0) {
      applyPose(null);
      return;
    }
    let rafId: number;
    function tick() {
      const info = playerRef.current?.getPlayheadInfo() ?? null;
      applyPose(info ? info.beat + info.fraction : null);
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, allEvents, measureLength, bpm]);

  return (
    <div ref={containerRef} className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white">
      <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <h2 className="text-lg font-bold">
          Rock<span className="text-yellow-400">Blocks</span> Drum Teacher
        </h2>
        <button
          type="button"
          onClick={onClose}
          title="Close (Esc)"
          className="rounded-md border border-white/15 px-3 py-1.5 text-sm text-white/70 transition hover:border-red-400 hover:text-red-400"
        >
          ✕ Close
        </button>
      </header>

      <div className="flex flex-wrap items-center gap-4 border-b border-white/10 px-6 py-3">
        <button
          type="button"
          onClick={togglePlay}
          disabled={samplesLoading || measureLength < 1}
          className="rounded-full bg-yellow-400 px-6 py-2 font-bold text-slate-900 transition hover:bg-yellow-300 disabled:opacity-30"
        >
          {samplesLoading ? "Loading…" : isPlaying ? "■ Stop" : "▶ Play"}
        </button>
        <div className="flex items-center gap-2">
          <label htmlFor="teacher-tempo" className="text-sm text-white/60">
            Tempo
          </label>
          <input
            id="teacher-tempo"
            type="range"
            min={40}
            max={220}
            value={bpm}
            onChange={(e) => setBpm(Number(e.target.value))}
            className="w-24 accent-yellow-400 sm:w-40"
          />
          <span className="w-16 text-sm text-white/80">{bpm} BPM</span>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-2 overflow-auto p-6">
        <div className="w-full max-w-2xl rounded-lg bg-gradient-to-b from-slate-800 to-slate-900 p-4 shadow-xl">
          <svg viewBox="0 0 640 610" className="w-full">
            <defs>
              <radialGradient id="cymbalGrad" cx="35%" cy="35%" r="75%">
                <stop offset="0%" stopColor="#fde68a" />
                <stop offset="60%" stopColor="#d4a94a" />
                <stop offset="100%" stopColor="#9a7420" />
              </radialGradient>
              <linearGradient id="shellGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f8fafc" />
                <stop offset="100%" stopColor="#cbd5e1" />
              </linearGradient>
            </defs>

            {/* Stands (drawn first, behind everything else) */}
            {DRUM_SHAPES.filter((p) => p.kind === "cymbal").map((p) => (
              <line key={`stand-${p.id}`} x1={p.cx} y1={p.standTopY} x2={p.cx} y2={470} stroke="#475569" strokeWidth={4} />
            ))}
            <line x1={320} y1={362} x2={320} y2={430} stroke="#475569" strokeWidth={4} />

            {/* The seated drummer, behind the kit pieces it's reaching around */}
            <ellipse cx={320} cy={230} rx={46} ry={16} fill="#334155" />
            <rect x={310} y={230} width={20} height={40} fill="#334155" />
            <line x1={HIP.left.x} y1={HIP.left.y} x2={LEFT_FOOT.x} y2={LEFT_FOOT.y} stroke="#94a3b8" strokeWidth={16} strokeLinecap="round" />
            <line x1={HIP.right.x} y1={HIP.right.y} x2={KICK_PEDAL_FOOT_REST.x} y2={KICK_PEDAL_FOOT_REST.y} stroke="#94a3b8" strokeWidth={16} strokeLinecap="round" />
            <rect x={TORSO.x - TORSO.w / 2} y={TORSO.y - TORSO.h / 2} width={TORSO.w} height={TORSO.h} rx={28} fill="#38bdf8" />
            <circle cx={HEAD.x} cy={HEAD.y} r={HEAD.r} fill="#f4c9a0" />

            {/* Kit pieces */}
            {DRUM_SHAPES.map((p) => (
              <g key={p.id}>
                {p.kind === "drum" ? (
                  <>
                    <rect
                      x={p.cx - p.rx}
                      y={p.cy - p.ry * 0.3}
                      width={p.rx * 2}
                      height={p.ry * 1.6}
                      rx={p.rx * 0.3}
                      fill={p.id === "kick" ? "#b91c1c" : p.id === "snare" ? "#cbd5e1" : "#7c2d12"}
                      stroke="#1e293b"
                      strokeWidth={2}
                    />
                    <ellipse cx={p.cx} cy={p.cy - p.ry * 0.3} rx={p.rx} ry={p.ry * 0.55} fill="url(#shellGrad)" stroke="#94a3b8" strokeWidth={2} />
                  </>
                ) : (
                  <ellipse cx={p.cx} cy={p.cy} rx={p.rx} ry={p.ry} fill="url(#cymbalGrad)" stroke="#7a5c1e" strokeWidth={2} />
                )}
                <ellipse
                  ref={(el) => {
                    if (el) overlayRefs.current[p.id] = el;
                  }}
                  cx={p.cx}
                  cy={p.kind === "drum" ? p.cy - p.ry * 0.3 : p.cy}
                  rx={p.rx}
                  ry={p.kind === "drum" ? p.ry * 0.55 : p.ry}
                  fill="#fde047"
                  opacity={0}
                />
                <text x={p.cx} y={p.cy + p.labelDy} textAnchor="middle" fontSize={13} fill="#e2e8f0" className="select-none" style={{ paintOrder: "stroke", stroke: "#0f172a", strokeWidth: 3 }}>
                  {p.label}
                </text>
              </g>
            ))}

            {/* Kick pedal + beater — drawn in front of the kick shell (it
                physically sits at the base of the drum, closest to camera). */}
            <ellipse cx={LEFT_FOOT.x} cy={LEFT_FOOT.y + 10} rx={20} ry={9} fill="#1e293b" stroke="#475569" strokeWidth={2} />
            <rect x={KICK_PEDAL_FOOT_REST.x - 26} y={KICK_PEDAL_FOOT_REST.y + 16} width={52} height={12} rx={3} fill="#111827" stroke="#475569" strokeWidth={2} />
            <g ref={kickFootRef} transform={`translate(${KICK_PEDAL_FOOT_REST.x} ${KICK_PEDAL_FOOT_REST.y}) scale(1)`} style={{ transition: "transform 90ms ease-out" }}>
              <ellipse cx={0} cy={0} rx={22} ry={10} fill="#292524" stroke="#78716c" strokeWidth={2} />
            </g>
            <g ref={beaterRef} transform={`translate(${KICK_PEDAL_HINGE.x} ${KICK_PEDAL_HINGE.y}) rotate(-70)`}>
              <rect x={0} y={-3} width={0} height={6} rx={3} fill="#94a3b8" />
              <circle cx={0} cy={0} r={11} fill="#e2e8f0" stroke="#94a3b8" strokeWidth={2} />
            </g>

            {/* Arms — drawn last so the sticks read as being in front of the kit */}
            <StickLimb elRef={leftArmRef} />
            <StickLimb elRef={rightArmRef} />
          </svg>
        </div>
        <p className="max-w-2xl text-center text-xs text-white/40">
          Left hand plays the snare/floor tom, right hand crosses over for the hi-hat plus ride/crash/toms, and the
          right foot works the kick pedal — one common way to play it. Real drummers vary their sticking.
        </p>
      </div>
    </div>
  );
}
