import { MetadataRoute } from "next";
import { desc } from "drizzle-orm";
import { getDb } from "@/db";
import { boards } from "@/db/schema";

const SITE_URL = "https://rockblocks.app";

// Caps how many claimed pages get listed — recent ones are the most likely
// to still have real content and be worth a crawl; older abandoned/test
// pages matter less. Cheap to raise later if it turns out to matter.
const MAX_BOARD_URLS = 500;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const db = getDb();
  const rows = await db
    .select({ displayName: boards.displayName, updatedAt: boards.updatedAt })
    .from(boards)
    .orderBy(desc(boards.updatedAt))
    .limit(MAX_BOARD_URLS);

  return [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    ...rows.map((row) => ({
      url: `${SITE_URL}/${row.displayName}`,
      lastModified: row.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
  ];
}
