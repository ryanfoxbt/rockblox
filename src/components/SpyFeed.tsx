"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BeatPreviewModal } from "@/components/BeatPreviewModal";
import type { ActivityData } from "@/lib/activity";

const POLL_MS = 10_000;

function ago(iso: string): string {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function Row({ children, onPeek }: { children: React.ReactNode; onPeek: () => void }) {
  return (
    <button
      type="button"
      onClick={onPeek}
      className="flex w-full items-center justify-between gap-3 rounded-md border border-white/10 bg-white/5 px-4 py-2.5 text-left text-sm transition hover:border-yellow-400/50"
    >
      {children}
    </button>
  );
}

export function SpyFeed({ initial }: { initial: ActivityData }) {
  const [data, setData] = useState<ActivityData>(initial);
  const [peekSlug, setPeekSlug] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch("/api/activity");
        if (!res.ok) return;
        const next = (await res.json()) as ActivityData;
        if (!cancelled) setData(next);
      } catch {
        /* best-effort */
      }
    }
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="mt-6 flex flex-col gap-6">
      <p className="text-sm text-white/60">
        <span className="font-semibold text-yellow-400">{data.totals.activeVisitors}</span>{" "}
        {data.totals.activeVisitors === 1 ? "person" : "people"} on{" "}
        <span className="font-semibold text-yellow-400">{data.totals.activeBoards}</span>{" "}
        {data.totals.activeBoards === 1 ? "page" : "pages"} right now.
      </p>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/50">Active right now</h2>
        {data.activeNow.length === 0 ? (
          <p className="text-sm text-white/30">Nobody on a public page this second.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {data.activeNow.map((b) => (
              <Row key={b.slug} onPeek={() => setPeekSlug(b.slug)}>
                <span className="min-w-0 flex-1 truncate">
                  <span className="text-emerald-400">●</span>{" "}
                  <span className="font-mono text-yellow-400">/{b.displayName}</span>
                  {b.locations.length > 0 && (
                    <span className="text-white/40"> — {b.locations.join(" · ")}</span>
                  )}
                </span>
                <span className="shrink-0 text-white/50">
                  {b.count} here
                </span>
              </Row>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/50">Just edited</h2>
        <div className="flex flex-col gap-2">
          {data.recentEdits.map((b) => (
            <Row key={b.slug} onPeek={() => setPeekSlug(b.slug)}>
              <span className="min-w-0 flex-1 truncate">
                ✏️ <span className="font-mono text-yellow-400">/{b.displayName}</span>
              </span>
              <span className="shrink-0 text-white/40">{ago(b.updatedAt)}</span>
            </Row>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/50">Wall chatter</h2>
        {data.recentWall.length === 0 ? (
          <p className="text-sm text-white/30">No graffiti lately.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {data.recentWall.map((w, i) => (
              <Row key={`${w.slug}-${i}`} onPeek={() => setPeekSlug(w.slug)}>
                <span className="min-w-0 flex-1 truncate">
                  🖊️ <span className="font-mono text-yellow-400">/{w.displayName}</span>
                  <span className="text-white/60"> “{w.message}”</span>
                </span>
                <span className="shrink-0 text-white/40">{ago(w.createdAt)}</span>
              </Row>
            ))}
          </div>
        )}
      </section>

      <p className="text-xs text-white/30">
        Want the real thing? <Link href="/explore" className="text-yellow-400 hover:underline">Explore the galaxy →</Link>
      </p>

      {peekSlug && <BeatPreviewModal slug={peekSlug} onClose={() => setPeekSlug(null)} />}
    </div>
  );
}
