"use client";

import { useEffect, useRef, useState } from "react";

interface OtherVisitor {
  location: string | null;
}

const HEARTBEAT_MS = 20_000;

// A random id for this tab, stable for the session but never tied to any
// account (there isn't one) — sessionStorage rather than localStorage so a
// closed-then-reopened tab reads as a new visitor, matching "who's here
// right now" rather than "who's ever visited."
function getVisitorId(): string {
  const key = "rockblocks:visitorId";
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(key, id);
  }
  return id;
}

// "Someone else is here" for a claimed board — a heartbeat every ~20s tells
// the server this tab is still open, and the same response says who else's
// heartbeat has landed recently (see the presence API route). Shows a
// one-time-per-session toast the first time another visitor shows up, plus
// a small persistent dot count for as long as anyone else stays active.
export function PresenceIndicator({ boardSlug }: { boardSlug: string }) {
  const [others, setOthers] = useState<OtherVisitor[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const alertedRef = useRef(false);

  useEffect(() => {
    const visitorId = getVisitorId();
    let cancelled = false;

    async function heartbeat() {
      try {
        const res = await fetch(`/api/boards/${boardSlug}/presence`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ visitorId }),
        });
        const data = (await res.json().catch(() => null)) as { others?: OtherVisitor[] } | null;
        if (cancelled || !data) return;
        const list = Array.isArray(data.others) ? data.others : [];
        setOthers(list);

        const alertKey = `rockblocks:presence-alerted:${boardSlug}`;
        if (list.length > 0 && !alertedRef.current && !sessionStorage.getItem(alertKey)) {
          alertedRef.current = true;
          sessionStorage.setItem(alertKey, "1");
          const place = list.find((o) => o.location)?.location;
          setToast(
            place
              ? `Your musical weiner cousin is here too — visiting from ${place}.`
              : "Your musical weiner cousin is here too."
          );
          setTimeout(() => setToast(null), 6000);
        }
      } catch {
        // Best-effort — presence is a nice-to-have, never worth surfacing an
        // error over or retrying aggressively.
      }
    }

    heartbeat();
    const interval = setInterval(heartbeat, HEARTBEAT_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [boardSlug]);

  return (
    <>
      {others.length > 0 && (
        <span
          title={`${others.length} other visitor${others.length === 1 ? "" : "s"} here right now`}
          className="ml-2 inline-flex items-center gap-1 text-white/40"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          {others.length} here now
        </span>
      )}
      {toast && (
        <div className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-lg border border-yellow-400/40 bg-slate-800 px-4 py-2.5 text-center text-sm text-yellow-300 shadow-xl">
          {toast}
        </div>
      )}
    </>
  );
}
