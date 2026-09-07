import { desc, eq, gt, isNotNull, or } from "drizzle-orm";
import { getDb } from "@/db";
import { boardPresence, boards, wallMessages } from "@/db/schema";
import { ACTIVE_WINDOW_SECONDS } from "@/lib/presence";

export interface ActivityData {
  activeNow: { slug: string; displayName: string; count: number; locations: string[] }[];
  recentEdits: { slug: string; displayName: string; updatedAt: string }[];
  recentWall: { slug: string; displayName: string; message: string; createdAt: string }[];
  totals: { activeVisitors: number; activeBoards: number };
}

// Cross-board public activity for the Spy feed and Explore's live badges.
// Everything here is already-public info (board names, coarse city/region from
// presence, wall text) — just aggregated. No auth here; callers gate access.
export async function getActivity(): Promise<ActivityData> {
  const db = getDb();
  const cutoff = new Date(Date.now() - ACTIVE_WINDOW_SECONDS * 1000);

  const [presenceRows, editRows, wallRows] = await Promise.all([
    db
      .select({
        slug: boardPresence.boardSlug,
        location: boardPresence.location,
        displayName: boards.displayName,
      })
      .from(boardPresence)
      .innerJoin(boards, eq(boards.slug, boardPresence.boardSlug))
      .where(gt(boardPresence.lastSeenAt, cutoff)),
    db
      .select({ slug: boards.slug, displayName: boards.displayName, updatedAt: boards.updatedAt })
      .from(boards)
      .where(
        or(
          isNotNull(boards.slotA),
          isNotNull(boards.slotB),
          isNotNull(boards.slotC),
          isNotNull(boards.slotD)
        )
      )
      .orderBy(desc(boards.updatedAt))
      .limit(20),
    db
      .select({
        slug: wallMessages.boardSlug,
        displayName: boards.displayName,
        message: wallMessages.message,
        createdAt: wallMessages.createdAt,
      })
      .from(wallMessages)
      .innerJoin(boards, eq(boards.slug, wallMessages.boardSlug))
      .orderBy(desc(wallMessages.createdAt))
      .limit(20),
  ]);

  const byBoard = new Map<string, { slug: string; displayName: string; count: number; locations: string[] }>();
  for (const row of presenceRows) {
    const entry = byBoard.get(row.slug) ?? {
      slug: row.slug,
      displayName: row.displayName,
      count: 0,
      locations: [],
    };
    entry.count += 1;
    if (row.location && !entry.locations.includes(row.location)) entry.locations.push(row.location);
    byBoard.set(row.slug, entry);
  }
  const activeNow = [...byBoard.values()]
    .sort((a, b) => b.count - a.count)
    .map((b) => ({ ...b, locations: b.locations.slice(0, 4) }));

  return {
    activeNow,
    recentEdits: editRows.map((r) => ({ ...r, updatedAt: r.updatedAt.toISOString() })),
    recentWall: wallRows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    totals: { activeVisitors: presenceRows.length, activeBoards: activeNow.length },
  };
}
