import { eq } from "drizzle-orm";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { songs } from "@/db/schema";
import { SLOT_LETTERS } from "@/lib/board";
import { buildShareMetadata } from "@/lib/shareMetadata";
import { Editor } from "@/components/Editor";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const db = getDb();
  const [song] = await db.select({ title: songs.title, artist: songs.artist }).from(songs).where(eq(songs.slug, slug)).limit(1);
  if (!song) return {};

  return buildShareMetadata({
    title: `${song.title} — ${song.artist}`,
    description: `${song.title} by ${song.artist}, mapped out as a drum beat on RockBlocks. Play it, remix it, or use it as inspiration for your own — free at rockblocks.app.`,
    path: `/songs/${slug}`,
  });
}

export default async function SongPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ slot?: string }>;
}) {
  const { slug } = await params;
  const { slot } = await searchParams;

  const db = getDb();
  const [song] = await db.select().from(songs).where(eq(songs.slug, slug)).limit(1);
  if (!song) notFound();

  const initialSlot = SLOT_LETTERS.find((l) => l === slot);

  return (
    <Editor
      board={{
        slug: song.slug,
        displayName: song.title,
        slots: { A: song.slotA, B: song.slotB, C: song.slotC, D: song.slotD },
        stack: song.stack,
        readOnly: true,
        basePath: `/songs/${song.slug}`,
        subtitle: `${song.title} — ${song.artist}`,
      }}
      initialSlot={initialSlot}
    />
  );
}
