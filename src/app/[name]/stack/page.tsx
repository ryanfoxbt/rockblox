import { eq } from "drizzle-orm";
import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getDb } from "@/db";
import { boards } from "@/db/schema";
import { isReservedBoardName, isValidBoardName, normalizeBoardSlug, SLOT_LETTERS } from "@/lib/board";
import { buildShareMetadata } from "@/lib/shareMetadata";
import { StackBuilder } from "@/components/StackBuilder";

// Without this, sharing a Stacks link fell all the way back to the root
// layout's generic site-wide title/description — see the board page's own
// generateMetadata for why that's worth avoiding.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ name: string }>;
}): Promise<Metadata> {
  const { name } = await params;
  if (!isValidBoardName(name) || isReservedBoardName(name)) return {};

  const db = getDb();
  const [board] = await db
    .select({ displayName: boards.displayName })
    .from(boards)
    .where(eq(boards.slug, normalizeBoardSlug(name)))
    .limit(1);
  if (!board) return {};

  return buildShareMetadata({
    title: `${board.displayName}'s Stack`,
    description: `${board.displayName}'s drum beats, arranged into a full song on RockBlocks — a free, browser-based drum machine. Play it, or make your own free at rockblocks.app.`,
    path: `/${board.displayName}/stack`,
  });
}

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

  // Stacks arranges an already-claimed page's saved beats — nothing
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
