"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { authClient } from "./auth/client";
import { earnedBadges, MathBadge } from "./mathBadges";

// Mirrors draftStorage.ts's pattern: guarded for SSR (no `window` on the
// server), wrapped in try/catch (storage can be full or disabled), and
// validated before trusting parsed JSON.
const STORAGE_KEY = "rockblocks:math-progress";

export function progressKey(lessonSlug: string, slot: string): string {
  return `${lessonSlug}:${slot}`;
}

function loadLocal(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every((v) => typeof v === "string")) return new Set();
    return new Set(parsed);
  } catch {
    return new Set();
  }
}

function saveLocal(solved: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...solved]));
  } catch {
    // Storage full or disabled (e.g. private browsing) — progress just
    // won't survive a reload for this visitor; nothing here is essential.
  }
}

const SLOTS = ["A", "B", "C", "D"];

function lessonsCompletedFrom(solved: Set<string>, lessonSlugs: string[]): number {
  let count = 0;
  for (const slug of lessonSlugs) {
    if (SLOTS.every((slot) => solved.has(progressKey(slug, slot)))) count++;
  }
  return count;
}

// Tracks which RockBlocks Math questions this visitor has solved — instant
// via localStorage for everyone, and permanently synced to their account
// once signed in (mirroring how an anonymous board becomes permanent once
// claimed). `lessonSlugs` is the currently-published lesson set (passed by
// the caller from a DB query) — it's what "every lesson" means for the Full
// Kit badge and the lessons-completed count, so an unpublished/draft lesson
// never blocks that badge. See src/app/api/math-progress/route.ts for the
// account side and src/lib/mathBadges.ts for how badges are derived.
export function useMathProgress(lessonSlugs: string[]) {
  const { data: session } = authClient.useSession();
  const [solved, setSolved] = useState<Set<string>>(() => new Set());
  const [hydrated, setHydrated] = useState(false);
  const [justEarned, setJustEarned] = useState<MathBadge | null>(null);
  const migratedRef = useRef(false);
  // null until the initial localStorage load lands — badges already earned
  // as of that load must never announce themselves as "just earned," only
  // ones crossed by a markSolved (or a sign-in merge) after that point. See
  // the badge-detection effect below, gated on `hydrated`.
  const knownBadgeIdsRef = useRef<Set<string> | null>(null);

  // Local progress loads after mount (client-only) rather than in the
  // initial useState — reading localStorage during render would make the
  // client's first render disagree with the server-rendered HTML.
  useEffect(() => {
    // One-time rehydration from an external store (localStorage) on mount —
    // not derived from props/state, so there's no dependency to move this
    // into render or a plain event handler instead (mirrors the scratchpad
    // draft restore in Editor.tsx).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSolved(loadLocal());
    setHydrated(true);
  }, []);

  // Once signed in, pull the account's saved progress, merge it with
  // whatever's local, and push any local-only entries up to the account —
  // a one-time migration per sign-in, not a continuous sync.
  useEffect(() => {
    if (!session?.user || migratedRef.current) return;
    migratedRef.current = true;
    (async () => {
      try {
        const res = await fetch("/api/math-progress");
        if (!res.ok) return;
        const data = (await res.json()) as { solved: { lessonSlug: string; slot: string }[] };
        const serverKeys = new Set(data.solved.map((s) => progressKey(s.lessonSlug, s.slot)));
        setSolved((prev) => {
          const localOnly = [...prev].filter((k) => !serverKeys.has(k));
          for (const key of localOnly) {
            const sep = key.indexOf(":");
            const lessonSlug = key.slice(0, sep);
            const slot = key.slice(sep + 1);
            fetch("/api/math-progress", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ lessonSlug, slot }),
            }).catch(() => {});
          }
          const merged = new Set([...prev, ...serverKeys]);
          saveLocal(merged);
          return merged;
        });
      } catch {
        // Offline or the API hiccuped — local progress still works fine on
        // its own; the next sign-in (or a future load) can retry the merge.
      }
    })();
  }, [session?.user]);

  // Detect newly-crossed badges whenever the solved set changes, so the
  // workspace can show a one-time "badge earned" toast instead of the
  // player re-seeing the same badge announced on every render. Gated on
  // `hydrated` so the very first population of `solved` (whatever was
  // already earned before this page load) sets the baseline silently
  // instead of re-announcing old badges on every visit.
  useEffect(() => {
    if (!hydrated) return;
    const stats = {
      totalSolved: solved.size,
      lessonsCompleted: lessonsCompletedFrom(solved, lessonSlugs),
      totalLessons: lessonSlugs.length,
    };
    const current = earnedBadges(stats);
    const currentIds = new Set(current.map((b) => b.id));
    if (knownBadgeIdsRef.current) {
      const newBadge = current.find((b) => !knownBadgeIdsRef.current!.has(b.id));
      if (newBadge) setJustEarned(newBadge);
    }
    knownBadgeIdsRef.current = currentIds;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solved, hydrated]);

  const markSolved = useCallback(
    (lessonSlug: string, slot: string): boolean => {
      const key = progressKey(lessonSlug, slot);
      let isNew = false;
      setSolved((prev) => {
        if (prev.has(key)) return prev;
        isNew = true;
        const next = new Set(prev);
        next.add(key);
        saveLocal(next);
        return next;
      });
      if (isNew && session?.user) {
        fetch("/api/math-progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lessonSlug, slot }),
        }).catch(() => {});
      }
      return isNew;
    },
    [session?.user]
  );

  const totalSolved = solved.size;
  const lessonsCompleted = lessonsCompletedFrom(solved, lessonSlugs);
  const badges = earnedBadges({ totalSolved, lessonsCompleted, totalLessons: lessonSlugs.length });

  return {
    solved,
    markSolved,
    totalSolved,
    lessonsCompleted,
    badges,
    justEarned,
    dismissJustEarned: () => setJustEarned(null),
    signedIn: !!session?.user,
    isSolved: (lessonSlug: string, slot: string) => solved.has(progressKey(lessonSlug, slot)),
    lessonSolvedCount: (lessonSlug: string) => {
      let count = 0;
      for (const slot of ["A", "B", "C", "D"]) if (solved.has(progressKey(lessonSlug, slot))) count++;
      return count;
    },
  };
}
