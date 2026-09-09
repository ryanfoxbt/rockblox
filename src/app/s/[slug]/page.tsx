import { Metadata } from "next";
import { notFound } from "next/navigation";
import { EXTENDED_SLOT_LETTERS, ExtendedSlotLetter } from "@/lib/board";
import { loadPublicSong, publicSongShareText, publicSongSummary } from "@/lib/publicSong";
import { Editor } from "@/components/Editor";
import { PublicSongAbout } from "@/components/PublicSongAbout";

// Always render against the owner's current data — a shared link should
// reflect edits they've made since posting it, and stop resolving the moment
// they make it private.
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
  // Not indexed — this is user-shared content, meant for a link someone
  // pastes, not for search. The social-preview tags below still work (Slack,
  // LinkedIn, iMessage read them directly). The og:image comes from the
  // colocated opengraph-image.tsx.
  return {
    title,
    description,
    robots: { index: false, follow: true },
    alternates: { canonical: `/s/${slug}` },
    openGraph: { title, description, url: `/s/${slug}`, type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function PublicSongPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ slot?: string }>;
}) {
  const { slug } = await params;
  const { slot } = await searchParams;

  const song = await loadPublicSong(slug);
  if (!song) notFound();

  const initialSlot = EXTENDED_SLOT_LETTERS.find((l) => l === slot) as ExtendedSlotLetter | undefined;

  return (
    <>
      <Editor
        slotLetters={EXTENDED_SLOT_LETTERS}
        board={{
          slug: song.id,
          displayName: song.title,
          slots: song.slots,
          stack: song.stack,
          readOnly: true,
          basePath: `/s/${slug}`,
          subtitle: song.title,
        }}
        initialSlot={initialSlot}
      />
      <PublicSongAbout title={song.title} summary={publicSongSummary(song)} />
    </>
  );
}
