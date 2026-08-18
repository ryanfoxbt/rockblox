import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { boards } from "@/db/schema";
import { isReservedBoardName, isValidBoardName, normalizeBoardSlug, SLOT_LETTERS } from "@/lib/board";
import { Editor } from "@/components/Editor";
import { ClaimBoard } from "@/components/ClaimBoard";

export default async function BoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ name: string }>;
  searchParams: Promise<{ slot?: string }>;
}) {
  const { name } = await params;
  const { slot } = await searchParams;

  if (!isValidBoardName(name) || isReservedBoardName(name)) notFound();

  const db = getDb();
  const [board] = await db
    .select()
    .from(boards)
    .where(eq(boards.slug, normalizeBoardSlug(name)))
    .limit(1);

  if (!board) {
    return <ClaimBoard name={name} />;
  }

  const initialSlot = SLOT_LETTERS.find((l) => l === slot);

  return (
    <Editor
      board={{
        slug: board.slug,
        displayName: board.displayName,
        slots: { A: board.slotA, B: board.slotB, C: board.slotC, D: board.slotD },
        textToBeatAlwaysOn: board.textToBeatAlwaysOn,
        textToBeatShowRules: board.textToBeatShowRules,
      }}
      initialSlot={initialSlot}
    />
  );
}
