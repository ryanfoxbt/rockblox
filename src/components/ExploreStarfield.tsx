"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FIELD_HEIGHT, FIELD_WIDTH, layoutStar } from "@/lib/starfield";
import type { ExploreBoard } from "@/lib/boardList";
import { BeatPreview } from "@/components/BeatPreview";

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 2.5;
const ACTIVITY_POLL_MS = 15_000;

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export function ExploreStarfield({ boards }: { boards: ExploreBoard[] }) {
  const searchParams = useSearchParams();
  const stars = useMemo(() => boards.map(layoutStar), [boards]);

  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const panRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(0.6);
  const draggingRef = useRef(false);
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const lastInteractionRef = useRef(0);

  const [selected, setSelected] = useState<string | null>(searchParams.get("board"));
  const [active, setActive] = useState<Map<string, number>>(new Map());

  function applyTransform() {
    const s = stageRef.current;
    if (s) s.style.transform = `translate(${panRef.current.x}px, ${panRef.current.y}px) scale(${zoomRef.current})`;
  }

  // Centre the field in the viewport on mount.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    zoomRef.current = clamp(Math.min(el.clientWidth / FIELD_WIDTH, el.clientHeight / FIELD_HEIGHT) * 1.4, MIN_ZOOM, MAX_ZOOM);
    panRef.current = {
      x: el.clientWidth / 2 - (FIELD_WIDTH / 2) * zoomRef.current,
      y: el.clientHeight / 2 - (FIELD_HEIGHT / 2) * zoomRef.current,
    };
    applyTransform();
  }, []);

  // Slow ambient drift — "flying through space" — paused while the user is
  // interacting and for a few seconds after.
  useEffect(() => {
    let raf = 0;
    let t = 0;
    const tick = () => {
      t += 0.004;
      if (!draggingRef.current && Date.now() - lastInteractionRef.current > 3500) {
        panRef.current.x += Math.cos(t) * 0.15;
        panRef.current.y += Math.sin(t * 0.8) * 0.15;
        applyTransform();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Live-visitor badges.
  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch("/api/activity");
        if (!res.ok) return;
        const d = (await res.json()) as { activeNow: { slug: string; count: number }[] };
        if (!cancelled) setActive(new Map(d.activeNow.map((b) => [b.slug, b.count])));
      } catch {
        /* best-effort */
      }
    }
    poll();
    const id = setInterval(poll, ACTIVITY_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  function onPointerDown(e: React.PointerEvent) {
    draggingRef.current = true;
    lastInteractionRef.current = Date.now();
    lastPointerRef.current = { x: e.clientX, y: e.clientY };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!draggingRef.current) return;
    const dx = e.clientX - lastPointerRef.current.x;
    const dy = e.clientY - lastPointerRef.current.y;
    lastPointerRef.current = { x: e.clientX, y: e.clientY };
    panRef.current.x += dx;
    panRef.current.y += dy;
    lastInteractionRef.current = Date.now();
    applyTransform();
  }
  function onPointerUp() {
    draggingRef.current = false;
    lastInteractionRef.current = Date.now();
  }
  function onWheel(e: React.WheelEvent) {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const old = zoomRef.current;
    const next = clamp(old * (e.deltaY < 0 ? 1.12 : 0.89), MIN_ZOOM, MAX_ZOOM);
    panRef.current.x = cx - ((cx - panRef.current.x) / old) * next;
    panRef.current.y = cy - ((cy - panRef.current.y) / old) * next;
    zoomRef.current = next;
    lastInteractionRef.current = Date.now();
    applyTransform();
  }
  function nudgeZoom(factor: number) {
    const el = containerRef.current;
    if (!el) return;
    const cx = el.clientWidth / 2;
    const cy = el.clientHeight / 2;
    const old = zoomRef.current;
    const next = clamp(old * factor, MIN_ZOOM, MAX_ZOOM);
    panRef.current.x = cx - ((cx - panRef.current.x) / old) * next;
    panRef.current.y = cy - ((cy - panRef.current.y) / old) * next;
    zoomRef.current = next;
    lastInteractionRef.current = Date.now();
    applyTransform();
  }
  function recenter() {
    const el = containerRef.current;
    if (!el) return;
    zoomRef.current = clamp(Math.min(el.clientWidth / FIELD_WIDTH, el.clientHeight / FIELD_HEIGHT) * 1.4, MIN_ZOOM, MAX_ZOOM);
    panRef.current = {
      x: el.clientWidth / 2 - (FIELD_WIDTH / 2) * zoomRef.current,
      y: el.clientHeight / 2 - (FIELD_HEIGHT / 2) * zoomRef.current,
    };
    lastInteractionRef.current = Date.now();
    applyTransform();
  }

  return (
    <div className="fixed inset-0 overflow-hidden bg-[radial-gradient(ellipse_at_center,#0b1220_0%,#020617_70%)] text-white">
      <style>{`
        @keyframes rb-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(250,204,21,0.5); } 50% { box-shadow: 0 0 0 10px rgba(250,204,21,0); } }
        .rb-live { animation: rb-pulse 1.8s ease-out infinite; }
      `}</style>

      {/* faint far stars */}
      <div className="pointer-events-none absolute inset-0 opacity-60 [background-image:radial-gradient(1px_1px_at_20%_30%,#fff,transparent),radial-gradient(1px_1px_at_70%_60%,#fff,transparent),radial-gradient(1px_1px_at_40%_80%,#fff,transparent),radial-gradient(1px_1px_at_85%_20%,#fff,transparent),radial-gradient(1px_1px_at_15%_65%,#fff,transparent)] [background-size:100%_100%]" />

      <div
        ref={containerRef}
        className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      >
        <div ref={stageRef} className="absolute left-0 top-0 origin-top-left will-change-transform" style={{ width: FIELD_WIDTH, height: FIELD_HEIGHT }}>
          {stars.map((star) => {
            const count = active.get(star.slug);
            return (
              <button
                key={star.slug}
                type="button"
                aria-label={star.displayName}
                title={star.displayName}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => setSelected(star.slug)}
                className={`group absolute -translate-x-1/2 -translate-y-1/2 rounded-full ${count ? "rb-live" : ""}`}
                style={{
                  left: star.x,
                  top: star.y,
                  width: star.radius * 2,
                  height: star.radius * 2,
                  background: `radial-gradient(circle at 35% 35%, hsl(${star.hue} 90% 78%), hsl(${star.hue} 75% 45%))`,
                  boxShadow: count ? undefined : `0 0 ${star.radius}px hsl(${star.hue} 80% 60% / 0.6)`,
                }}
              >
                <span className="pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded bg-black/70 px-1.5 py-0.5 text-[10px] opacity-0 transition group-hover:opacity-100 group-focus:opacity-100">
                  {star.displayName}
                  {count ? ` · ${count} here` : ""}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* HUD */}
      <div className="absolute left-4 top-4 flex items-center gap-2">
        <Link href="/" className="rounded-md border border-white/15 bg-black/40 px-2.5 py-1 text-xs text-white/70 backdrop-blur transition hover:text-yellow-400">
          ← Home
        </Link>
        <span className="rounded-md border border-white/10 bg-black/40 px-2.5 py-1 text-xs text-white/50 backdrop-blur">
          {stars.length} pages · drag to fly · scroll to zoom
        </span>
      </div>
      <div className="absolute bottom-4 right-4 flex gap-1.5">
        <button type="button" onClick={() => nudgeZoom(1.25)} className="h-8 w-8 rounded-md border border-white/15 bg-black/40 text-white/70 backdrop-blur hover:text-yellow-400">+</button>
        <button type="button" onClick={() => nudgeZoom(0.8)} className="h-8 w-8 rounded-md border border-white/15 bg-black/40 text-white/70 backdrop-blur hover:text-yellow-400">−</button>
        <button type="button" onClick={recenter} className="h-8 rounded-md border border-white/15 bg-black/40 px-2 text-xs text-white/70 backdrop-blur hover:text-yellow-400">reset</button>
      </div>

      {/* preview panel */}
      {selected && (
        <div className="absolute inset-y-0 right-0 z-20 w-full max-w-md overflow-y-auto border-l border-white/15 bg-slate-900/95 backdrop-blur sm:w-[26rem]">
          <div className="flex justify-end p-2 pb-0">
            <button type="button" onClick={() => setSelected(null)} className="px-2 text-white/50 hover:text-red-400">
              ✕
            </button>
          </div>
          <BeatPreview slug={selected} />
        </div>
      )}
    </div>
  );
}
