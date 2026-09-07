import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { userSongs } from "@/db/schema";
import { EXTENDED_SLOT_LETTERS, ExtendedSlotLetter } from "@/lib/board";
import { requireUser } from "@/lib/auth/session";
import { Editor } from "@/components/Editor";

export const dynamic = "force-dynamic";

export const metadata = { title: "Edit song", robots: { index: false } };

export default async function SavedSongPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ slot?: string }>;
}) {
  const { id } = await params;
  const { slot } = await searchParams;
  const user = await requireUser();

  const db = getDb();
  const [song] = await db.select().from(userSongs).where(eq(userSongs.id, id)).limit(1);
  if (!song || song.ownerId !== user.id) notFound();

  const initialSlot = EXTENDED_SLOT_LETTERS.find((l) => l === slot) as ExtendedSlotLetter | undefined;

  return (
    <Editor
      slotLetters={EXTENDED_SLOT_LETTERS}
      savedSong={{ id: song.id, title: song.title }}
      board={{
        slug: song.id,
        displayName: song.title,
        slots: song.slots,
        basePath: `/my/${song.id}`,
      }}
      initialSlot={initialSlot}
    />
  );
}
