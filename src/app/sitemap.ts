import { MetadataRoute } from "next";
import { desc } from "drizzle-orm";
import { getDb } from "@/db";
import { boards } from "@/db/schema";
import { DRUM_LESSONS } from "@/lib/drumSchool";
import { FAMOUS_SONGS } from "@/lib/famousSongs";

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

  // Owned, evergreen pages — the homepage, the about page, and the two
  // curated libraries plus every item in them. These are the SEO/GEO
  // surface; the claimed user boards below are lower-priority long tail.
  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/about`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/school`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/songs`, changeFrequency: "monthly", priority: 0.7 },
  ];

  const lessonPages: MetadataRoute.Sitemap = DRUM_LESSONS.map((lesson) => ({
    url: `${SITE_URL}/school/${lesson.slug}`,
    changeFrequency: "yearly",
    priority: 0.6,
  }));

  const songPages: MetadataRoute.Sitemap = FAMOUS_SONGS.map((song) => ({
    url: `${SITE_URL}/songs/${song.slug}`,
    changeFrequency: "yearly",
    priority: 0.6,
  }));

  return [
    ...staticPages,
    ...lessonPages,
    ...songPages,
    ...rows.map((row) => ({
      url: `${SITE_URL}/${row.displayName}`,
      lastModified: row.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.4,
    })),
  ];
}
