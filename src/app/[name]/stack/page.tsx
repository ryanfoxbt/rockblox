import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { getDb } from "@/db";
import { boards } from "@/db/schema";
import { isReservedBoardName, isValidBoardName, normalizeBoardSlug, SLOT_LETTERS } from "@/lib/board";
import { StackBuilder } from "@/components/StackBuilder";

export default async function StackPage({
  params,
  searchParams,
}: {
  params: Promise<{ name: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { name } = await params;
  const { from } = await searchParams;

  if (!isValidBoardName(name) || isReservedBoardName(name)) notFound();

  const db = getDb();
  const [board] = await db
    .select()
    .from(boards)
    .where(eq(boards.slug, normalizeBoardSlug(name)))
    .limit(1);

  // Stack Builder arranges an already-claimed page's saved beats — nothing
  // to arrange on an unclaimed name, so send them to claim it first.
  if (!board) redirect(`/${name}`);

  const returnSlot = SLOT_LETTERS.find((l) => l === from);

  return (
    <StackBuilder
      board={{
        slug: board.slug,
        displayName: board.displayName,
        slots: { A: board.slotA, B: board.slotB, C: board.slotC, D: board.slotD },
        stack: board.stack ?? null,
      }}
      returnSlot={returnSlot}
    />
  );
}
