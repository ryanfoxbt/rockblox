// One-off / re-runnable seed for the curated /songs library — copies a
// famous song's already-mapped-out board into the `songs` table so it can
// be served read-only at /songs/[slug]. Source boards are hand-built the
// normal way (claim a page, build the beats, arrange them in Stacks), then
// captured here once they're ready to be shared as inspiration.
import { eq } from "drizzle-orm";
import { getDb } from "../src/db";
import { boards, songs } from "../src/db/schema";

interface SongSeed {
  sourceBoardSlug: string;
  slug: string;
  title: string;
  artist: string;
}

const SEEDS: SongSeed[] = [
  { sourceBoardSlug: "bltzkriegbop", slug: "blitzkriegbop", title: "Blitzkrieg Bop", artist: "The Ramones" },
];

const db = getDb();

for (const seed of SEEDS) {
  const [source] = await db.select().from(boards).where(eq(boards.slug, seed.sourceBoardSlug)).limit(1);
  if (!source) {
    console.error(`Skipping ${seed.slug}: no board found at slug "${seed.sourceBoardSlug}"`);
    continue;
  }

  const row = {
    slug: seed.slug,
    title: seed.title,
    artist: seed.artist,
    slotA: source.slotA,
    slotB: source.slotB,
    slotC: source.slotC,
    slotD: source.slotD,
    stack: source.stack,
  };

  await db
    .insert(songs)
    .values(row)
    .onConflictDoUpdate({ target: songs.slug, set: row });

  console.log(`Seeded /songs/${seed.slug} ("${seed.title}" — ${seed.artist}) from board "${seed.sourceBoardSlug}"`);
}
