import { Metadata } from "next";
import { notFound } from "next/navigation";
import { EXTENDED_SLOT_LETTERS, ExtendedSlotLetter } from "@/lib/board";
import { loadPublicSong, publicSongShareText } from "@/lib/publicSong";
import { StackBuilder } from "@/components/StackBuilder";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const song = await loadPublicSong(slug);
  if (!song) return { title: "Song not found", robots: { index: false } };

  const { title, description } = publicSongShareText(song);
  return {
    title,
    description,
    robots: { index: false, follow: true },
    alternates: { canonical: `/s/${slug}/stack` },
    openGraph: { title, description, url: `/s/${slug}/stack`, type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function PublicSongStackPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { slug } = await params;
  const { from } = await searchParams;

  const song = await loadPublicSong(slug);
  if (!song) notFound();

  const returnSlot = EXTENDED_SLOT_LETTERS.find((l) => l === from) as ExtendedSlotLetter | undefined;

  return (
    <StackBuilder
      slotLetters={EXTENDED_SLOT_LETTERS}
      board={{
        slug: song.id,
        displayName: song.title,
        slots: song.slots,
        stack: song.stack ?? null,
        readOnly: true,
        basePath: `/s/${slug}`,
        subtitle: song.title,
      }}
      returnSlot={returnSlot}
    />
  );
}
