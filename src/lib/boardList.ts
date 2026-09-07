import { desc } from "drizzle-orm";
import { getDb } from "@/db";
import { boards } from "@/db/schema";

export interface ExploreBoard {
  slug: string;
  displayName: string;
  filledSlots: number;
  updatedAt: string;
}

// Every claimed page, trimmed to what the Explore starfield needs. Board pages
// are already public; the /explore route that shows this is signed-in only.
// Capped rather than paginated — dozens of boards, not millions.
export async function listBoardsForExplore(limit = 500): Promise<ExploreBoard[]> {
  const db = getDb();
  const rows = await db
    .select({
      slug: boards.slug,
      displayName: boards.displayName,
      slotA: boards.slotA,
      slotB: boards.slotB,
      slotC: boards.slotC,
      slotD: boards.slotD,
      updatedAt: boards.updatedAt,
    })
    .from(boards)
    .orderBy(desc(boards.updatedAt))
    .limit(limit);

  return rows.map((r) => ({
    slug: r.slug,
    displayName: r.displayName,
    filledSlots: [r.slotA, r.slotB, r.slotC, r.slotD].filter((s) => s && s.lines.length > 0).length,
    updatedAt: r.updatedAt.toISOString(),
  }));
}
