import { MetadataRoute } from "next";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { boards, lessons, mathLessons, songs } from "@/db/schema";

const SITE_URL = "https://rockblocks.app";

// Caps how many claimed pages get listed — recent ones are the most likely
// to still have real content and be worth a crawl; older abandoned/test
// pages matter less. Cheap to raise later if it turns out to matter.
const MAX_BOARD_URLS = 500;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const db = getDb();

  const [boardRows, lessonRows, mathLessonRows, songRows] = await Promise.all([
    db
      .select({ displayName: boards.displayName, updatedAt: boards.updatedAt })
      .from(boards)
      .orderBy(desc(boards.updatedAt))
      .limit(MAX_BOARD_URLS),
    db.select({ slug: lessons.slug, createdAt: lessons.createdAt }).from(lessons),
    db
      .select({ slug: mathLessons.slug, createdAt: mathLessons.createdAt })
      .from(mathLessons)
      .where(eq(mathLessons.isPublished, true)),
    db.select({ slug: songs.slug, createdAt: songs.createdAt }).from(songs),
  ]);

  // Owned, evergreen pages — the homepage, the about page, and the
  // curated libraries plus every item in them. These are the SEO/GEO
  // surface; the claimed user boards below are lower-priority long tail.
  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/about`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/ai-music`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/school`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/math`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/songs`, changeFrequency: "monthly", priority: 0.7 },
  ];

  const lessonPages: MetadataRoute.Sitemap = lessonRows.map((row) => ({
    url: `${SITE_URL}/school/${row.slug}`,
    lastModified: row.createdAt,
    changeFrequency: "yearly",
    priority: 0.6,
  }));

  const mathLessonPages: MetadataRoute.Sitemap = mathLessonRows.map((row) => ({
    url: `${SITE_URL}/math/${row.slug}`,
    lastModified: row.createdAt,
    changeFrequency: "yearly",
    priority: 0.6,
  }));

  const songPages: MetadataRoute.Sitemap = songRows.map((row) => ({
    url: `${SITE_URL}/songs/${row.slug}`,
    lastModified: row.createdAt,
    changeFrequency: "yearly",
    priority: 0.6,
  }));

  return [
    ...staticPages,
    ...lessonPages,
    ...mathLessonPages,
    ...songPages,
    ...boardRows.map((row) => ({
      url: `${SITE_URL}/${row.displayName}`,
      lastModified: row.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.4,
    })),
  ];
}
