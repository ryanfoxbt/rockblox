import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { userSongs } from "@/db/schema";
import { EXTENDED_SLOT_LETTERS, ExtendedSlotLetter } from "@/lib/board";
import { requireUser } from "@/lib/auth/session";
import { StackBuilder } from "@/components/StackBuilder";

export const dynamic = "force-dynamic";

export const metadata = { title: "Stack a song", robots: { index: false } };

export default async function SavedSongStackPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const { from } = await searchParams;
  const user = await requireUser();

  const db = getDb();
  const [song] = await db.select().from(userSongs).where(eq(userSongs.id, id)).limit(1);
  if (!song || song.ownerId !== user.id) notFound();

  const returnSlot = EXTENDED_SLOT_LETTERS.find((l) => l === from) as ExtendedSlotLetter | undefined;

  return (
    <StackBuilder
      slotLetters={EXTENDED_SLOT_LETTERS}
      savedSongId={song.id}
      board={{
        slug: song.id,
        displayName: song.title,
        slots: song.slots,
        stack: song.stack ?? null,
        basePath: `/my/${song.id}`,
      }}
      returnSlot={returnSlot}
    />
  );
}
